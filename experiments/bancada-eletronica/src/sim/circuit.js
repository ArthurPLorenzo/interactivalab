// Estado do circuito e operações sobre a lista de peças.
import {N,cr} from '../grid.js';

export const createSim=()=>({comps:[],Vn:{},dirty:false,mm:{r:null,b:null,next:'r',mode:'V',fuse:true,stress:0,V:0,I:0}});
export const mk=(t,n,p,on)=>({type:t,n:n.slice(),p:Object.assign({},p||{}),on:!!on,burned:false,why:'',stress:0,I:0,v:0,vPrev:0,Ic:0,Ib:0,Vce:0,iL:0,w:0,ang:0,spikeT:0,lastSpike:0});
export const mmOn=mm=>mm.r!==null&&mm.b!==null&&mm.r!==mm.b;
export const pairKey=c=>Math.min(c.n[0],c.n[1])+'-'+Math.max(c.n[0],c.n[1]);

// Fio em linha reta (horizontal, vertical ou diagonal), quebrado em trechos de um ponto ao vizinho.
export function addWire(comps,a,b){const [c1,r1]=cr(a),[c2,r2]=cr(b),dc=c2-c1,dr=r2-r1;
 if(!(dc===0||dr===0||Math.abs(dc)===Math.abs(dr)))return false;
 const s=Math.max(Math.abs(dc),Math.abs(dr)),sx=Math.sign(dc),sy=Math.sign(dr);
 for(let i=0;i<s;i++){const p=N(c1+i*sx,r1+i*sy),q=N(c1+(i+1)*sx,r1+(i+1)*sy);
  if(!comps.some(c=>c.type==='wire'&&((c.n[0]===p&&c.n[1]===q)||(c.n[0]===q&&c.n[1]===p))))comps.push(mk('wire',[p,q]));}
 return true;}
export function groundNode(comps){const b=comps.find(c=>(c.type==='bat'||c.type==='pin')&&!c.burned);if(b)return b.n[1];return comps.length?comps[0].n[0]:null;}
export function bypassed(c,comps){return c.type!=='wire'&&c.type!=='npn'&&comps.some(w=>w!==c&&!w.burned&&(w.type==='wire'||(w.type==='sw'&&w.on))&&pairKey(w)===pairKey(c));}
// Redes: pontos ligados por fios e chaves fechadas viram uma rede só. Devolve a função que diz a rede de um ponto.
export function netsOf(comps){const par={},find=x=>{if(par[x]===undefined)par[x]=x;return par[x]===x?x:(par[x]=find(par[x]));};
 comps.forEach(c=>{if(!c.burned&&(c.type==='wire'||(c.type==='sw'&&c.on)))par[find(c.n[0])]=find(c.n[1]);});return find;}
// Diodo de proteção (flyback): diodo em paralelo com o motor, com o anodo no lado por onde a corrente do motor sai.
// dir > 0: a corrente atravessa o motor do primeiro ponto (n[0]) para o segundo (n[1]).
export function flybackFor(mot,comps,dir=1,net=netsOf(comps)){const out=dir>0?mot.n[1]:mot.n[0],inn=dir>0?mot.n[0]:mot.n[1];
 return comps.find(d=>!d.burned&&(d.type==='dio'||d.type==='led')&&net(d.n[0])===net(out)&&net(d.n[1])===net(inn));}
