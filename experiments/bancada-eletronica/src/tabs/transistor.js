// Aba "Transistor".
import {$,seg,setStatus,flowSpeed} from '../ui.js';
import {fmtR,fmtI} from '../format.js';

const RB=[0,1000,10000,100000,1000000];
const T={pressed:false,rb:10000,burned:false};
const ISAT=(9-2-0.2)/470;
let markRb;

export function initTransistor(){
 markRb=seg('#t-rsel',RB.map(v=>({label:v===0?'nenhum':fmtR(v),v})),v=>{T.rb=v;updT();});
 $('#t-press').onclick=()=>{T.pressed=!T.pressed;updT();};
 $('#t-reset').onclick=()=>{T.burned=false;T.pressed=false;updT();};
 updT();
}

function updT(){
  const Rb=T.rb;let Ib=0,Ic=0,st='',msg;
  if(T.pressed&&Rb===0)T.burned=true;
  if(T.burned){st='bad';msg='A base foi ligada direto nos 9 V, sem resistor. A corrente na base disparou e o transistor queimou. Regra: base sempre com resistor.';}
  else if(!T.pressed){msg='Botão solto: nenhuma corrente na base. A torneira fica fechada e o LED apagado, mesmo com 9 V ali do lado.';}
  else{Ib=(9-0.7)/Rb;Ic=Math.min(100*Ib,ISAT);
    if(100*Ib>=ISAT){st='ok';msg=`Uma correntinha de ${fmtI(Ib)} na base abriu a torneira toda: passam ${fmtI(Ic)} pelo LED.`+(Rb===1000?' Funciona, mas gasta na base mais do que precisa. 10 kΩ já bastaria.':' O limite agora é o resistor de 470 Ω do LED.');}
    else{st='warn';msg=`Com só ${fmtI(Ib)} na base, a torneira abre um pouco: ${fmtI(Ic)} no LED. O transistor multiplica a corrente da base (uns 100×). Um resistor de base menor abre mais.`;}}
  setStatus($('#t-status'),st,msg);
  $('#t-reset').hidden=!T.burned;
  $('#t-press').textContent=T.pressed?'Soltar o botão':'Apertar o botão';
  $('#t-btn').setAttribute('x2',T.pressed?140:160);$('#t-btn').setAttribute('y2',T.pressed?90:84);
  $('#t-rb').style.display=Rb===0?'none':'';
  $('#t-rblabel').textContent=Rb===0?'sem resistor':fmtR(Rb);$('#t-rtxt').textContent=fmtR(Rb);
  $('#t-ib').textContent=fmtI(Ib);$('#t-ic').textContent=fmtI(Ic);
  $('#t-g').textContent=Ib>0?'×'+Math.round(Ic/Ib):'—';
  $('#t-glow').setAttribute('opacity',Math.min(1,Math.sqrt(Ic/0.015)).toFixed(2));
  $('#t-body').setAttribute('fill',T.burned?'#5a3a36':'#2b2f2c');
  $('#t-smoke').setAttribute('opacity',T.burned?1:0);
  flowSpeed($('#t-flowc'),Ic,0.01);flowSpeed($('#t-flowb'),Ib,0.0003);
  markRb(Rb);
}
