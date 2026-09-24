// Painel da peça selecionada: leituras, aviso didático e botões de editar.
import {S} from '../state.js';
import {$,makeSel,mkBtn} from '../../ui.js';
import {LEDP} from '../../sim/models.js';
import {bypassed} from '../../sim/circuit.js';
import {fmtR,fVn,fV,fA,fW} from '../../format.js';
import {drawAll} from '../draw.js';
import {OPT,save} from '../tools.js';

const NAME={wire:'Fio',bat:'Bateria',res:'Resistor',led:'LED',dio:'Diodo',cap:'Capacitor',npn:'Transistor NPN',sw:'Chave'};
function titleOf(c){return c.type==='bat'?`Bateria de ${fVn(c.p.V)}`:c.type==='res'?`Resistor de ${fmtR(c.p.R)}`:c.type==='led'?`LED ${c.p.color}`:c.type==='cap'?`Capacitor de ${c.p.uF} µF`:NAME[c.type];}
function readings(c){const P2=Math.abs(c.I*c.v);
 switch(c.type){
  case 'bat':return [['Nominal',fVn(c.p.V)],['Nos terminais',fV(c.v)],['Fornecendo',fA(c.I)]];
  case 'res':return [['Tensão',fV(Math.abs(c.v))],['Corrente',fA(c.I)],['Calor',fW(P2)]];
  case 'led':return [['Tensão',fV(c.v)],['Corrente',fA(c.I)],['Limite','20 mA']];
  case 'cap':return [['Guardando',fV(c.v)],['Corrente',fA(c.I)],['Aguenta',fVn(c.p.rate)]];
  case 'npn':return [['Na base',fA(c.Ib)],['No coletor',fA(c.Ic)],['Multiplicou',c.Ib>1e-7?'×'+Math.round(c.Ic/c.Ib):'—']];
  default:return [['Tensão',fV(c.v)],['Corrente',fA(c.I)],['Potência',fW(P2)]];}}
function statusOf(c){
 if(c.burned)return['bad',c.why+' Uma peça queimada abre o circuito. Corrija a montagem e troque a peça.'];
 const I=c.I,a=Math.abs(I);
 if(c.type!=='bat'&&c.type!=='sw'&&bypassed(c,S.comps))return['warn',`Tem um fio ligado direto entre as duas pontas desta peça. A corrente pega esse atalho e passa quase nada por aqui, como se a peça nem estivesse no circuito. Tire o fio com a ferramenta Apagar.`];
 switch(c.type){
  case 'led':{const vf=LEDP[c.p.color].vf;
   if(c.v<-0.5)return['warn','Está ao contrário: o LED só conduz com a perna longa (+) virada para o lado positivo.'];
   if(I<5e-4)return['',`Apagado. Ele precisa de uns ${fVn(vf)} nas pontas e está recebendo ${fV(c.v)}. Confira se o caminho fecha até o − da bateria.`];
   if(I<0.005)return['','Aceso fraquinho: pouca corrente. Um resistor menor deixa mais forte.'];
   if(I<=0.02)return['ok','Aceso na faixa segura, entre 5 e 20 mA.'];
   return['warn','Acima de 20 mA: acende forte, mas esquenta e dura pouco. Aumente o resistor.'];}
  case 'res':{const Pw=I*I*c.p.R;if(Pw>0.2)return['warn',`Esquentando perto do limite de 1/4 W (${fW(Pw)}).`];
   if(a<1e-6)return['','Nenhuma corrente: o caminho está aberto em algum lugar.'];return['ok',`Segurando ${fV(Math.abs(c.v))} e deixando passar ${fA(I)}.`];}
  case 'bat':if(a>3)return['bad','Curto-circuito! Nada limita a corrente e a bateria está esquentando. Tire o fio que liga o + direto no −.'];
   if(a<1e-6)return['','Nenhuma corrente saindo: falta um caminho fechado do + de volta até o −.'];return['ok',`Fornecendo ${fA(I)} para o circuito.`];
  case 'cap':if(c.v<-0.5)return['warn','Tensão invertida: capacitor eletrolítico ligado ao contrário pode estourar.'];
   if(c.v>0.8*c.p.rate)return['warn',`Perto do limite: ${fV(c.v)} de ${fVn(c.p.rate)}.`];
   return['ok',a>1e-4?(I>0?'Enchendo agora.':'Devolvendo a carga agora.'):c.v>0.1?'Parado, com carga guardada. Cheio, ele não deixa corrente contínua passar.':'Vazio.'];
  case 'dio':return I>1e-4?['ok','Conduzindo: deixa a corrente passar e consome uns 0,7 V.']:['','Bloqueando: a corrente não passa nesse sentido, ou falta tensão (precisa de uns 0,7 V).'];
  case 'sw':return c.on?['ok','Ligada: o caminho está fechado.']:['','Desligada: o caminho está aberto e nada passa por aqui.'];
  case 'npn':if(c.Ib<1e-6)return['','Fechado: sem corrente na base, nada passa do coletor para o emissor.'];
   if(c.Vce<0.3)return['ok','Totalmente aberto: a correntinha da base liberou tudo o que o resto do circuito permite.'];
   return['warn',`Parcialmente aberto: ${fA(c.Ib)} na base libera ${fA(c.Ic)}. Mais corrente na base abre mais.`];
  default:return['',a>1e-6?`${fA(I)} passando.`:'Sem corrente.'];}}
export function renderInsp(){const box=$('#s-insp'),c=S.selC;box.replaceChildren();
 if(!c){const h=document.createElement('h3');h.textContent='Peça selecionada';const p=document.createElement('p');p.id='s-probe';box.append(h,p);liveInsp();return;}
 const h=document.createElement('h3');h.textContent=titleOf(c);
 const m=document.createElement('div');m.className='meters';m.id='s-meters';m.style.marginTop='8px';
 const st=document.createElement('div');st.className='status';st.id='s-status';
 const ed=document.createElement('div');ed.className='srow';ed.style.marginTop='12px';
 const upd=()=>{drawAll();save();renderInsp();};
 if(c.type==='bat')ed.append(makeSel('Tensão',OPT.bat,c.p.V,v=>{c.p.V=v;upd();}));
 if(c.type==='res')ed.append(makeSel('Valor',OPT.res,c.p.R,v=>{c.p.R=v;upd();}));
 if(c.type==='led')ed.append(makeSel('Cor',OPT.led,c.p.color,v=>{c.p.color=v;upd();}));
 if(c.type==='cap')ed.append(makeSel('Tamanho',OPT.cap,c.p.uF,v=>{c.p.uF=v;upd();}),makeSel('Aguenta até',OPT.rate,c.p.rate,v=>{c.p.rate=v;upd();}));
 if(c.type==='sw')ed.append(mkBtn(c.on?'Desligar':'Ligar','',()=>{c.on=!c.on;upd();}));
 if(c.burned)ed.append(mkBtn('Trocar a peça','',()=>{c.burned=false;c.why='';c.stress=0;c.vPrev=0;c.warned=false;upd();}));
 ed.append(mkBtn('Tirar da placa','ghost',()=>{S.comps=S.comps.filter(x=>x!==c);S.selC=null;upd();}));
 box.append(h,m,st,ed);liveInsp();}
export function liveInsp(){
 if(!S.selC){const p=$('#s-probe');if(!p)return;
  p.textContent=S.probe===null?'Com a ferramenta Mexer, toque numa peça para ver o que acontece nela, ou num ponto da placa para medir a tensão dele. O − da primeira bateria é o 0 V.':`Tensão nesse ponto: ${fV(S.Vn[S.probe]||0)} em relação ao 0 V.`;return;}
 const m=$('#s-meters'),s=$('#s-status');if(!m)return;
 m.innerHTML=readings(S.selC).map(([l,v])=>`<div class="m"><small>${l}</small><b>${v}</b></div>`).join('');
 const [cls,msg]=statusOf(S.selC);s.className='status '+cls;s.textContent=msg;}
