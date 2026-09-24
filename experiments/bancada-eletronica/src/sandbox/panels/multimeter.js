// Painel do multímetro: botões de modo, fusível e o visor.
import {S} from '../state.js';
import {$,seg} from '../../ui.js';
import {readMeter} from '../../sim/multimeter.js';
import {drawAll} from '../draw.js';
import {setTool} from '../tools.js';
import {log} from './log.js';

const MMTIP={
 V:'Tensão: encoste uma ponta de cada lado do que quer medir, em paralelo. O multímetro não atrapalha o circuito.',
 A:'Corrente: o multímetro precisa ficar no caminho da corrente, em série. Tire um fio e encoste uma ponta em cada lado do buraco que ficou. Em muitos multímetros de verdade, a ponta vermelha também muda de entrada para medir corrente.',
 Ω:'Resistência: só com o circuito desligado. Tire a bateria e encoste as pontas nas duas pernas da peça.'
};
let markMM;

export function initMeter(){const mm=S.mm;
 markMM=seg('#s-mm-mode',[{label:'V ⎓ tensão',v:'V'},{label:'A ⎓ corrente',v:'A'},{label:'Ω resistência',v:'Ω'}],v=>{mm.mode=v;mm.stress=0;markMM(v);updateMeter();});
 markMM('V');
 $('#s-mm-off').onclick=()=>{mm.r=mm.b=null;mm.next='r';mm.show=false;if(S.tool==='mm')setTool('sel');else{drawAll();updateMeter();}};
 $('#s-mm-fuse').onclick=()=>{mm.fuse=true;mm.stress=0;log('Fusível do multímetro trocado.');updateMeter();};
}

export function updateMeter(){const mm=S.mm;
 const box=$('#s-mm'),show=S.tool==='mm'||mm.r!==null||mm.b!==null||mm.show;
 box.hidden=!show;if(!show)return;
 $('#s-mm-tip').textContent=MMTIP[mm.mode];
 $('#s-mm-fuse').hidden=mm.fuse||mm.mode!=='A';
 const [v,u,cls,msg]=readMeter(S,S.tool),st=$('#s-mm-status');
 $('#s-mm-val').textContent=v;$('#s-mm-unit').textContent=u;st.className='status '+(cls||'');st.textContent=msg;st.hidden=!msg;
}
