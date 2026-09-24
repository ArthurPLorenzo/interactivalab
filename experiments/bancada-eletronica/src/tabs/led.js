// Aba "LED + resistor".
import {$,seg,setStatus,flowSpeed} from '../ui.js';
import {BC,fmtR,fmtI} from '../format.js';

const RES=[0,47,100,220,330,470,1000,2200,4700,10000];
const LEDS={vermelho:{vf:2.0,c:'#ff3b2f'},verde:{vf:2.2,c:'#39e36b'},azul:{vf:3.1,c:'#3fa9ff'}};
const L={V:9,ri:5,led:'vermelho',burned:null};
const done=new Set();
let markV,markL;

export function initLed(){
 markV=seg('#l-volt',[3,5,9,12].map(v=>({label:v+' V',v})),v=>{L.V=v;updLED();});
 markL=seg('#l-led',Object.keys(LEDS).map(k=>({label:k,v:k})),v=>{L.led=v;updLED();});
 $('#l-r').oninput=e=>{L.ri=+e.target.value;updLED();};
 $('#l-reset').onclick=()=>{L.burned=null;updLED();};
 updLED();
}

function updLED(){
  const {vf,c}=LEDS[L.led],R=RES[L.ri],V=L.V;
  let I=0,P=0,st,msg;
  if(!L.burned&&V>=vf){
    if(R===0)L.burned='Sem resistor, nada limita a corrente. Ela dispara na hora e o LED queima.';
    else{const i=(V-vf)/R;
      if(i>0.03)L.burned=`Iam passar ${Math.round(i*1000)} mA, e o LED aguenta uns 20 mA. Queimou.`;
      else if(i*i*R>0.25)L.burned='O resistor esquentou além de 1/4 W e queimou.';
      else{I=i;P=i*i*R;}}
  }
  if(L.burned){st='bad';msg=L.burned+' Uma peça queimada abre o circuito: a corrente para de vez. Troque a peça e suba o resistor.';done.add(3);}
  else if(V<vf){st='';msg=`${V} V não alcança os ~${vf.toString().replace('.',',')} V que o LED ${L.led} precisa para conduzir. Nenhuma corrente passa, e nenhum resistor resolve: falta tensão.`;if(L.led==='azul'&&V===3)done.add(4);}
  else{const mA=I*1000;
    if(mA>20){st='warn';msg=`Acende forte, mas ${Math.round(mA)} mA passa do limite de 20 mA. O LED esquenta e dura pouco. Suba um degrau no resistor.`;}
    else if(mA>=5){st='ok';msg=`Perfeito: ${fmtI(I)}, dentro da faixa segura (5 a 20 mA). O resistor segurou a sobra de ${(V-vf).toFixed(1).replace('.',',')} V.`;
      if(L.led==='vermelho'&&V===5)done.add(1);if(V===12)done.add(2);}
    else if(mA>0.5){st='';msg=`Acende fraquinho (${fmtI(I)}). O resistor está segurando corrente demais. Tente um menor.`;}
    else{st='';msg='A corrente é tão pequena que o LED quase não acende. Resistor grande demais.';}
  }
  setStatus($('#l-status'),st,msg);
  $('#l-reset').hidden=!L.burned;
  $('#l-i').textContent=fmtI(I);
  $('#l-p').textContent=P>0?(P<0.01?(P*1000).toFixed(1).replace('.',',')+' mW':Math.round(P*1000)+' mW'):'0 mW';
  $('#l-rtxt').textContent=fmtR(R);$('#l-rlabel').textContent=fmtR(R);$('#l-vtext').textContent=V+' V';
  $('#l-res').style.display=R===0?'none':'';
  if(R>0){const s=String(R),b=[BC[+s[0]],BC[+s[1]],BC[s.length-2]];['#l-b1','#l-b2','#l-b3'].forEach((id,k)=>$(id).setAttribute('fill',b[k]));}
  const body=$('#l-ledbody'),glow=$('#l-glow');
  body.setAttribute('fill',L.burned?'#4a4a4a':c);glow.setAttribute('fill',c);
  glow.setAttribute('opacity',Math.min(1,Math.sqrt(I/0.02)).toFixed(2));
  $('#l-smoke').setAttribute('opacity',L.burned?1:0);
  flowSpeed($('#l-flow'),I,0.012);
  const Rid=V>vf?(V-vf)/0.015:0,next=RES.find(r=>r>=Rid&&r>0);
  $('#l-recipe').innerHTML=V<vf?`Com ${V} V não dá: o LED ${L.led} precisa de mais que ${vf.toString().replace('.',',')} V. A saída é usar uma fonte maior.`:
    `<span class="eq">R = (${V} − ${vf.toString().replace('.',',')}) ÷ 0,015 = ${Math.round(Rid)} Ω</span>Use o próximo valor comercial acima: <b>${fmtR(next)}</b>. Mirar em 15 mA deixa uma margem abaixo dos 20 mA.`;
  markV(V);markL(L.led);
  document.querySelectorAll('#l-goals li').forEach(li=>li.classList.toggle('done',done.has(+li.dataset.g)));
}
