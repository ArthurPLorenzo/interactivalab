// Multímetro virtual: medida de resistência e o que aparece no visor (sem tocar no DOM).
import {RW} from './models.js';
import {solve} from './solver.js';
import {num} from '../format.js';

// Ω: injeta 1 A na ponta vermelha com a preta como referência. Com bateria na mesma rede, {live:true}.
export function ohms(S){const mm=S.mm;
 const par={},find=x=>{if(par[x]===undefined)par[x]=x;return par[x]===x?x:(par[x]=find(par[x]));},uni=(a,b)=>{par[find(a)]=find(b);};
 const act=S.comps.filter(c=>!c.burned);
 act.forEach(c=>{if(c.type==='sw'&&!c.on)return;for(let i=1;i<c.n.length;i++)uni(c.n[0],c.n[i]);});
 const nets=[find(mm.r),find(mm.b)];
 if(act.some(c=>c.type==='bat'&&nets.includes(find(c.n[0]))))return {live:true};
 const nodes=new Set([mm.r]);act.forEach(c=>c.n.forEach(x=>nodes.add(x)));nodes.delete(mm.b);
 const list=[...nodes],idx=new Map(list.map((x,i)=>[x,i])),n=list.length;idx.set(mm.b,-1);
 const G=[];for(let i=0;i<n;i++){G.push(new Float64Array(n));G[i][i]=1e-10;}const B=new Float64Array(n);
 const aG=(a,b,g)=>{const i=idx.get(a),j=idx.get(b);if(i>=0)G[i][i]+=g;if(j>=0)G[j][j]+=g;if(i>=0&&j>=0){G[i][j]-=g;G[j][i]-=g;}};
 act.forEach(c=>{if(c.type==='wire'||(c.type==='sw'&&c.on))aG(c.n[0],c.n[1],1/RW);else if(c.type==='res')aG(c.n[0],c.n[1],1/c.p.R);});
 B[idx.get(mm.r)]=1;const x=solve(G,B);return {R:x?x[idx.get(mm.r)]:Infinity};
}

// Visor: devolve [valor, unidade, classe do aviso, mensagem].
export function readMeter(S,tool){const mm=S.mm;
 if(mm.r===null||mm.b===null)return ['- - -','','',mm.r===null&&mm.b===null?(tool==='mm'?'Toque na placa para encostar as pontas.':'Escolha a ferramenta Multímetro e toque na placa para encostar as pontas.'):'Falta encostar a outra ponta.'];
 if(mm.mode==='V'){const v=mm.r===mm.b?0:mm.V,a=Math.abs(v);
  const txt=(v<-0.0005?'-':'')+num(a,a>=100?1:2);
  if(a<0.005)return [txt,'V','','0 V entre as pontas: elas estão no mesmo trecho de fio, ou não há tensão aqui. Para ver a tensão de uma peça, encoste uma ponta de cada lado dela.'];
  if(v<0)return [txt,'V','warn','O sinal de menos só quer dizer que as pontas estão invertidas: a preta está no lado mais positivo. Não estraga nada.'];
  return [txt,'V','ok','Essa é a diferença de tensão entre a ponta vermelha e a preta.'];}
 if(mm.mode==='A'){
  if(!mm.fuse)return ['0,00','mA','bad','Fusível queimado: o multímetro mostra zero, mesmo com corrente de verdade passando. Isso engana muita gente na bancada real. Troque o fusível e meça em série.'];
  const I=mm.r===mm.b?0:mm.I,a=Math.abs(I),sg=I<-1e-7?'-':'';
  const [t,u]=a<1e-3?[sg+Math.round(a*1e6),'µA']:a<1?[sg+num(a*1e3,a<0.01?2:1),'mA']:[sg+num(a,2),'A'];
  if(a<1e-6)return ['0,00','mA','','Nada passando pelo multímetro. Para medir corrente, ele precisa fazer parte do caminho: tire um fio e coloque uma ponta em cada lado do buraco que ficou.'];
  if(a>0.1)return [t,u,'warn','Corrente alta passando pelo multímetro. Se as pontas estão em paralelo com a bateria ou com uma peça, o fusível vai queimar.'];
  return [t,u,'ok',(I<0?'O sinal de menos quer dizer que a corrente entra pela ponta preta. ':'')+'Em série: toda a corrente desse trecho está passando por dentro do multímetro.'];}
 if(mm.r===mm.b)return ['0,0','Ω','ok','As duas pontas estão no mesmo ponto.'];
 const o=ohms(S);
 if(o.live)return ['Err','','bad','Circuito ligado! Resistência só se mede sem alimentação: tire a bateria, ou desligue a chave que a liga ao circuito. Com tensão, a leitura sai errada e o aparelho real pode até ser danificado.'];
 const R=o.R;
 if(!(R<40e6))return ['OL','','','OL quer dizer fora da escala: não há caminho entre as pontas, ou a resistência é enorme. LEDs, diodos, capacitores e transistores não entram nessa medida.'];
 const [t,u]=R<1000?[num(R,1),'Ω']:R<1e6?[num(R/1000,2),'kΩ']:[num(R/1e6,2),'MΩ'];
 return [t,u,'ok',(R<50?'Continuidade: o caminho entre as pontas está fechado. Muitos multímetros apitam aqui. ':'')+'Se a peça ainda está ligada a outras, a leitura inclui os caminhos em paralelo. Para medir só ela, solte uma das pernas.'];
}
