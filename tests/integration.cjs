const {spawn}=require('node:child_process'),dgram=require('node:dgram'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../app'),{encode,decode}=require(path.join(ROOT,'osc'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'np-test-'));fs.copyFileSync(path.join(ROOT,'config.json'),path.join(temp,'config.json'));
const base='http://127.0.0.1:33210',sock=dgram.createSocket('udp4');let child,online=true,playing=0,dropNames=0,queries=[],subs=new Set();let tracks=[{name:'Deck A',slot:-1,mute:0,clip:'Björk - Jóga'},{name:'Deck B',slot:-1,mute:0,clip:'Boards of Canada - Roygbiv'}];
function reply(a,args=[]){if(online)sock.send(encode(a,args),33211,'127.0.0.1');}
function track(index,prop,v){tracks[index][prop]=v;reply('/live/track/get/'+({slot:'playing_slot_index'}[prop]||prop),[index,v]);}
sock.on('message',packet=>{for(const {address,args} of decode(packet)){
queries.push(address);if(!online)continue;
let effective=address.replace('/start_listen/','/get/');if(address.includes('/stop_listen/')){subs.delete(address.replace('/stop_listen/','/start_listen/')+':'+args);continue;}
if(address.includes('/start_listen/'))subs.add(address+':'+args);
if(effective==='/live/song/get/is_playing')reply(effective,[playing]);
else if(effective==='/live/song/get/track_names')reply(effective,tracks.map(t=>t.name));
else if(effective.startsWith('/live/track/get/')){const prop=effective.split('/').pop(),t=tracks[args[0]];if(t)reply(effective,[args[0],t[{playing_slot_index:'slot'}[prop]||prop]]);}
else if(effective==='/live/clip/get/name'){if(dropNames>0){dropNames--;continue;}const t=tracks[args[0]];if(t&&t.slot===args[1])reply(effective,[...args,t.clip]);}
}});
await new Promise(r=>sock.bind(33212,'127.0.0.1',r));
child=spawn(process.execPath,[path.join(ROOT,'server.js')],{env:{...process.env,NP_CONFIG:path.join(temp,'config.json'),NP_HTTP_PORT:'33210',NP_OSC_IN:'33211',NP_OSC_OUT:'33212',NP_RECOVERY_MS:'100',NP_TIMEOUT_MS:'350'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
async function state(){return (await fetch(base+'/health')).json();}
async function until(fn,label){for(let i=0;i<70;i++){try{const s=await state();if(fn(s))return s;}catch{}await sleep(30);}throw Error('Timed out: '+label+'\n'+log);}
let token;async function config(v){const r=await fetch(base+'/api/config',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Setup-Token':token},body:JSON.stringify(v)});return r;}
const settings={watchTracks:[0,1],artist:'LIVE SET',hideWhenIdle:true,selection:'latest',titleFormat:'artist-title'};
try{
await until(s=>s.connected,'connect');token=(await(await fetch(base+'/api/config')).json()).token;
assert.equal((await config(settings)).status,200);await sleep(100);
playing=1;reply('/live/song/get/is_playing',[1]);track(0,'slot',0);
await until(s=>s.items[0]?.clipName==='Björk - Jóga','unicode clip');await sleep(70);assert.equal(fs.readFileSync(path.join(temp,'Now-Playing.txt'),'utf8'),'Jóga\nBjörk');console.log('PASS launch + Unicode name + native text output');
track(1,'slot',2);await until(s=>s.items[0]?.trackIndex===1,'newest deck');console.log('PASS latest deck selection');
track(1,'mute',1);await until(s=>s.items[0]?.trackIndex===0,'mute');console.log('PASS muted deck excluded');
playing=0;reply('/live/song/get/is_playing',[0]);await until(s=>!s.playing&&!s.items.length,'transport stopped');await sleep(70);assert.equal(fs.readFileSync(path.join(temp,'Now-Playing.txt'),'utf8'),'');console.log('PASS global stop clears overlay and native text');
playing=1;reply('/live/song/get/is_playing',[1]);await until(s=>s.items.length===1,'transport resumes');
track(1,'mute',0);assert.equal((await config({...settings,selection:'all'})).status,200);await until(s=>s.items.length===2,'all mode');console.log('PASS simultaneous tracks');
tracks[0].clip='Renamed clip';await until(s=>s.items.some(t=>t.clipName==='Renamed clip'),'rename recovery');console.log('PASS rename without relaunch');
dropNames=1;tracks[0].clip='Next song';track(0,'slot',3);await until(s=>s.items.some(t=>t.clipName==='Next song'),'lost name reply recovery');console.log('PASS dropped name reply recovers');
reply('/live/clip/get/name',[0,0,'STALE SONG']);await sleep(70);assert(!(await state()).items.some(t=>t.clipName==='STALE SONG'));console.log('PASS stale slot reply ignored');
sock.send(Buffer.from('/bad\0\0\0\0,i\0\0'),33211,'127.0.0.1');await sleep(50);assert.equal((await state()).connected,true);console.log('PASS malformed OSC cannot crash bridge');
online=false;await until(s=>!s.connected&&!s.items.length,'disconnect');online=true;tracks[0].clip='Reconnect same slot';await until(s=>s.items.some(t=>t.clipName==='Reconnect same slot'),'reconnect');console.log('PASS disconnect and same-slot reconnect');
tracks=[{name:'New Set Deck',slot:0,mute:0,clip:'New Set Track'}];reply('/live/startup');await until(s=>s.items.length===1&&s.items[0].clipName==='New Set Track','new set');console.log('PASS Ableton restart / new set');
const invalid=await config({...settings,watchTracks:[-1]});assert.equal(invalid.status,400);
const forbidden=await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});assert.equal(forbidden.status,403);console.log('PASS invalid config and cross-origin write rejected');
assert(!queries.some(q=>/playing_position|current_song_time|output_meter|arrangement|\/set\//.test(q)));console.log('PASS no position/meter scans or playback mutations');
await sleep(180);const mtime=fs.statSync(path.join(temp,'Now-Playing.txt')).mtimeMs;const before=(await state()).diagnostics.updates;await sleep(350);assert.equal((await state()).diagnostics.updates,before);assert.equal(fs.statSync(path.join(temp,'Now-Playing.txt')).mtimeMs,mtime);console.log('PASS no repeated UI updates or file writes at steady state');
child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));assert.equal(subs.size,0);assert.equal(fs.readFileSync(path.join(temp,'Now-Playing.txt'),'utf8'),'');console.log('PASS clean listener teardown');
console.log('ALL INTEGRATION CHECKS PASSED');
}finally{if(child.exitCode===null)child.kill('SIGKILL');sock.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
