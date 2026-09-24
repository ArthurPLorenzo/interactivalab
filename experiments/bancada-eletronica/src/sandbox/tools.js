// Ferramentas do Sandbox e o que acontece ao tocar na placa.
import {S} from './state.js';
import {$,makeSel} from '../ui.js';
import {adj} from '../grid.js';
import {mk,addWire,pairKey} from '../sim/circuit.js';
import {fmtR,fVn} from '../format.js';
import {drawAll} from './draw.js';
import {renderInsp} from './panels/inspector.js';
import {updateMeter} from './panels/multimeter.js';
import {log} from './panels/log.js';

const TOOLS=[
 {id:'sel',label:'Mexer'},
 {id:'wire',label:'Fio',taps:['Toque onde o fio começa.','Agora onde ele termina.']},
 {id:'bat',label:'Bateria',taps:['Toque onde fica o + da bateria.','Agora o −, num ponto vizinho.']},
 {id:'res',label:'Resistor',taps:['Toque numa ponta do resistor.','Agora na outra, num ponto vizinho.']},
 {id:'led',label:'LED',taps:['Toque onde vai a perna longa (+).','Agora a perna curta (−), num ponto vizinho.']},
 {id:'dio',label:'Diodo',taps:['Toque na entrada do diodo.','Agora na saída (lado da barra), num ponto vizinho.']},
 {id:'cap',label:'Capacitor',taps:['Toque onde vai o + do capacitor.','Agora o −, num ponto vizinho.']},
 {id:'npn',label:'Transistor',taps:['Toque onde vai o coletor (C).','Agora a base (B), vizinha do coletor.','Agora o emissor (E), vizinho da base.']},
 {id:'sw',label:'Chave',taps:['Toque numa ponta da chave.','Agora na outra, num ponto vizinho.']},
 {id:'pin',label:'Arduino',taps:['Toque onde fica o pino de saída do Arduino (D9).','Agora o GND do Arduino, num ponto vizinho.']},
 {id:'mot',label:'Motor',taps:['Toque numa ponta do motor.','Agora na outra, num ponto vizinho.']},
 {id:'mm',label:'Multímetro'},
 {id:'del',label:'Apagar'}
];
const TIP={
 sel:'Toque numa peça para ver tensão e corrente, ligar ou desligar chaves e trocar valores. Toque num ponto da placa para medir a tensão dele.',
 wire:'Liga pontos. Pode ser comprido, em linha reta ou na diagonal, e conecta todos os pontos por onde passa.',
 bat:'Empurra a corrente. O + fica do lado da placa comprida. O − da primeira bateria vira o 0 V da placa.',
 res:'Limita a corrente. Aguenta 1/4 W: se esquentar mais que isso, queima.',
 led:'Acende com 5 a 20 mA. Precisa de resistor em série e só conduz com a perna longa no lado positivo.',
 dio:'Deixa a corrente passar só no sentido da seta. Consome uns 0,7 V.',
 cap:'Guarda carga. O + é o primeiro ponto que você toca. Acima da tensão máxima, ou invertido, estoura.',
 npn:'Uma correntinha entrando na base libera uma corrente bem maior do coletor para o emissor. Base sempre com resistor.',
 sw:'Abre ou fecha o caminho. Com a ferramenta Mexer, toque nela para ligar e desligar.',
 pin:'Um pino de saída do Arduino: em HIGH dá 5 V, em LOW dá 0 V. Com a ferramenta Mexer, toque nele para trocar. Aguenta no máximo 40 mA: bom para um LED, fraco para um motor.',
 mot:'Gira quando passa corrente. Na partida puxa muita corrente. Se for desligado de repente, dá um pico de tensão: proteja com um diodo em paralelo.',
 mm:'Encoste as pontas nos pontos da placa. A leitura aparece no painel do multímetro, onde você escolhe tensão (V), corrente (A) ou resistência (Ω).',
 del:'Toque na peça que quer tirar da placa.'
};
// Valores que a próxima peça colocada vai ter.
const P={bat:9,res:470,led:'vermelho',cap:1000,rate:16};
export const OPT={bat:[1.5,3,5,9,12].map(v=>[v,fVn(v)]),res:[10,47,100,220,470,1000,2200,4700,10000,47000,100000,1000000].map(v=>[v,fmtR(v)]),
 led:[['vermelho','vermelho'],['verde','verde'],['azul','azul']],cap:[10,100,470,1000,2200].map(v=>[v,v+' µF']),rate:[6.3,16,25].map(v=>[v,fVn(v)])};
const defP=t=>t==='bat'?{V:P.bat}:t==='res'?{R:P.res}:t==='led'?{color:P.led}:t==='cap'?{uF:P.cap,rate:P.rate}:{};
let tb;

export function initTools(){tb=$('#s-tools');
 TOOLS.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.label;b.dataset.t=t.id;b.onclick=()=>setTool(t.id);tb.appendChild(b);});}

function renderParams(){const box=$('#s-params');box.replaceChildren();
 if(S.tool==='bat')box.append(makeSel('Tensão',OPT.bat,P.bat,v=>P.bat=v));
 if(S.tool==='res')box.append(makeSel('Valor',OPT.res,P.res,v=>P.res=v));
 if(S.tool==='led')box.append(makeSel('Cor',OPT.led,P.led,v=>P.led=v));
 if(S.tool==='cap')box.append(makeSel('Tamanho',OPT.cap,P.cap,v=>P.cap=v),makeSel('Aguenta até',OPT.rate,P.rate,v=>P.rate=v));}
function hint(msg,err){const h=$('#s-hint'),mm=S.mm;h.classList.toggle('err',!!err);if(msg){h.textContent=msg;return;}
 if(S.tool==='mm'){h.textContent=mm.next==='r'?(mm.r===null?'Toque onde encostar a ponta vermelha.':'Para medir outra coisa, toque onde encostar a ponta vermelha.'):'Agora toque onde encostar a ponta preta.';return;}
 const t=TOOLS.find(x=>x.id===S.tool);h.textContent=t.taps?t.taps[S.pend.length]:S.tool==='sel'?'Toque numa peça ou num ponto da placa.':'Toque na peça que quer tirar.';}
export function setTool(t){S.tool=t;S.pend=[];if(t==='mm')S.mm.show=true;tb.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$('#s-tip').textContent=TIP[t];renderParams();hint();drawAll();updateMeter();}

export function tapNode(k){const mm=S.mm;
 if(S.tool==='sel'){S.probe=k;S.selC=null;drawAll();renderInsp();return;}
 if(S.tool==='del')return;
 if(S.tool==='mm'){if(mm.next==='r')mm.b=null;mm[mm.next]=k;mm.next=mm.next==='r'?'b':'r';mm.stress=0;drawAll();hint();updateMeter();return;}
 if(S.pend.includes(k)){S.pend=[];drawAll();hint('Cancelado. Comece de novo.');return;}
 const pend=S.pend;pend.push(k);let err=null;
 if(S.tool==='wire'){if(pend.length===2){if(!addWire(S.comps,pend[0],pend[1]))err='O fio precisa ir em linha reta: horizontal, vertical ou diagonal.';else save();S.pend=[];}}
 else if(S.tool==='npn'){
  if(pend.length===2&&!adj(pend[0],pend[1])){err='A base precisa ficar num ponto vizinho ao coletor.';S.pend=[];}
  else if(pend.length===3){if(!adj(pend[1],pend[2])||pend[2]===pend[0])err='O emissor precisa ficar num ponto vizinho à base, diferente do coletor.';else{S.comps.push(mk('npn',pend));save();}S.pend=[];}}
 else if(pend.length===2){if(!adj(pend[0],pend[1]))err='Essa peça vai entre dois pontos vizinhos (lado a lado ou na diagonal).';else{const k=pairKey({n:pend}),before=S.comps.length;S.comps=S.comps.filter(w=>!(w.type==='wire'&&pairKey(w)===k));
  if(S.comps.length<before)log('Tirei o fio que ligava esses dois pontos. Com ele ali, a corrente pegaria o atalho pelo fio e passaria longe da peça nova.');
  S.comps.push(mk(S.tool,pend,defP(S.tool)));save();}S.pend=[];}
 drawAll();hint(err,!!err);}
export function tapComp(c){
 if(S.tool==='del'){S.comps=S.comps.filter(x=>x!==c);if(S.selC===c)S.selC=null;save();drawAll();renderInsp();return;}
 if(S.tool!=='sel')return;
 if(c.type==='sw'||c.type==='pin'){c.on=!c.on;save();}
 S.selC=c;S.probe=null;drawAll();renderInsp();}

export function save(){try{localStorage.setItem('bancada-sbx',JSON.stringify(S.comps.map(c=>({t:c.type,n:c.n,p:c.p,on:c.on}))));}catch(e){}}
export function load(){try{const s=JSON.parse(localStorage.getItem('bancada-sbx')||'null');if(Array.isArray(s)&&s.length){S.comps=s.map(o=>mk(o.t,o.n,o.p,o.on));return true;}}catch(e){}return false;}
