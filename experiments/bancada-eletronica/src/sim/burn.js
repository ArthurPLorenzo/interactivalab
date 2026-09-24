// Regras de queima: depois de cada passo, calcula a corrente de cada peça e acumula "estresse".
// Se a peça passar do limite por tempo suficiente, queima.
import {VT,DT,RW,RINT,RPIN,VPIN,IPIN_MAX,MOTOR,VCE_MAX,dpar,lexp,npnEval,motorBranch} from './models.js';
import {netsOf,flybackFor} from './circuit.js';
import {fmtR,fVn,fV,fA,fW} from '../format.js';

function over(S,c,cond,lim,why,log){if(cond){c.stress+=DT;if(c.stress>=lim){c.burned=true;c.why=why;c.stress=0;S.dirty=true;log(why,'bad');}}else c.stress=Math.max(0,c.stress-DT);}

export function fuseRule(S,log){const mm=S.mm;
 if(Math.abs(mm.I)>0.4){mm.stress+=DT;if(mm.stress>0.02){mm.fuse=false;mm.stress=0;S.dirty=true;
  log(`O fusível do multímetro queimou: passaram ${fA(mm.I)} por ele (o limite é 400 mA). No modo corrente o multímetro é quase um fio. Com as pontas em paralelo com a bateria ou com uma peça, ele vira um atalho.`,'bad');}}
 else mm.stress=Math.max(0,mm.stress-DT);}

export function partRules(S,log){
 const v=x=>S.Vn[x]||0,cuts=[];
 for(const c of S.comps){
  const a=c.n[0],b=c.n[1];c.v=v(a)-v(b);
  if(c.burned){c.I=0;c.Ic=0;c.Ib=0;continue;}
  switch(c.type){
   case 'wire':c.I=c.v/RW;break;
   case 'sw':c.I=c.on?c.v/RW:0;break;
   case 'res':{c.I=c.v/c.p.R;const Pw=c.I*c.I*c.p.R;over(S,c,Pw>0.25,0.3,`Resistor de ${fmtR(c.p.R)} queimou: esquentou ${fW(Pw)}, e ele aguenta 1/4 W.`,log);break;}
   case 'bat':c.I=(c.p.V-c.v)/RINT;
    if(Math.abs(c.I)>3&&!c.warned){c.warned=true;log(`Curto-circuito na bateria de ${fVn(c.p.V)}: ${fA(c.I)} saindo, sem nada para limitar.`,'bad');}
    if(Math.abs(c.I)<1)c.warned=false;
    over(S,c,Math.abs(c.I)>3,1.5,`A bateria de ${fVn(c.p.V)} estragou: ficou em curto-circuito até esquentar demais.`,log);break;
   case 'cap':{const g=c.p.uF*1e-6/DT;c.I=g*(c.v-c.vPrev);c.vPrev=c.v;
    if(c.v<-1.5)over(S,c,true,0.05,'Capacitor estourou: foi ligado ao contrário. Eletrolítico tem lado certo.',log);
    else over(S,c,c.v>c.p.rate,0.05,`Capacitor estourou: recebeu ${fV(c.v)} e aguenta ${fVn(c.p.rate)}.`,log);break;}
   case 'led':case 'dio':{const d=dpar(c);c.I=d.Is*(lexp(c.v/(d.n*VT),d.xm)[0]-1);
    if(c.type==='led')over(S,c,c.I>0.03,0.05,`LED ${c.p.color} queimou: passaram ${fA(c.I)}, e ele aguenta uns 20 mA. Faltou um resistor em série.`,log);
    else over(S,c,c.I>1,0.05,`Diodo queimou: ${fA(c.I)} é demais para ele.`,log);break;}
   case 'pin':c.I=((c.on?VPIN:0)-c.v)/RPIN;
    over(S,c,Math.abs(c.I)>IPIN_MAX,0.1,`O pino do Arduino queimou: passaram ${fA(c.I)} por ele, e um pino aguenta no máximo 40 mA (o recomendado é até 20 mA). Para ligar um motor, o pino só comanda um transistor, e é o transistor que aguenta a corrente.`,log);break;
   case 'mot':{const {G,I0}=motorBranch(c),i=G*c.v+I0,prev=c.iL;c.I=i;c.iL=i;
    c.w+=DT*(MOTOR.k*i-MOTOR.b*c.w)/MOTOR.J;c.ang+=c.w*DT;c.spikeT=Math.max(0,c.spikeT-DT);
    if(Math.abs(prev)>0.02&&Math.abs(i)<0.2*Math.abs(prev))cuts.push([c,prev]);break;}
   case 'npn':{const [nc,nb,ne]=c.n,m=npnEval(v(nc),v(nb),v(ne));c.Ic=m.Ic;c.Ib=m.Ib;c.Vce=v(nc)-v(ne);c.I=c.Ic;
    if(c.Ib>0.05)over(S,c,true,0.05,`Transistor queimou: ${fA(c.Ib)} entrando na base. A base precisa de um resistor.`,log);
    else over(S,c,c.Ic>0.8||c.Ic*c.Vce>0.8,0.1,`Transistor queimou: ${fA(c.Ic)} no coletor é demais para ele.`,log);break;}
  }
 }
 for(const [m,prev] of cuts)motorCut(S,m,prev,log);
}

// A corrente do motor foi cortada de repente (chave aberta, transistor desligado, peça queimada ou tirada).
// A bobina não deixa a corrente sumir: sem um caminho, a energia dela (½·L·I²) vai para a capacitância
// do próprio enrolamento e vira um pico de V = I·√(L/C). O passo de 1 ms é longo demais para ver o pico
// acontecer (ele dura microssegundos), então ele é calculado aqui.
function motorCut(S,m,prev,log){
 const net=netsOf(S.comps),Vs=Math.abs(prev)*Math.sqrt(MOTOR.L/MOTOR.Cs),V=Math.round(Vs);
 if(flybackFor(m,S.comps,Math.sign(prev),net)){
  if(!m.protectLogged){m.protectLogged=true;log(`O diodo de proteção segurou o pico: quando o motor foi desligado, a corrente dele deu a volta pelo diodo e morreu em poucos milésimos de segundo. Sem o diodo, teriam aparecido uns ${V} V.`);}
  return;}
 m.lastSpike=Vs;m.spikeT=6;S.dirty=true;
 const ends=[net(m.n[0]),net(m.n[1])],touches=c=>c.n.some(x=>ends.includes(net(x)));
 let hit=false;
 for(const c of S.comps){if(c.burned||!touches(c))continue;
  if(c.type==='npn'&&Vs>VCE_MAX){c.burned=true;c.stress=0;hit=true;
   c.why=`Transistor queimou com o pico de tensão do motor: uns ${V} V entre coletor e emissor no instante em que desligou, e ele aguenta uns ${VCE_MAX} V. Um diodo de proteção em paralelo com o motor evita isso.`;log(c.why,'bad');}
  if(c.type==='sw'&&!c.on){hit=true;log(`Faísca na chave! Ao abrir, o motor deu um pico de uns ${V} V entre os contatos. Com o tempo, as faíscas gastam a chave. Um diodo de proteção em paralelo com o motor evita isso.`,'bad');}}
 if(!hit)log(`Pico de uns ${V} V ao desligar o motor: a bobina dele não deixa a corrente parar de repente. Um diodo de proteção em paralelo com o motor evita isso.`,'bad');
}
