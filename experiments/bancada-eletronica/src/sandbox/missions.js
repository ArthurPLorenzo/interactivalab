// Missões guiadas do Sandbox. Cada missão olha o que está acontecendo no circuito (não a posição exata
// das peças), marca os passos cumpridos e diz o que corrigir. Sem DOM: testadas em tests/missions.test.js.
//
// check(S, f) → { steps: [bool…], fb: [classe, mensagem] }
//   S: estado do Sandbox (peças, multímetro, ferramenta, peça selecionada)
//   f: anotações da missão (coisas que já aconteceram, como "o capacitor já encheu")
import {PRE} from './presets.js';
import {netsOf,flybackFor} from '../sim/circuit.js';
import {rpm} from '../sim/models.js';
import {fA,fV,fmtR} from '../format.js';

const all=(S,t)=>S.comps.filter(c=>c.type===t);
const alive=(S,t)=>all(S,t).filter(c=>!c.burned);
const one=(S,t)=>alive(S,t)[0];
const lit=c=>c&&!c.burned&&c.I>=0.005&&c.I<=0.02;
const dark=S=>alive(S,'led').every(l=>l.I<5e-4);

// Problemas comuns com LEDs, na ordem em que vale a pena avisar.
function ledTrouble(S){
 const burned=all(S,'led').find(l=>l.burned);
 if(burned)return['bad','O LED queimou: passou corrente demais por ele. Toque nele com a ferramenta Mexer e aperte "Trocar a peça". Ele precisa de um resistor no mesmo caminho.'];
 const rev=alive(S,'led').find(l=>l.v<-0.5);
 if(rev)return['warn','O LED está ao contrário. Ele só conduz com a perna longa (+) virada para o lado do + da fonte. Apague e coloque de novo, tocando primeiro no lado do +.'];
 const hot=alive(S,'led').find(l=>l.I>0.02);
 if(hot)return['warn',`O LED acende forte demais: ${fA(hot.I)}, acima dos 20 mA que ele aguenta bem. Use um resistor maior.`];
 return null;
}
const sameNets=(S,a,b,c)=>{const net=netsOf(S.comps),p=[net(a),net(b)],q=[net(c.n[0]),net(c.n[1])];return p[0]!==p[1]&&p.includes(q[0])&&p.includes(q[1]);};

export const MISSIONS=[
 {id:'led',title:'Acenda um LED',
  intro:'Todo circuito precisa de um caminho fechado: a corrente sai do + da bateria, passa pelas peças e volta ao −. O resistor limita a corrente para o LED não queimar.',
  start:[],
  ghost:{parts:PRE.led.s},
  steps:[
   {text:'Ponha uma bateria na placa',how:'Escolha "Bateria", toque num ponto para o + e num ponto vizinho para o −.'},
   {text:'Ponha um resistor',how:'Escolha "Resistor" e toque em dois pontos vizinhos. O valor padrão, 470 Ω, serve bem para 9 V.'},
   {text:'Ponha um LED',how:'Escolha "LED". Toque primeiro onde vai a perna longa (+), depois a curta (−).'},
   {text:'Feche o caminho: o LED acende entre 5 e 20 mA',how:'Use "Fio" para ligar: + da bateria → resistor → LED (+ antes do −) → − da bateria.'}],
  check(S){
   const led=alive(S,'led').find(lit),bat=one(S,'bat');
   const steps=[!!bat,all(S,'res').length>0,all(S,'led').length>0,!!led];
   if(led)return{steps,fb:['ok',`Aceso com ${fA(led.I)}. O resistor segurou a sobra de tensão e a corrente ficou na faixa segura.`]};
   const t=ledTrouble(S);if(t)return{steps,fb:t};
   if(steps[0]&&steps[1]&&steps[2]&&Math.abs(bat.I)<1e-5)return{steps,fb:['','O caminho ainda não fecha. A corrente precisa sair do + da bateria, passar pelo resistor e pelo LED e voltar ao −. Ligue os pontos com fios.']};
   if(steps[2]&&!all(S,'res').length)return{steps,fb:['warn','Falta o resistor: sem ele, nada limita a corrente e o LED queima.']};
   return{steps,fb:['','Siga os passos. Se quiser ajuda, aperte "Mostrar onde encaixar".']};}},

 {id:'chave',title:'Uma chave para ligar e desligar',
  intro:'Uma chave abre e fecha o caminho. Aberto em qualquer ponto, a corrente para no circuito inteiro.',
  start:PRE.led.s,
  ghost:{parts:[['sw',[2,1],[3,1]]]},
  steps:[
   {text:'Ponha uma chave no caminho da corrente',how:'Escolha "Chave" e toque em dois pontos vizinhos que estão ligados por fio no caminho. O fio entre eles sai sozinho.'},
   {text:'Com a chave desligada, o LED apaga',how:'Com a ferramenta Mexer, toque na chave para desligar.'},
   {text:'Ligue a chave de novo: o LED acende',how:'Com a ferramenta Mexer, toque na chave de novo.'}],
  check(S,f){
   const sw=alive(S,'sw'),led=alive(S,'led').find(lit);
   if(sw.length&&sw.every(s=>!s.on)&&dark(S))f.off=true;
   if(f.off&&sw.some(s=>s.on)&&led)f.on=true;
   const steps=[sw.length>0,!!f.off,!!f.on];
   if(f.on)return{steps,fb:['ok','A chave comanda o LED: desligada, o caminho abre e nada passa; ligada, a corrente volta.']};
   const t=ledTrouble(S);if(t)return{steps,fb:t};
   if(sw.length&&sw.every(s=>!s.on)&&!dark(S))return{steps,fb:['warn','A chave está desligada, mas o LED continua aceso: ela não está no caminho da corrente. A chave precisa ficar entre dois pontos do caminho, não ao lado dele.']};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'volt',title:'Meça a tensão no LED',
  intro:'Tensão se mede em paralelo: uma ponta do multímetro de cada lado da peça. O multímetro não atrapalha o circuito.',
  start:PRE.led.s,
  ghost:{probes:{r:[4,1],b:[4,2]}},
  steps:[
   {text:'Pegue o multímetro',how:'Escolha a ferramenta "Multímetro".'},
   {text:'Deixe no modo V (tensão)',how:'No painel do multímetro, escolha "V tensão".'},
   {text:'Encoste as pontas nos dois lados do LED',how:'Toque de um lado do LED para a ponta vermelha e do outro lado para a preta.'}],
  check(S){
   const mm=S.mm,led=one(S,'led'),on=mm.r!==null&&mm.b!==null&&mm.r!==mm.b;
   const across=on&&led&&sameNets(S,mm.r,mm.b,led);
   const steps=[S.tool==='mm'||on,mm.mode==='V',!!(across&&mm.mode==='V'&&Math.abs(mm.V)>1)];
   if(steps[2])return{steps,fb:['ok',`O LED usa uns ${fV(Math.abs(mm.V))}. O resto da tensão da bateria fica no resistor: meça ele também e some as duas.`+(mm.V<0?' O sinal de menos só quer dizer que as pontas estão trocadas.':'')]};
   if(on&&mm.mode==='V'){const net=netsOf(S.comps);
    if(net(mm.r)===net(mm.b))return{steps,fb:['','As duas pontas estão no mesmo trecho de fio, então dá 0 V. Ponha uma de cada lado do LED.']};
    return{steps,fb:['',`Isso é a tensão de outro trecho: ${fV(mm.V)}. Para o LED, uma ponta de cada lado dele.`]};}
   if(on&&mm.mode!=='V')return{steps,fb:['warn','O multímetro não está medindo tensão. Mude para "V tensão".']};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'amp',title:'Meça a corrente',
  intro:'Corrente se mede em série: a corrente precisa passar por dentro do multímetro. Então é preciso abrir o caminho e pôr o multímetro no buraco.',
  start:PRE.led.s,
  ghost:{cut:[[4,2],[4,3]],probes:{r:[4,2],b:[4,3]}},
  steps:[
   {text:'Tire um fio do caminho (o LED apaga)',how:'Escolha "Apagar" e toque no meio de um fio do caminho, por exemplo o fio curto logo abaixo do LED.'},
   {text:'Pegue o multímetro no modo A (corrente)',how:'Escolha "Multímetro" e, no painel dele, "A corrente".'},
   {text:'Feche o buraco com as pontas: o LED acende e o visor mostra a corrente',how:'Toque de um lado do buraco para a ponta vermelha e do outro lado para a preta.'}],
  check(S,f){
   const mm=S.mm,led=alive(S,'led').find(lit),on=mm.r!==null&&mm.b!==null&&mm.r!==mm.b,bat=one(S,'bat');
   // "abriu" só vale depois de o circuito ter sido visto fechado (no começo, antes de simular, tudo é zero)
   if(bat&&Math.abs(bat.I)>1e-4)f.closed=true;
   if(f.closed&&bat&&Math.abs(bat.I)<1e-5)f.open=true;
   const inSeries=on&&mm.mode==='A'&&mm.fuse&&led&&Math.abs(mm.I-led.I)<0.1*led.I;
   const steps=[!!f.open||inSeries,mm.mode==='A'&&(S.tool==='mm'||on),!!inSeries];
   if(inSeries)return{steps,fb:['ok',`Em série: ${fA(mm.I)} passam pelo multímetro, a mesma corrente do LED. Numa volta só, a corrente é igual em todos os pontos.`]};
   if(!mm.fuse)return{steps,fb:['bad','O fusível do multímetro queimou. No modo A ele é quase um fio: encostado dos dois lados de uma peça ou da bateria, vira um atalho. Troque o fusível e ponha as pontas no buraco do fio que você tirou.']};
   if(on&&mm.mode==='A'&&Math.abs(mm.I)>1e-3&&dark(S))return{steps,fb:['warn','O multímetro está em paralelo com uma peça: a corrente pega o atalho por ele e o LED apaga. As pontas vão nos dois lados de um buraco no caminho, onde antes havia um fio.']};
   if(on&&mm.mode==='V'&&f.open)return{steps,fb:['warn','No modo V o multímetro não deixa corrente passar, então o LED fica apagado. Mude para "A corrente".']};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'cap',title:'Energia guardada no capacitor',
  intro:'O capacitor é um pequeno reservatório: enche com a bateria e depois devolve a carga, mesmo sem bateria.',
  start:PRE.cap.s,
  steps:[
   {text:'Ligue a chave da esquerda e encha o capacitor (acima de 8 V)',how:'Com a ferramenta Mexer, toque na chave da esquerda e espere. Toque no capacitor para ver quanto ele guarda.'},
   {text:'Desligue a chave da esquerda (a bateria sai do circuito)',how:'Toque de novo na chave da esquerda.'},
   {text:'Ligue a chave da direita: o LED acende só com a carga guardada',how:'Toque na chave da direita.'}],
  check(S,f){
   const [left,right]=all(S,'sw'),cap=one(S,'cap'),led=one(S,'led');
   if(cap&&cap.v>8)f.full=true;
   if(f.full&&left&&!left.on)f.alone=true;
   if(f.alone&&left&&!left.on&&right&&right.on&&led&&led.I>1e-3)f.done=true;
   const steps=[!!f.full,!!f.alone,!!f.done];
   if(f.done)return{steps,fb:['ok','O LED acendeu com a energia do capacitor, sem bateria nenhuma. Ele vai apagando conforme o capacitor esvazia: quanto maior o capacitor, mais tempo dura.']};
   if(all(S,'cap').some(c=>c.burned))return{steps,fb:['bad','O capacitor estourou. Toque nele e troque a peça.']};
   if(left&&right&&left.on&&right.on)return{steps,fb:['warn','Com as duas chaves ligadas, quem acende o LED é a bateria, não o capacitor. Desligue a da esquerda.']};
   if(cap&&left&&left.on&&!f.full)return{steps,fb:['',`Enchendo: ${fV(cap.v)}. A corrente começa forte e vai caindo conforme ele enche.`]};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'npn',title:'O transistor é uma torneira',
  intro:'Uma correntinha na base do transistor libera uma corrente bem maior do coletor para o emissor. É assim que um circuito fraco comanda um forte.',
  start:PRE.npn.s,
  steps:[
   {text:'Ligue a chave: o LED acende pelo transistor',how:'Com a ferramenta Mexer, toque na chave.'},
   {text:'Toque no transistor e compare a corrente na base com a do LED',how:'Toque no transistor com a ferramenta Mexer e veja o painel ao lado.'},
   {text:'Troque o resistor da base por um de 100 kΩ ou mais: o LED fica mais fraco',how:'Toque no resistor de 10 kΩ (o que vai para a base) e escolha 100 kΩ ou 1 MΩ.'}],
  check(S,f){
   const q=one(S,'npn'),led=one(S,'led');
   if(q&&lit(led))f.on=true;
   if(f.on&&S.selC&&S.selC.type==='npn'&&q&&q.Ib>1e-6)f.looked=true;
   // o resistor da base é o que tem uma ponta na mesma rede da base do transistor
   const net=netsOf(S.comps),base=q&&S.comps.find(r=>r.type==='res'&&(net(r.n[0])===net(q.n[1])||net(r.n[1])===net(q.n[1])));
   if(f.looked&&base&&base.p.R>=100000&&q.Vce>0.3&&led&&led.I>3e-4)f.weak=true;
   const steps=[!!f.on,!!f.looked,!!f.weak];
   if(f.weak)return{steps,fb:['ok',`Com menos corrente na base (${fA(q.Ib)}), a torneira abre só um pouco: ${fA(led.I)} no LED. O transistor multiplica a corrente da base, uns 100 vezes, até o limite do resto do circuito.`]};
   if(f.looked)return{steps,fb:['ok',`Na base passam só ${fA(q.Ib)}; no LED, ${fA(q.Ic)}. Uma correntinha comandou uma corrente ${Math.round(q.Ic/q.Ib)} vezes maior.`]};
   if(q&&q.burned)return{steps,fb:['bad','O transistor queimou. Toque nele e troque a peça. A base sempre precisa de um resistor.']};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'pin',title:'O Arduino acende um LED',
  intro:'Um pino do Arduino dá 5 V quando está em HIGH, mas aguenta pouca corrente: até 20 mA é o recomendado.',
  start:[],
  ghost:{parts:[['pin',[1,2],[1,3]],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:470}],['wire',[2,1],[4,1]],['led',[4,1],[4,2],{color:'vermelho'}],['wire',[4,2],[4,3]],['wire',[4,3],[1,3]]]},
  steps:[
   {text:'Ponha o pino do Arduino na placa',how:'Escolha "Arduino". Toque primeiro no pino de saída, depois no GND, num ponto vizinho.'},
   {text:'Ligue um resistor e um LED do pino até o GND',how:'Pino → resistor → LED (perna longa antes) → GND, usando fios.'},
   {text:'Mude o pino para HIGH: o LED acende sem passar de 20 mA no pino',how:'Com a ferramenta Mexer, toque no pino do Arduino.'}],
  check(S){
   const p=one(S,'pin'),led=alive(S,'led').find(lit);
   const ok=p&&p.on&&led&&Math.abs(p.I)<=0.02;
   const steps=[all(S,'pin').length>0,all(S,'res').length>0&&all(S,'led').length>0,!!ok];
   if(ok)return{steps,fb:['ok',`O pino fornece ${fA(p.I)} e o LED acende. Um resistor de ${fmtR(one(S,'res')?.p.R||470)} deixa a corrente dentro do que o pino aguenta.`]};
   if(all(S,'pin').some(x=>x.burned))return{steps,fb:['bad','O pino do Arduino queimou: passou de 40 mA. Troque a peça e ponha um resistor maior no caminho.']};
   const t=ledTrouble(S);if(t)return{steps,fb:t};
   if(p&&p.on&&Math.abs(p.I)>0.02)return{steps,fb:['warn',`O pino está fornecendo ${fA(p.I)}, acima dos 20 mA recomendados. Use um resistor maior.`]};
   if(p&&!p.on&&steps[1])return{steps,fb:['','O pino está em LOW (0 V). Com a ferramenta Mexer, toque nele para mudar para HIGH.']};
   if(p&&p.on&&steps[1]&&Math.abs(p.I)<1e-5)return{steps,fb:['','O caminho não fecha: a corrente sai do pino, passa pelo resistor e pelo LED e precisa voltar ao GND do Arduino.']};
   return{steps,fb:['','Siga os passos.']};}},

 {id:'motor',title:'Motor com proteção',
  intro:'O Arduino não aguenta um motor: ele comanda um transistor, e o transistor liga o motor. Só que o motor, ao ser desligado, dá um pico de tensão. Um diodo resolve.',
  start:PRE.motor.s,
  ghost:{parts:[['dio',[4,2],[4,1]]]},
  steps:[
   {text:'Ligue o motor: pino do Arduino em HIGH',how:'Com a ferramenta Mexer, toque no pino do Arduino e espere o motor pegar velocidade.'},
   {text:'Ponha o diodo de proteção em paralelo com o motor, ao contrário',how:'Escolha "Diodo". Toque primeiro no ponto de baixo do motor (o que vai para o transistor), depois no de cima (o do + da bateria).'},
   {text:'Com o diodo no lugar e o motor girando, desligue o pino: o transistor sobrevive',how:'Com o motor girando, toque no pino do Arduino para voltar a LOW.'}],
  check(S,f){
   const m=one(S,'mot'),p=one(S,'pin'),q=all(S,'npn')[0],guard=m&&flybackFor(m,S.comps,1);
   if(m&&Math.abs(rpm(m.w))>3000)f.spun=true;
   if(guard&&m&&Math.abs(rpm(m.w))>3000&&p&&p.on)f.armed=true;
   if(f.armed&&p&&!p.on&&q&&!q.burned&&Math.abs(m.I)<1e-3)f.done=true;
   const steps=[!!f.spun,!!guard,!!f.done];
   if(f.done)return{steps,fb:['ok','O motor desligou e o transistor está inteiro: a corrente da bobina deu a volta pelo diodo em vez de virar um pico de tensão. É por isso que todo circuito de motor com transistor leva esse diodo.']};
   if(q&&q.burned)return{steps,fb:['bad','O transistor queimou com o pico de tensão do motor. Toque nele e troque a peça. Antes de desligar de novo, ponha o diodo de proteção.']};
   const wrong=m&&flybackFor(m,S.comps,-1);
   if(wrong)return{steps,fb:['warn','O diodo está virado para o lado errado: assim ele conduz o tempo todo e faz um curto no motor. A faixa do diodo (o segundo toque) vai no lado do + da bateria.']};
   if(f.spun&&!guard)return{steps,fb:['warn','Cuidado: se você desligar agora, sem o diodo, o pico queima o transistor. Ponha o diodo antes.']};
   return{steps,fb:['','Siga os passos.']};}},
];

export const missionDone=r=>r.steps.every(Boolean);
