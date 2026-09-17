'use strict';
function string(s) { const b=Buffer.from(String(s)+'\0'); const out=Buffer.alloc(Math.ceil(b.length/4)*4); b.copy(out); return out; }
function encode(address,args=[]) {
 const tags=[], parts=[];
 for(const v of args) { if(typeof v==='number'){const b=Buffer.alloc(4); if(Number.isInteger(v)){tags.push('i');b.writeInt32BE(v);}else{tags.push('f');b.writeFloatBE(v);}parts.push(b);}else{tags.push('s');parts.push(string(v));} }
 return Buffer.concat([string(address),string(','+tags.join('')),...parts]);
}
function decode(b,depth=0) {
 if(depth>8||b.length<8)throw Error('Invalid OSC packet');
 let pos=0;
 function str(){const end=b.indexOf(0,pos); if(end<0)throw Error('Unterminated OSC string');const s=b.toString('utf8',pos,end);pos=(end+4)&~3;if(pos>b.length)throw Error('Truncated OSC string');return s;}
 const address=str();
 if(address==='#bundle'){pos=16;if(b.length<pos)throw Error('Truncated bundle');const out=[];while(pos<b.length){if(pos+4>b.length)throw Error('Truncated bundle size');const size=b.readUInt32BE(pos);pos+=4;if(size<8||pos+size>b.length)throw Error('Invalid bundle size');out.push(...decode(b.subarray(pos,pos+size),depth+1));pos+=size;}return out;}
 if(!address.startsWith('/'))throw Error('Invalid OSC address');
 const tags=str();if(!tags.startsWith(','))throw Error('Missing OSC types');const args=[];
 for(const tag of tags.slice(1)){if('if'.includes(tag)){if(pos+4>b.length)throw Error('Truncated OSC number');args.push(tag==='i'?b.readInt32BE(pos):b.readFloatBE(pos));pos+=4;}else if(tag==='s'){args.push(str());}else if(tag==='T'||tag==='F'||tag==='N'){args.push(tag==='N'?null:tag==='T');}else throw Error('Unsupported OSC type');}
 return [{address,args}];
}
module.exports={encode,decode};
