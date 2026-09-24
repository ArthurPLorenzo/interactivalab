// Circuitos de exemplo do Sandbox. Pontos em [coluna, linha].
import {S} from './state.js';
import {N} from '../grid.js';
import {mk,addWire} from '../sim/circuit.js';
import {setTool,save} from './tools.js';
import {drawAll} from './draw.js';
import {renderInsp} from './panels/inspector.js';
import {log} from './panels/log.js';

export const PRE={
 led:{m:'Exemplo: LED com resistor de 470 Ω numa bateria de 9 V. Tente trocar o resistor, ou tirá-lo.',
  s:[['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:470}],['wire',[2,1],[4,1]],['led',[4,1],[4,2],{color:'vermelho'}],['wire',[4,2],[4,3]],['wire',[4,3],[1,3]]]},
 npn:{m:'Exemplo: transistor com botão. Com a ferramenta Mexer, toque na chave para mandar corrente para a base.',
  s:[['bat',[1,3],[1,4],{V:9}],['wire',[1,3],[1,1]],['wire',[1,1],[5,1]],['res',[5,1],[5,2],{R:470}],['led',[5,2],[5,3],{color:'verde'}],['npn',[5,3],[4,4],[5,5]],['wire',[5,5],[1,5]],['wire',[1,4],[1,5]],['sw',[2,1],[2,2]],['wire',[2,2],[2,4]],['res',[2,4],[3,4],{R:10000}],['wire',[3,4],[4,4]]]},
 cap:{m:'Exemplo: ligue a chave da esquerda para encher o capacitor. Depois desligue essa e ligue a da direita: o LED acende só com a carga guardada.',
  s:[['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:1000}],['sw',[2,1],[3,1]],['cap',[3,1],[3,2],{uF:1000,rate:16}],['wire',[3,2],[3,3]],['wire',[3,3],[1,3]],['sw',[3,1],[4,1]],['res',[4,1],[5,1],{R:1000}],['led',[5,1],[5,2],{color:'vermelho'}],['wire',[5,2],[5,3]],['wire',[5,3],[3,3]]]},
 curto:{m:'Exemplo: um fio ligando o + direto no −. Toque na bateria para ver a corrente, e espere.',
  s:[['bat',[2,2],[2,3],{V:9}],['wire',[2,2],[3,2]],['wire',[3,2],[3,3]],['wire',[3,3],[2,3]]]}
};
// Monta a lista de peças de um exemplo (sem tocar na tela). Também usada nos testes.
export function buildPreset(comps,s){
 s.forEach(s=>{const t=s[0];if(t==='wire')addWire(comps,N(...s[1]),N(...s[2]));else if(t==='npn')comps.push(mk('npn',[N(...s[1]),N(...s[2]),N(...s[3])]));else comps.push(mk(t,[N(...s[1]),N(...s[2])],s[3]));});
 return comps;}
function resetBoard(){S.comps=[];S.Vn={};S.selC=null;S.probe=null;S.pend=[];S.mm.r=S.mm.b=null;S.mm.next='r';}
export function loadPreset(k){const pr=PRE[k];if(!pr)return;resetBoard();
 buildPreset(S.comps,pr.s);
 save();setTool('sel');renderInsp();log(pr.m);}
export function clearBoard(){resetBoard();save();drawAll();renderInsp();log('Placa limpa.');}
