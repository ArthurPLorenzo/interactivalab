// Painel das missões guiadas: escolhe a missão, mostra os passos e o que corrigir.
import {S} from '../state.js';
import {$,mkBtn} from '../../ui.js';
import {MISSIONS,missionDone} from '../missions.js';
import {loadBoard} from '../presets.js';
import {drawAll} from '../draw.js';
import {log} from './log.js';
import {updateMeter} from './multimeter.js';

const KEY='bancada-missoes';
let st={cur:0,done:[],active:false,hidden:false},f={},lastKey='';
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.done))st=Object.assign(st,s,{active:false});}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({cur:st.cur,done:st.done,hidden:st.hidden}));}catch(e){}}

// Uma missão libera quando a anterior foi cumprida.
const unlocked=i=>i===0||st.done.includes(MISSIONS[i-1].id)||st.done.includes(MISSIONS[i].id);
const box=()=>$('#s-missions');

export function initMissions(){load();render();}

function start(i){
 const m=MISSIONS[i];st.cur=i;st.active=true;f={};lastKey='';
 S.mm.show=false;loadBoard(m.start,`Missão ${i+1} começou: ${m.title}.`);updateMeter();
 save();render();missionTick();
}

function toggleGhost(){const m=MISSIONS[st.cur];S.ghost=S.ghost?null:m.ghost;drawAll();render();missionTick();}

function render(){lastKey='';
 const el=box();el.replaceChildren();
 const head=document.createElement('div');head.className='m-head';
 const h=document.createElement('h3');h.textContent='Missões guiadas';
 const hide=document.createElement('button');hide.type='button';hide.className='link';
 hide.textContent=st.hidden?'Mostrar as missões':'Esconder as missões';
 hide.onclick=()=>{st.hidden=!st.hidden;save();render();};
 head.append(h,hide);el.append(head);
 if(st.hidden)return;

 const dots=document.createElement('div');dots.className='m-dots';
 MISSIONS.forEach((m,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;
  b.setAttribute('aria-label',`Missão ${i+1}: ${m.title}`+(st.done.includes(m.id)?' (cumprida)':''));b.title=m.title;
  if(st.done.includes(m.id))b.classList.add('done');if(i===st.cur)b.classList.add('cur');
  b.disabled=!unlocked(i);b.onclick=()=>{st.cur=i;st.active=false;S.ghost=null;save();drawAll();render();};dots.append(b);});
 el.append(dots);

 const m=MISSIONS[st.cur];
 const t=document.createElement('h4');t.textContent=`Missão ${st.cur+1}: ${m.title}`;
 const intro=document.createElement('p');intro.textContent=m.intro;
 el.append(t,intro);

 if(!st.active){
  const row=document.createElement('div');row.className='m-row';
  row.append(mkBtn(st.done.includes(m.id)?'Fazer de novo':'Começar esta missão','',()=>start(st.cur)));
  const note=document.createElement('p');note.className='tip';note.textContent='A placa é trocada pelas peças da missão.';
  el.append(row,note);return;
 }
 const ul=document.createElement('ul');ul.className='goals';ul.id='s-m-steps';
 m.steps.forEach(s=>{const li=document.createElement('li');li.append(s.text);const how=document.createElement('span');how.className='how';how.textContent=s.how;how.hidden=true;li.append(how);ul.append(li);});
 const stt=document.createElement('div');stt.className='status';stt.id='s-m-status';stt.setAttribute('aria-live','polite');
 const row=document.createElement('div');row.className='m-row';row.id='s-m-row';
 if(m.ghost)row.append(mkBtn(S.ghost?'Esconder a ajuda da placa':'Mostrar onde encaixar','ghost',toggleGhost));
 row.append(mkBtn('Recomeçar a missão','ghost',()=>start(st.cur)));
 el.append(ul,stt,row);
}

// Chamado pelo laço do Sandbox: confere a missão e atualiza os passos e o aviso.
export function missionTick(){
 if(!st.active||st.hidden)return;
 const m=MISSIONS[st.cur],r=m.check(S,f),key=JSON.stringify(r);
 if(key===lastKey)return;lastKey=key;
 const done=missionDone(r),first=r.steps.indexOf(false);
 document.querySelectorAll('#s-m-steps li').forEach((li,i)=>{li.classList.toggle('done',r.steps[i]);li.querySelector('.how').hidden=i!==first;});
 const stt=$('#s-m-status');if(!stt)return;
 stt.className='status '+(done?'ok':r.fb[0]);
 stt.textContent=(done?'Missão cumprida! ':'')+r.fb[1];
 if(done&&!st.done.includes(m.id)){st.done.push(m.id);save();log(`Missão cumprida: ${m.title}.`);
  document.querySelectorAll('.m-dots button').forEach((b,i)=>{b.disabled=!unlocked(i);b.classList.toggle('done',st.done.includes(MISSIONS[i].id));});}
 const row=$('#s-m-row');
 if(done&&st.cur<MISSIONS.length-1&&row&&!row.querySelector('.m-next')){const b=mkBtn('Próxima missão','',()=>{st.cur++;st.active=false;S.ghost=null;save();drawAll();render();});b.classList.add('m-next');row.prepend(b);}
}
