// Um passo de simulação (DT = 1 ms): análise nodal + Newton-Raphson, depois as regras de queima.
// Fios = 0,01 Ω; bateria = fonte Norton com 0,2 Ω; capacitor por Euler implícito.
import {VT,GMIN,RINT,RW,DT,RMM,RPIN,VPIN,dpar,lexp,npnEval,motorBranch} from './models.js';
import {solve} from './solver.js';
import {groundNode,mmOn} from './circuit.js';
import {fuseRule,partRules} from './burn.js';

export function step(S,log){
 const {comps,mm}=S,Vn=S.Vn;
 const act=comps.filter(c=>!c.burned),gnd=groundNode(comps);if(gnd===null)return;
 const used=new Set();comps.forEach(c=>c.n.forEach(x=>used.add(x)));if(mm.r!==null)used.add(mm.r);if(mm.b!==null)used.add(mm.b);used.delete(gnd);
 const list=[...used],n=list.length,idx=new Map(list.map((x,i)=>[x,i]));idx.set(gnd,-1);
 const V=list.map(x=>Vn[x]||0),vo=x=>{const i=idx.get(x);return i<0?0:V[i];};
 for(let it=0;it<80;it++){
  const G=[];for(let i=0;i<n;i++){G.push(new Float64Array(n));G[i][i]=GMIN;}const B=new Float64Array(n);
  const aG=(a,b,g)=>{const i=idx.get(a),j=idx.get(b);if(i>=0)G[i][i]+=g;if(j>=0)G[j][j]+=g;if(i>=0&&j>=0){G[i][j]-=g;G[j][i]-=g;}};
  const aI=(a,I)=>{const i=idx.get(a);if(i>=0)B[i]+=I;};
  for(const c of act){const a=c.n[0],b=c.n[1];
   if(c.type==='wire'||(c.type==='sw'&&c.on))aG(a,b,1/RW);
   else if(c.type==='res')aG(a,b,1/c.p.R);
   else if(c.type==='bat'){aG(a,b,1/RINT);aI(a,c.p.V/RINT);aI(b,-c.p.V/RINT);}
   else if(c.type==='pin'){const V=c.on?VPIN:0;aG(a,b,1/RPIN);aI(a,V/RPIN);aI(b,-V/RPIN);}
   else if(c.type==='mot'){const {G,I0}=motorBranch(c);aG(a,b,G);aI(a,-I0);aI(b,I0);}
   else if(c.type==='cap'){const g=c.p.uF*1e-6/DT;aG(a,b,g);aI(a,g*c.vPrev);aI(b,-g*c.vPrev);}
   else if(c.type==='led'||c.type==='dio'){const d=dpar(c),vd=vo(a)-vo(b),[e,de]=lexp(vd/(d.n*VT),d.xm),I=d.Is*(e-1),g=d.Is*de/(d.n*VT)+1e-12,Ieq=I-g*vd;aG(a,b,g);aI(a,-Ieq);aI(b,Ieq);}
   else if(c.type==='npn'){const nd=c.n,vs=nd.map(vo),m=npnEval(vs[0],vs[1],vs[2]),pIe=m.pIc.map((v,k)=>-(v+m.pIb[k]));
    [[nd[0],m.Ic,m.pIc],[nd[1],m.Ib,m.pIb],[nd[2],-(m.Ic+m.Ib),pIe]].forEach(([nk,I0,p])=>{const i=idx.get(nk);if(i<0)return;let lin=I0;
     for(let j=0;j<3;j++){lin-=p[j]*vs[j];const jj=idx.get(nd[j]);if(jj>=0)G[i][jj]+=p[j];}B[i]-=lin;});}
  }
  if(mmOn(mm)){if(mm.mode==='V')aG(mm.r,mm.b,1e-7);else if(mm.mode==='A'&&mm.fuse)aG(mm.r,mm.b,1/RMM);}
  const x=solve(G,B);if(!x)break;
  let md=0;for(let i=0;i<n;i++){let d=x[i]-V[i];if(!isFinite(d))d=0;d=Math.max(-1,Math.min(1,d));V[i]+=d;md=Math.max(md,Math.abs(d));}
  if(md<1e-7)break;
 }
 list.forEach((x,i)=>Vn[x]=V[i]);Vn[gnd]=0;
 if(mmOn(mm)){mm.V=(Vn[mm.r]||0)-(Vn[mm.b]||0);mm.I=(mm.mode==='A'&&mm.fuse)?mm.V/RMM:0;fuseRule(S,log);}
 partRules(S,log);
}
