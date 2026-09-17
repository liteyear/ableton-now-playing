'use strict';
const $=id=>document.getElementById(id);let token='',selected=new Set([0]),trackSignature='',ready=false;
const obsURL=location.origin+'/overlay.html';$('obsURL').textContent=obsURL;
async function post(route,data={}){const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Token':token},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
function paint(s){
 $('status').textContent=s.connected?'Ableton connected':'Waiting for AbletonOSC';$('status').classList.toggle('online',s.connected);
 $('error').textContent=s.error||'';$('now').textContent=s.items?.length?'Current: '+s.items.map(t=>t.clipName).join(' / '):'No selected, unmuted Session clip is playing.';
 const signature=JSON.stringify(s.tracks);if(signature===trackSignature)return;trackSignature=signature;
 $('tracks').replaceChildren();
 if(!s.tracks?.length){$('tracks').textContent='Open Ableton and enable AbletonOSC to see your tracks.';return;}
 for(const t of s.tracks){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(t.index);input.addEventListener('change',()=>{if(input.checked)selected.add(t.index);else selected.delete(t.index);});label.append(input,document.createTextNode((t.index+1)+'. '+t.name));$('tracks').append(label);}
}
$('save').onclick=async()=>{try{$('save').disabled=true;await post('/api/config',{watchTracks:[...selected],artist:$('artist').value,hideWhenIdle:$('hideWhenIdle').checked,selection:$('selection').value,titleFormat:$('titleFormat').value});$('message').textContent='Saved. OBS will use these settings automatically.';}catch(e){$('message').textContent=e.message;}finally{$('save').disabled=false;}};
$('rescan').onclick=async()=>{try{await post('/api/rescan');$('message').textContent='Refreshing… check your DJ track selections before saving.';}catch(e){$('message').textContent=e.message;}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(obsURL);$('copy').textContent='Copied';}catch{$('copy').textContent='Select and copy the path above';}};
$('test').onclick=async()=>{try{await post('/api/test');$('testMessage').textContent='Test card is showing for 20 seconds. Check OBS now.';}catch(e){$('testMessage').textContent=e.message;}};
for(const [id,choose] of [['install',false],['choose',true]])$(id).onclick=async()=>{try{$('install').disabled=$('choose').disabled=true;$('installMessage').textContent='Installing…';const v=await post('/api/install-osc',{choose});$('installMessage').textContent=v.message;}catch(e){$('installMessage').textContent=e.message;}finally{$('install').disabled=$('choose').disabled=false;}};
let step=Number(localStorage.getItem('anp-step')||0);if(!Number.isInteger(step)||step<0||step>3)step=0;
function show(){const preview=$('preview');preview.src=step===3?obsURL:'about:blank';document.querySelectorAll('.step').forEach((e,i)=>e.hidden=i!==step);$('back').disabled=step===0;$('next').hidden=step===3;$('stepLabel').textContent=(step+1)+' / 4';localStorage.setItem('anp-step',step);}
$('back').onclick=()=>{step--;show();};$('next').onclick=()=>{step++;show();};show();
let stopped=false;
$('stop').onclick=async()=>{try{await post('/api/stop');stopped=true;events?.close();$('status').textContent='Widget stopped';$('stopMessage').textContent='Stopped. You can close this tab. Double-click Ableton Now Playing before your next stream.';document.querySelectorAll('button').forEach(b=>b.disabled=true);}catch(e){$('stopMessage').textContent=e.message;}};
let events;
(async()=>{try{const r=await fetch('/api/config');if(!r.ok)throw Error('Could not load settings');const v=await r.json();token=v.token;selected=new Set(v.config.watchTracks);for(const id of ['artist','selection','titleFormat'])$(id).value=v.config[id];$('hideWhenIdle').checked=v.config.hideWhenIdle;$('save').disabled=false;ready=true;events=new EventSource('/events');events.onmessage=e=>{try{paint(JSON.parse(e.data));}catch{}};events.onerror=()=>{if(stopped)return;$('status').textContent='Widget disconnected. Double-click Ableton Now Playing again.';$('status').classList.remove('online');};}catch(e){$('message').textContent=e.message;}})();
