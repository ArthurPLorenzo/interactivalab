// Estado do circuito e operações sobre a lista de peças.
import {N,cr} from '../grid.js';

export const createSim=()=>({comps:[],Vn:{},dirty:false,mm:{r:null,b:null,next:'r',mode:'V',fuse:true,stress:0,V:0,I:0}});
export const mk=(t,n,p,on)=>({type:t,n:n.slice(),p:Object.assign({},p||{}),on:!!on,burned:false,why:'',stress:0,I:0,v:0,vPrev:0,Ic:0,Ib:0,Vce:0});
export const mmOn=mm=>mm.r!==null&&mm.b!==null&&mm.r!==mm.b;
export const pairKey=c=>Math.min(c.n[0],c.n[1])+'-'+Math.max(c.n[0],c.n[1]);

// Fio em linha reta (horizontal, vertical ou diagonal), quebrado em trechos de um ponto ao vizinho.
export function addWire(comps,a,b){const [c1,r1]=cr(a),[c2,r2]=cr(b),dc=c2-c1,dr=r2-r1;
 if(!(dc===0||dr===0||Math.abs(dc)===Math.abs(dr)))return false;
 const s=Math.max(Math.abs(dc),Math.abs(dr)),sx=Math.sign(dc),sy=Math.sign(dr);
 for(let i=0;i<s;i++){const p=N(c1+i*sx,r1+i*sy),q=N(c1+(i+1)*sx,r1+(i+1)*sy);
  if(!comps.some(c=>c.type==='wire'&&((c.n[0]===p&&c.n[1]===q)||(c.n[0]===q&&c.n[1]===p))))comps.push(mk('wire',[p,q]));}
 return true;}
export function groundNode(comps){const b=comps.find(c=>c.type==='bat'&&!c.burned);if(b)return b.n[1];return comps.length?comps[0].n[0]:null;}
export function bypassed(c,comps){return c.type!=='wire'&&c.type!=='npn'&&comps.some(w=>w!==c&&!w.burned&&(w.type==='wire'||(w.type==='sw'&&w.on))&&pairKey(w)===pairKey(c));}
