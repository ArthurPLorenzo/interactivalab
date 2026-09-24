// Aba "Capacitor".
import {$,seg,setStatus,flowSpeed} from '../ui.js';
import {fmtI} from '../format.js';

const K={uF:1000,rating:16,mode:'carga',Vc:0,burst:false,I:0};
let markM,markS,markRt;
let last=null,lastBucket='';

export function initCapacitor(){
 markM=seg('#c-mode',[{label:'Ligar na bateria',v:'carga'},{label:'Ligar no LED',v:'desc'}],v=>{K.mode=v;markM(v);});
 markS=seg('#c-size',[470,1000,2200].map(v=>({label:v+' µF',v})),v=>{K.uF=v;markS(v);$('#c-label').textContent=v+' µF';});
 markRt=seg('#c-rate',[6.3,16,25].map(v=>({label:String(v).replace('.',',')+' V',v})),v=>{K.rating=v;markRt(v);});
 $('#c-reset').onclick=()=>{K.Vc=0;K.burst=false;};
 markM('carga');markS(1000);markRt(16);
 requestAnimationFrame(capLoop);
}

function capLoop(t){
  const dt=last?Math.min(.05,(t-last)/1000):0;last=t;
  const C=K.uF*1e-6;let I=0;
  if(K.burst){K.Vc=0;}
  else if(K.mode==='carga'){I=(9-K.Vc)/1000;K.Vc+=I/C*dt;if(K.Vc>K.rating)K.burst=true;}
  else{I=Math.max(0,(K.Vc-2)/1000);K.Vc=Math.max(0,K.Vc-(I/C+K.Vc*0.02)*dt);}
  const Vc=K.Vc;
  $('#c-fill').setAttribute('height',(60*Math.min(1,Vc/9)).toFixed(1));
  $('#c-fill').setAttribute('y',(162-60*Math.min(1,Vc/9)).toFixed(1));
  const vtxt=Vc.toFixed(1).replace('.',',')+' V';
  $('#c-vtext').textContent=vtxt;$('#c-v').textContent=vtxt;$('#c-i').textContent=fmtI(I<0.00005?0:I);
  $('#c-lever').setAttribute('x2',K.mode==='carga'?140:220);
  $('#c-glow').setAttribute('opacity',K.mode==='desc'?Math.min(1,Math.sqrt(I/0.007)).toFixed(2):0);
  $('#c-boom').setAttribute('opacity',K.burst?1:0);
  const bucket=K.mode+Math.round(I*2000);
  if(bucket!==lastBucket){lastBucket=bucket;flowSpeed($('#c-flow1'),K.mode==='carga'?I:0,0.004);flowSpeed($('#c-flow2'),K.mode==='desc'?I:0,0.004);}
  let st='',msg;
  if(K.burst){st='bad';msg=`Estourou. Um capacitor de ${String(K.rating).replace('.',',')} V não aguenta os 9 V da bateria. A tensão máxima do capacitor tem que ficar acima da do circuito (aqui, 16 V ou 25 V).`;}
  else if(K.mode==='carga'){msg=Vc<8.8?`Enchendo. A corrente começa forte e vai caindo conforme ele enche. Com ${K.uF} µF, ${K.uF>1000?'demora mais':K.uF<1000?'enche rápido':'leva uns segundos'}.`:'Cheio. Repare que a corrente parou: capacitor cheio não deixa corrente contínua atravessar. Agora vire a chave para o LED.';if(Vc>=8.8)st='ok';}
  else{if(Vc>2.15){st='ok';msg='O LED acende com a energia que o capacitor guardou, sem bateria nenhuma. Quanto maior o µF, mais tempo dura.';}
    else if(Vc>0.3)msg='Abaixo de uns 2 V o LED não acende mais. Sobrou um restinho de carga, que vai escoando devagar.';
    else msg='Vazio. Ligue de novo na bateria para encher.';}
  const s=$('#c-status');if(s.textContent!==msg||!s.classList.contains(st||'x'))setStatus(s,st,msg);
  requestAnimationFrame(capLoop);
}
