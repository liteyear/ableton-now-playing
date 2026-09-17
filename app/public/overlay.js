'use strict';
const q=new URLSearchParams(location.search),panel=document.getElementById('panel');let signature='',lastState={hideWhenIdle:true};
function paint(s){
 lastState=s;if(s.testDisplay)s={...s,connected:true,playing:true,items:[{clipName:'Your music. On screen.'}],artist:'Live Session • TEST DISPLAY',hideWhenIdle:false};const items=s.connected&&s.playing?s.items||[]:[],active=items.length>0;
 const hide=q.has('hideIdle')?q.get('hideIdle')==='1':s.hideWhenIdle!==false;
 let title='',meta='';
 if(active){
  title=items.map(t=>t.clipName).join('  /  ');
  if(items.length===1&&s.titleFormat==='artist-title'){
   const match=title.match(/^(.+?)\s[-–—]\s(.+)$/);if(match){meta=match[1];title=match[2];}
  }
  if(!meta)meta=s.artist||'';
 }else title=s.connected?'STANDBY':'WAITING FOR ABLETON';
 const next=JSON.stringify([title,meta,hide,active,s.connected]);if(signature===next)return;signature=next;
 panel.hidden=hide&&!active;document.getElementById('label').textContent=active?'NOW PLAYING':'LIVE SESSION';document.getElementById('title').textContent=title;document.getElementById('meta').textContent=meta;document.getElementById('meta').hidden=!meta;
}
if(q.get('demo')==='1'){paint({connected:true,playing:true,items:[{clipName:'Artist Name - Track Title',trackName:'Deck A'}],artist:'LIVE SESSION',titleFormat:'artist-title',hideWhenIdle:false});}
else{const events=new EventSource('/events');events.onmessage=e=>{try{paint(JSON.parse(e.data));}catch{}};events.onerror=()=>paint({...lastState,connected:false,playing:false,items:[]});}
