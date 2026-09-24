// Desenho da placa do Sandbox em SVG.
import {S} from './state.js';
import {$} from '../ui.js';
import {COLS,ROWS,px,py} from '../grid.js';
import {LEDP} from '../sim/models.js';
import {groundNode,pairKey} from '../sim/circuit.js';
import {BC,fmtR,fVn} from '../format.js';
import {tapComp,tapNode} from './tools.js';

const NS='http://www.w3.org/2000/svg';
const el=(t,a,p)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;};
const HW={wire:0,res:18,bat:5,cap:5,led:10,dio:10,sw:14,pin:17,mot:15};
let gP,gF,gL,gN;

export function initBoard(){const svg=$('#s-board');gP=el('g',{},svg);gF=el('g',{},svg);gL=el('g',{},svg);gN=el('g',{},svg);}

function lab(x,y,t,anchor,p){const e=el('text',{x,y,'text-anchor':anchor||'middle',class:'silk'},p||gL);e.textContent=t;return e;}
function flowEl(x1,y1,x2,y2){const e=el('path',{class:'sflow',d:`M${x1} ${y1}L${x2} ${y2}`},gF);e.style.opacity=0;return {e,x1,y1,x2,y2,dir:1,on:false,q:0};}
function draw2(c,off){
 const [a,b]=c.n;let ox=0,oy=0;
 if(off){const lo=Math.min(a,b),hi=Math.max(a,b),dx=px(hi)-px(lo),dy=py(hi)-py(lo),l=Math.hypot(dx,dy);ox=-dy/l*off;oy=dx/l*off;}
 const x1=px(a)+ox,y1=py(a)+oy,x2=px(b)+ox,y2=py(b)+oy,L=Math.hypot(x2-x1,y2-y1),ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI,m=L/2,h=HW[c.type],Sk='var(--silk)';
 const outer=el('g',{class:'part'+(c.burned?' burned':'')+(S.selC===c?' selected':'')},gP);c._g=outer;
 if(off){el('line',{x1:px(a),y1:py(a),x2:x1,y2:y1,class:'lead'},outer);el('line',{x1:px(b),y1:py(b),x2:x2,y2:y2,class:'lead'},outer);}
 const g=el('g',{transform:`translate(${x1} ${y1}) rotate(${ang})`},outer);
 el('line',{x1:0,y1:0,x2:L,y2:0,class:'hit'},g);
 if(!h)el('line',{x1:0,y1:0,x2:L,y2:0,class:'lead'},g);
 else{el('line',{x1:0,y1:0,x2:m-h,y2:0,class:'lead'},g);el('line',{x1:m+h,y1:0,x2:L,y2:0,class:'lead'},g);}
 if(c.type==='res'){el('rect',{x:m-18,y:-7,width:36,height:14,rx:5,fill:'#e2c592'},g);const s=String(c.p.R);
  [BC[+s[0]],BC[+s[1]],BC[s.length-2]].forEach((col,k)=>el('rect',{x:m-12+k*7,y:-7,width:4,height:14,fill:col},g));el('rect',{x:m+10,y:-7,width:3,height:14,fill:'#c9a227'},g);}
 if(c.type==='bat'){el('line',{x1:m-5,y1:-16,x2:m-5,y2:16,stroke:Sk,'stroke-width':3},g);el('line',{x1:m+5,y1:-8,x2:m+5,y2:8,stroke:Sk,'stroke-width':6},g);}
 if(c.type==='cap'){el('line',{x1:m-5,y1:-14,x2:m-5,y2:14,stroke:Sk,'stroke-width':4},g);el('line',{x1:m+5,y1:-14,x2:m+5,y2:14,stroke:Sk,'stroke-width':4},g);}
 if(c.type==='led'||c.type==='dio'){const col=c.type==='led'?LEDP[c.p.color].c:Sk;
  if(c.type==='led')c._glow=el('circle',{cx:m,cy:0,r:22,fill:col,opacity:0,filter:'url(#sblur)','pointer-events':'none'},g);
  el('polygon',{points:`${m-10},-11 ${m-10},11 ${m+9},0`,fill:c.burned?'#4a4a4a':col,stroke:Sk,'stroke-width':1},g);
  el('line',{x1:m+10,y1:-11,x2:m+10,y2:11,stroke:Sk,'stroke-width':3},g);}
 if(c.type==='pin'){el('rect',{x:m-17,y:-11,width:34,height:22,rx:3,fill:'#00878f',stroke:Sk,'stroke-width':1},g);
  el('circle',{cx:m+10,cy:-5,r:3,fill:c.on&&!c.burned?'#9dff6b':'#1d3b3d'},g);}
 if(c.type==='mot'){el('circle',{cx:m,cy:0,r:15,fill:'#2b2f2c',stroke:Sk,'stroke-width':1.5},g);
  c._rotor=el('g',{},g);el('line',{x1:m-11,y1:0,x2:m+11,y2:0,stroke:'#e0b43a','stroke-width':3,'stroke-linecap':'round'},c._rotor);
  el('circle',{cx:m,cy:0,r:3,fill:Sk},c._rotor);c._rotorM=m;}
 if(c.type==='sw'){el('circle',{cx:m-14,cy:0,r:4,fill:Sk},g);el('circle',{cx:m+14,cy:0,r:4,fill:Sk},g);
  el('line',{x1:m-14,y1:0,x2:c.on?m+14:m+9,y2:c.on?0:-15,stroke:Sk,'stroke-width':3.5,'stroke-linecap':'round'},g);}
 outer.addEventListener('click',()=>tapComp(c));
 const mx=(x1+x2)/2,my=(y1+y2)/2,hz=Math.abs(x2-x1)>=Math.abs(y2-y1);
 const txt=c.type==='pin'?(c.on?'HIGH':'LOW'):c.type==='mot'?'M':c.type==='bat'?fVn(c.p.V):c.type==='res'?fmtR(c.p.R):c.type==='cap'?c.p.uF+' µF':'';
 if(txt){hz?lab(mx,my-16,txt):lab(mx+14,my+4,txt,'start');}
 if(c.type==='bat'||c.type==='cap'||c.type==='pin'){const t=Math.max(0.1,0.5-(h+9)/L),qx=x1+(x2-x1)*t,qy=y1+(y2-y1)*t;hz?lab(qx,qy+20,'+'):lab(qx-12,qy+4,'+');}
 if(c.burned)el('text',{x:mx+4,y:my-4,'font-size':20},gL).textContent=c.type==='cap'?'💥':'💨';
 if(c.type==='mot')c._spark=el('text',{x:mx+10,y:my-12,'font-size':20,opacity:0},gL);
 c._flow=[flowEl(x1,y1,x2,y2)];
}
function drawNPN(c){
 const [nc,nb,ne]=c.n,C=[px(nc),py(nc)],Bp=[px(nb),py(nb)],E=[px(ne),py(ne)];
 const ox=Bp[0]+((C[0]+E[0])/2-Bp[0])*0.5,oy=Bp[1]+((C[1]+E[1])/2-Bp[1])*0.5;
 const g=el('g',{class:'part'+(c.burned?' burned':'')+(S.selC===c?' selected':'')},gP);c._g=g;
 [C,Bp,E].forEach(p=>{el('line',{x1:p[0],y1:p[1],x2:ox,y2:oy,class:'hit'},g);el('line',{x1:p[0],y1:p[1],x2:ox,y2:oy,class:'lead'},g);});
 el('circle',{cx:ox,cy:oy,r:20,fill:'transparent'},g);
 el('circle',{cx:ox,cy:oy,r:14,fill:c.burned?'#5a3a36':'#2b2f2c',stroke:'var(--silk)','stroke-width':1.5},g);
 const L=Math.hypot(E[0]-ox,E[1]-oy)||1,ux=(E[0]-ox)/L,uy=(E[1]-oy)/L;
 el('polygon',{points:`${ox+ux*26},${oy+uy*26} ${ox+ux*18-uy*5},${oy+uy*18+ux*5} ${ox+ux*18+uy*5},${oy+uy*18-ux*5}`,fill:'var(--silk)'},g);
 [[C,'C'],[Bp,'B'],[E,'E']].forEach(([p,t])=>{const dx=ox-p[0],dy=oy-p[1],l=Math.hypot(dx,dy)||1;lab(p[0]+dx*0.45-dy/l*10,p[1]+dy*0.45+dx/l*10+4,t);});
 g.addEventListener('click',()=>tapComp(c));
 if(c.burned)el('text',{x:ox+6,y:oy-10,'font-size':20},gL).textContent='💨';
 c._flow=[flowEl(C[0],C[1],ox,oy),flowEl(Bp[0],Bp[1],ox,oy),flowEl(ox,oy,E[0],E[1])];
}
function drawNodes(){
 const used=new Set();S.comps.forEach(c=>c.n.forEach(x=>used.add(x)));
 const r=(S.tool==='sel'||S.tool==='del')?10:22,gnd=groundNode(S.comps),mm=S.mm;
 for(let k=0;k<COLS*ROWS;k++){const x=px(k),y=py(k),u=used.has(k);
  el('circle',{cx:x,cy:y,r:u?4.5:2.5,fill:'var(--silk)',opacity:u?1:.45,'pointer-events':'none'},gN);
  if(S.pend.includes(k))el('circle',{cx:x,cy:y,r:11,fill:'none',stroke:'var(--flow)','stroke-width':2.5,'pointer-events':'none'},gN);
  if(k===S.probe)el('circle',{cx:x,cy:y,r:9,fill:'none',stroke:'#7fd3ff','stroke-width':2.5,'pointer-events':'none'},gN);
  el('circle',{cx:x,cy:y,r,class:'nodehit'},gN).addEventListener('click',()=>tapNode(k));}
 if(gnd!==null&&used.has(gnd))lab(px(gnd),py(gnd)+22,'0 V','middle',gN);
 [['b','#111'],['r','#e03a2f']].forEach(([k,col])=>{const n=mm[k];if(n===null)return;const x=px(n),y=py(n),ex=k==='r'?205:245;
  el('path',{d:`M${x} ${y} C ${x} ${y+70}, ${ex} ${290}, ${ex} 345`,stroke:col,'stroke-width':3.5,fill:'none',opacity:.9,'pointer-events':'none'},gN);
  el('circle',{cx:x,cy:y,r:7.5,fill:col,stroke:'#fff','stroke-width':2,'pointer-events':'none'},gN);});
}
export function drawAll(){[gP,gF,gL,gN].forEach(g=>g.replaceChildren());
 const grp={};S.comps.forEach(c=>{if(c.type!=='npn')(grp[pairKey(c)]=grp[pairKey(c)]||[]).push(c);});
 S.comps.forEach(c=>{if(c.type==='npn')return drawNPN(c);const g=grp[pairKey(c)],i=g.indexOf(c);draw2(c,g.length>1?(i-(g.length-1)/2)*(g.some(x=>x.type==='mot'||x.type==='pin')?38:24):0);});
 drawNodes();}
function setFlow(f,I){const a=Math.abs(I);
 if(!(a>=2e-5)||!isFinite(a)){if(f.on){f.e.style.opacity=0;f.on=false;}return;}
 const dir=I>0?1:-1;if(dir!==f.dir){f.dir=dir;f.e.setAttribute('d',dir>0?`M${f.x1} ${f.y1}L${f.x2} ${f.y2}`:`M${f.x2} ${f.y2}L${f.x1} ${f.y1}`);}
 const q=Math.round(Math.max(.25,Math.min(4,0.01/a))*10)/10;if(q!==f.q){f.q=q;f.e.style.animationDuration=q+'s';}
 if(!f.on){f.e.style.opacity=1;f.on=true;}}
// Atualiza só o que muda a cada quadro: setas de corrente, brilho do LED, bateria quente.
export function visuals(){for(const c of S.comps){if(!c._flow)continue;
 if(c.type==='npn'){setFlow(c._flow[0],c.Ic);setFlow(c._flow[1],c.Ib);setFlow(c._flow[2],c.Ic+c.Ib);}
 else setFlow(c._flow[0],c.type==='bat'||c.type==='pin'?-c.I:c.I);
 if(c._rotor){const deg=(c.ang*0.02*180/Math.PI)%360;c._rotor.setAttribute('transform',`rotate(${deg.toFixed(1)} ${c._rotorM} 0)`);}
 if(c._spark){c._spark.textContent='⚡';c._spark.setAttribute('opacity',c.spikeT>5?1:0);}
 if(c._glow)c._glow.setAttribute('opacity',c.burned?0:Math.min(1,Math.sqrt(Math.max(0,c.I)/0.02)).toFixed(2));
 if(c.type==='bat'&&c._g)c._g.classList.toggle('hot',!c.burned&&Math.abs(c.I)>3);}}
