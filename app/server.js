'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),dgram=require('node:dgram'),crypto=require('node:crypto');
const {encode,decode}=require('./osc');
const ROOT=__dirname, CONFIG=process.env.NP_CONFIG||path.join(ROOT,'config.json');
const PORT=Number(process.env.NP_HTTP_PORT||3210), OSC_IN=Number(process.env.NP_OSC_IN||11001), OSC_OUT=Number(process.env.NP_OSC_OUT||11000);
const RECOVERY=Number(process.env.NP_RECOVERY_MS||10000), TIMEOUT=Number(process.env.NP_TIMEOUT_MS||25000);
const defaults={watchTracks:[0],artist:'',hideWhenIdle:true,selection:'latest',titleFormat:'full'};
function validate(v){
 if(!v||!Array.isArray(v.watchTracks)||v.watchTracks.length<1||v.watchTracks.length>16||v.watchTracks.some(i=>!Number.isInteger(i)||i<0||i>2047))throw Error('Choose between 1 and 16 DJ tracks.');
 if(typeof v.artist!=='string'||v.artist.length>120)throw Error('Subtitle must be 120 characters or fewer.');
 if(typeof v.hideWhenIdle!=='boolean'||!['latest','all'].includes(v.selection)||!['full','artist-title'].includes(v.titleFormat))throw Error('Invalid display settings.');
 return {watchTracks:[...new Set(v.watchTracks)].sort((a,b)=>a-b),artist:v.artist.trim(),hideWhenIdle:v.hideWhenIdle,selection:v.selection,titleFormat:v.titleFormat};
}
let config;
try{config=validate({...defaults,...(fs.existsSync(CONFIG)?JSON.parse(fs.readFileSync(CONFIG,'utf8')):{})});}catch(e){console.error('Cannot read settings: '+e.message);process.exit(1);}
const TEXTFILE=path.join(path.dirname(CONFIG),'Now-Playing.txt');
let lastText='';let testDisplay=false,testTimer;
try{fs.writeFileSync(TEXTFILE,'');}catch(e){console.error('Cannot create OBS text file: '+e.message);process.exit(1);}
function updateText(s){
 let title=s.items.map(t=>t.clipName).join(' / '),subtitle=s.artist||'';
 if(s.items.length===1&&s.titleFormat==='artist-title'){const match=title.match(/^(.+?)\s[-–—]\s(.+)$/);if(match){subtitle=match[1];title=match[2];}}
 const value=s.items.length?title+(subtitle?'\n'+subtitle:''):(s.hideWhenIdle?'':s.connected?'STANDBY':'WAITING FOR ABLETON');
 if(value!==lastText){fs.writeFileSync(TEXTFILE,value);lastText=value;}
}
const token=crypto.randomBytes(24).toString('hex'),tracks=new Map(),clients=new Set();
let connected=false,transport=false,lastReply=0,names=[],error='',seq=0,lastPayload='',broadcastTimer,closing=false,started=false,lastBind=0;
let sent=0,received=0,updates=0;
function resetTracks(){tracks.clear();for(const index of config.watchTracks)tracks.set(index,{index,slot:-1,name:'',clip:'',mute:false,rank:0});}
resetTracks();
const osc=dgram.createSocket('udp4');
function send(address,args=[]){if(closing)return;sent++;osc.send(encode(address,args),OSC_OUT,'127.0.0.1',e=>{if(e&&!closing){error=e.message;publish();}});}
function listen(action){send('/live/song/'+action+'/is_playing');for(const t of tracks.values()){if(action==='start_listen'&&t.index>=names.length)continue;for(const prop of ['playing_slot_index','mute','name'])send('/live/track/'+action+'/'+prop,[t.index]);}}
function subscribe(){lastBind=Date.now();listen('start_listen');}
function active(){if(!connected||!transport)return [];const a=[...tracks.values()].filter(t=>t.slot>=0&&t.clip&&!t.mute);a.sort((a,b)=>b.rank-a.rank||a.index-b.index);return config.selection==='all'?a:a.slice(0,1);}
function state(){return {app:'ableton-now-playing-community',version:'1.0.0',testDisplay,connected,playing:connected&&transport,items:active().map(t=>({trackIndex:t.index,trackName:t.name,clipName:t.clip})),artist:config.artist,hideWhenIdle:config.hideWhenIdle,titleFormat:config.titleFormat,error,tracks:names.map((name,index)=>({index,name})),watchTracks:config.watchTracks};}
function publish(){if(broadcastTimer||closing)return;broadcastTimer=setTimeout(()=>{broadcastTimer=null;try{updateText(state());}catch(e){error='OBS text file: '+e.message;}const payload=JSON.stringify(state());if(payload===lastPayload)return;lastPayload=payload;updates++;for(const res of clients){if(res.destroyed||res.writableLength>65536){res.destroy();clients.delete(res);continue;}res.write('data: '+payload+'\n\n');}},40);}
function disconnect(){connected=false;transport=false;lastBind=0;resetTracks();publish();}
function handle({address,args:a}){
 if(address==='/live/error'){error=String(a[0]||'AbletonOSC reported an error.');publish();return;}
 const known=['/live/startup','/live/song/get/is_playing','/live/song/get/track_names','/live/track/get/playing_slot_index','/live/track/get/mute','/live/track/get/name','/live/clip/get/name'];
 if(!known.includes(address))return;
 const wasConnected=connected;connected=true;lastReply=Date.now();
 if(!wasConnected||address==='/live/startup'){error='';resetTracks();transport=false;names=[];send('/live/song/get/track_names');send('/live/song/get/is_playing');}
 if(address==='/live/startup'){lastBind=0;publish();return;}
 if(address==='/live/song/get/track_names'){
  const next=a.map(String),changed=JSON.stringify(next)!==JSON.stringify(names);names=next;
  if(changed){for(const t of tracks.values()){t.name=names[t.index]||'';t.slot=-1;t.clip='';t.rank=0;}}
  if(changed||!lastBind)subscribe();
 }else if(address==='/live/song/get/is_playing'){
  const resumed=!transport&&Boolean(a[0]);transport=Boolean(a[0]);
  if(resumed){for(const t of tracks.values())if(t.index<names.length)send('/live/track/get/playing_slot_index',[t.index]);}
 }else if(address.startsWith('/live/track/get/')){
  const t=tracks.get(a[0]);if(!t)return;
  const prop=address.split('/').pop();
  if(prop==='playing_slot_index'&&Number.isInteger(a[1])){
   if(t.slot!==a[1]){t.slot=a[1];t.clip='';t.rank=t.slot>=0?++seq:0;}
   if(t.slot>=0&&!t.clip)send('/live/clip/get/name',[t.index,t.slot]);
  }else if(prop==='mute'){t.mute=Boolean(a[1]);}
  else if(prop==='name'){t.name=String(a[1]||'');if(t.index<names.length)names[t.index]=t.name;}
 }else if(address==='/live/clip/get/name'){
  const t=tracks.get(a[0]);if(t&&t.slot===a[1]&&t.slot>=0)t.clip=String(a[2]||'').trim()||'Untitled clip';
 }
 publish();
}
osc.on('message',(packet,remote)=>{if(remote.address!=='127.0.0.1')return;try{const messages=decode(packet);received+=messages.length;for(const msg of messages)handle(msg);}catch{/* Ignore malformed UDP without crashing the stream. */}});
function recover(){
 if(connected&&Date.now()-lastReply>TIMEOUT)disconnect();
 send('/live/song/get/is_playing');
 if(!connected){send('/live/song/get/track_names');return;}
 if(Date.now()-lastBind>=60000){send('/live/song/get/track_names');subscribe();}
 for(const t of tracks.values())if(t.index<names.length){send('/live/track/get/playing_slot_index',[t.index]);send('/live/track/get/mute',[t.index]);if(t.slot>=0)send('/live/clip/get/name',[t.index,t.slot]);}
}
const files=new Map(['/setup.html','/ui.css','/setup.js','/overlay.html','/overlay.js'].map(p=>[p,fs.readFileSync(path.join(ROOT,'public',p))]));
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host;if(!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(host)){res.writeHead(403);return res.end();}
 res.setHeader('X-Content-Type-Options','nosniff');
 let url;try{url=new URL(req.url,'http://127.0.0.1:'+PORT);}catch{return json(res,400,{error:'Invalid URL'});}
 if(req.method==='POST'){
  if(req.headers.origin!=='http://'+host||req.headers['x-setup-token']!==token||req.headers['content-type']!=='application/json')return json(res,403,{error:'Open the setup page to change settings.'});
  let body='';try{for await(const chunk of req){body+=chunk;if(body.length>8192)throw Error('Request too large');}
   if(url.pathname==='/api/config'){
    const next=validate(JSON.parse(body));fs.writeFileSync(CONFIG+'.tmp',JSON.stringify(next,null,2)+'\n');fs.renameSync(CONFIG+'.tmp',CONFIG);
    if(connected)listen('stop_listen');config=next;resetTracks();if(connected){subscribe();send('/live/song/get/track_names');}publish();return json(res,200,{ok:true,config});
   }
   if(url.pathname==='/api/test'){clearTimeout(testTimer);testDisplay=true;publish();testTimer=setTimeout(()=>{testDisplay=false;publish();},20000);return json(res,200,{ok:true});}
   if(url.pathname==='/api/stop'){json(res,200,{ok:true});setTimeout(()=>shutdown(),100);return;}
   if(url.pathname==='/api/reveal'){require('node:child_process').spawn('/usr/bin/open',['-R',TEXTFILE],{stdio:'ignore'}).on('error',()=>{});return json(res,200,{ok:true});}
   if(url.pathname==='/api/install-osc'){
    if(process.platform!=='darwin')throw Error('Installation requires macOS.');
    const input=JSON.parse(body||'{}');
    let library=path.join(require('node:os').homedir(),'Music/Ableton/User Library');
    if(input.choose){
     library=await new Promise((resolve,reject)=>require('node:child_process').execFile('/usr/bin/osascript',['-e','POSIX path of (choose folder with prompt "Select the User Library folder shown in Ableton Settings > Library:")'],(err,stdout)=>err?reject(Error('Folder selection canceled.')):resolve(stdout.trim())));
    }
    if(!fs.existsSync(library))throw Error('The default User Library folder was not found. Use Choose User Library and select the location shown in Ableton Settings > Library.');
    const dest=path.join(library,'Remote Scripts/AbletonOSC');
    if(fs.existsSync(dest))return json(res,200,{ok:true,message:'AbletonOSC already exists here. It was left unchanged. Continue to step 2.'});
    fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(ROOT,'../vendor/AbletonOSC'),dest,{recursive:true,errorOnExist:true,force:false});
    return json(res,200,{ok:true,message:'AbletonOSC installed. Open Ableton and continue to step 2.'});
   }
   if(url.pathname==='/api/rescan'){error='';send('/live/song/get/track_names');if(connected)subscribe();else send('/live/song/get/is_playing');publish();return json(res,200,{ok:true});}
   return json(res,404,{error:'Not found'});
  }catch(e){return json(res,400,{error:e.message});}
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(url.pathname==='/api/config')return json(res,200,{config,token,textFile:TEXTFILE});
 if(url.pathname==='/health'||url.pathname==='/api/status')return json(res,200,{...state(),diagnostics:{sent,received,updates,clients:clients.size,recoverySeconds:RECOVERY/1000}});
 if(url.pathname==='/events'){
  if(clients.size>=16)return json(res,503,{error:'Too many overlay windows. Close unused previews.'});
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write('retry: 3000\ndata: '+JSON.stringify(state())+'\n\n');clients.add(res);res.on('close',()=>clients.delete(res));res.on('error',()=>clients.delete(res));return;
 }
 const p=url.pathname==='/'?'/setup.html':url.pathname;
 if(files.has(p)){res.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});return res.end(files.get(p));}
 return json(res,404,{error:'Not found'});
});
let recoveryTimer,keepaliveTimer;
function fail(e){console.error(e.code==='EADDRINUSE'?'A required port is busy. Stop the old widget or other OSC bridge, then start this version again.':e.message);shutdown(1);}
function shutdown(code=0){if(closing)return;if(connected)listen('stop_listen');closing=true;try{fs.writeFileSync(TEXTFILE,'');}catch{}clearTimeout(testTimer);clearInterval(recoveryTimer);clearInterval(keepaliveTimer);clearTimeout(broadcastTimer);for(const res of clients)res.end();server.close();setTimeout(()=>{try{osc.close();}catch{}process.exit(code);},150);}
osc.on('error',fail);server.on('error',fail);
osc.bind(OSC_IN,'127.0.0.1',()=>{
 server.listen(PORT,'127.0.0.1',()=>{started=true;console.log('Ableton Now Playing 1.0\nSetup: http://127.0.0.1:'+PORT+'\nOBS: http://127.0.0.1:'+PORT+'/overlay.html\nUse the setup page to stop the widget.');recover();recoveryTimer=setInterval(recover,RECOVERY);keepaliveTimer=setInterval(()=>{for(const res of clients){if(res.writableLength>65536){res.destroy();clients.delete(res);}else res.write(': keepalive\n\n');}},25000);});
});
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
