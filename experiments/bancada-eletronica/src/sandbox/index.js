// Sandbox: liga as peças da interface e roda o simulador a cada quadro.
import {S} from './state.js';
import {$} from '../ui.js';
import {step} from '../sim/simulate.js';
import {initBoard,drawAll,visuals} from './draw.js';
import {initTools,setTool,save,load} from './tools.js';
import {loadPreset,clearBoard} from './presets.js';
import {renderInsp,liveInsp} from './panels/inspector.js';
import {initMeter,updateMeter} from './panels/multimeter.js';
import {log} from './panels/log.js';

let fc=0;
function loop(){
 if(!$('#p-sbx').hidden&&S.comps.length){
  for(let i=0;i<16;i++)step(S,log);
  if(S.dirty){S.dirty=false;drawAll();renderInsp();save();}
  visuals();if(++fc%8===0){liveInsp();updateMeter();}
 }
 requestAnimationFrame(loop);}

export function initSandbox(){
 initBoard();initTools();
 $('#s-preset').onchange=e=>{loadPreset(e.target.value);e.target.value='';};
 $('#s-clear').onclick=clearBoard;
 initMeter();
 if(!load())loadPreset('led');
 setTool('sel');renderInsp();
 requestAnimationFrame(loop);
}
