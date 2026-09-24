import {describe,it,expect} from 'vitest';
import {N} from '../src/grid.js';
import {createSim,pairKey} from '../src/sim/circuit.js';
import {step} from '../src/sim/simulate.js';
import {buildPreset} from '../src/sandbox/presets.js';
import {MISSIONS,missionDone} from '../src/sandbox/missions.js';

const M=id=>MISSIONS.find(m=>m.id===id);
// Começa uma missão como o painel faz: placa com as peças iniciais da missão.
function begin(id){const S=Object.assign(createSim(),{tool:'sel',selC:null});buildPreset(S.comps,M(id).start);return {S,f:{},m:M(id)};}
// Encaixa uma peça como a ferramenta faz: tira o fio que ligava os mesmos dois pontos.
function place(S,part){const [t,a,b]=part;if(t!=='wire'){const k=pairKey({n:[N(...a),N(...b)]});S.comps=S.comps.filter(w=>!(w.type==='wire'&&pairKey(w)===k));}buildPreset(S.comps,[part]);}
const removeWire=(S,a,b)=>{const k=pairKey({n:[N(...a),N(...b)]});S.comps=S.comps.filter(w=>!(w.type==='wire'&&pairKey(w)===k));};
// Roda o circuito por `ms` milissegundos, conferindo a missão como o painel (a cada 16 ms).
function play(t,ms){let r;for(let i=0;i<ms;i++){step(t.S,()=>{});if(i%16===15)r=t.m.check(t.S,t.f);}return r||t.m.check(t.S,t.f);}
const get=(S,type)=>S.comps.find(c=>c.type===type);
const probe=(S,mode,r,b)=>Object.assign(S.mm,{mode,r:N(...r),b:N(...b)});

describe('1. Acenda um LED',()=>{
 const good=[['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:470}],['wire',[2,1],[4,1]],['led',[4,1],[4,2],{color:'vermelho'}],['wire',[4,2],[4,3]],['wire',[4,3],[1,3]]];
 it('placa vazia: nada cumprido',()=>{const t=begin('led');expect(play(t,20).steps).toEqual([false,false,false,false]);});
 it('montagem certa cumpre a missão',()=>{const t=begin('led');good.forEach(p=>place(t.S,p));expect(missionDone(play(t,100))).toBe(true);});
 it('LED ao contrário: avisa',()=>{const t=begin('led');good.map(p=>p[0]==='led'?['led',[4,2],[4,1],p[3]]:p).forEach(p=>place(t.S,p));
  const r=play(t,100);expect(missionDone(r)).toBe(false);expect(r.fb[1]).toMatch(/ao contrário/);});
 it('sem resistor: o LED queima e a missão explica',()=>{const t=begin('led');good.map(p=>p[0]==='res'?['wire',[1,1],[2,1]]:p).forEach(p=>place(t.S,p));
  const r=play(t,300);expect(r.fb[0]).toBe('bad');expect(r.fb[1]).toMatch(/queimou/);});
 it('caminho aberto: pede para fechar',()=>{const t=begin('led');good.filter(p=>!(p[0]==='wire'&&p[1][0]===4&&p[1][1]===3)).forEach(p=>place(t.S,p));
  expect(play(t,50).fb[1]).toMatch(/não fecha/);});
});

describe('2. Uma chave',()=>{
 it('pôr a chave, desligar e ligar cumpre a missão',()=>{const t=begin('chave');
  place(t.S,['sw',[2,1],[3,1]]);let r=play(t,50);expect(r.steps).toEqual([true,true,false]);
  get(t.S,'sw').on=true;r=play(t,50);expect(missionDone(r)).toBe(true);});
 it('chave fora do caminho: avisa',()=>{const t=begin('chave');place(t.S,['sw',[6,4],[7,4]]);
  expect(play(t,50).fb[1]).toMatch(/não está no caminho/);});
});

describe('3. Tensão no LED',()=>{
 it('pontas nos dois lados do LED, em V',()=>{const t=begin('volt');t.S.tool='mm';probe(t.S,'V',[4,1],[4,2]);
  const r=play(t,50);expect(missionDone(r)).toBe(true);expect(r.fb[1]).toMatch(/O LED usa uns 1,9|O LED usa uns 2,0/);});
 it('pontas no mesmo fio: explica o 0 V',()=>{const t=begin('volt');t.S.tool='mm';probe(t.S,'V',[2,1],[3,1]);
  expect(play(t,50).fb[1]).toMatch(/mesmo trecho/);});
});

describe('4. Corrente',()=>{
 it('tirar um fio e fechar o buraco com o multímetro em A',()=>{const t=begin('amp');play(t,30);
  removeWire(t.S,[4,2],[4,3]);let r=play(t,30);expect(r.steps[0]).toBe(true);
  t.S.tool='mm';probe(t.S,'A',[4,2],[4,3]);r=play(t,50);expect(missionDone(r)).toBe(true);});
 it('no começo, sem tirar fio nenhum, o primeiro passo não aparece cumprido',()=>{const t=begin('amp');
  expect(t.m.check(t.S,t.f).steps[0]).toBe(false);expect(play(t,30).steps[0]).toBe(false);});
 it('multímetro em A em paralelo com o LED: explica o atalho',()=>{const t=begin('amp');t.S.tool='mm';probe(t.S,'A',[4,1],[4,2]);
  const r=play(t,50);expect(missionDone(r)).toBe(false);expect(r.fb[1]).toMatch(/paralelo/);});
});

describe('5. Capacitor',()=>{
 it('encher, tirar a bateria e acender o LED com a carga',()=>{const t=begin('cap');const [left,right]=t.S.comps.filter(c=>c.type==='sw');
  left.on=true;let r=play(t,3500);expect(r.steps[0]).toBe(true);
  left.on=false;right.on=true;r=play(t,50);expect(missionDone(r)).toBe(true);});
 it('com as duas chaves ligadas: avisa que é a bateria',()=>{const t=begin('cap');t.S.comps.filter(c=>c.type==='sw').forEach(s=>s.on=true);
  expect(play(t,500).fb[1]).toMatch(/as duas chaves ligadas/);});
});

describe('6. Transistor',()=>{
 it('ligar, olhar o transistor e trocar o resistor da base',()=>{const t=begin('npn');
  get(t.S,'sw').on=true;play(t,50);t.S.selC=get(t.S,'npn');let r=play(t,20);expect(r.steps).toEqual([true,true,false]);
  t.S.comps.find(c=>c.type==='res'&&c.p.R===10000).p.R=100000;r=play(t,50);expect(missionDone(r)).toBe(true);});
});

describe('7. Arduino e LED',()=>{
 it('pino, resistor de 470 Ω e LED em HIGH',()=>{const t=begin('pin');M('pin').ghost.parts.forEach(p=>place(t.S,p));
  get(t.S,'pin').on=true;expect(missionDone(play(t,100))).toBe(true);});
 it('resistor pequeno demais: passa de 20 mA e avisa',()=>{const t=begin('pin');M('pin').ghost.parts.map(p=>p[0]==='res'?['res',p[1],p[2],{R:100}]:p).forEach(p=>place(t.S,p));
  get(t.S,'pin').on=true;const r=play(t,30);expect(missionDone(r)).toBe(false);expect(r.fb[1]).toMatch(/20 mA/);});
});

describe('8. Motor com proteção',()=>{
 it('ligar, pôr o diodo e desligar: o transistor sobrevive',()=>{const t=begin('motor');
  get(t.S,'pin').on=true;let r=play(t,2500);expect(r.steps[0]).toBe(true);
  place(t.S,['dio',[4,2],[4,1]]);r=play(t,100);expect(r.steps[1]).toBe(true);
  get(t.S,'pin').on=false;r=play(t,300);expect(missionDone(r)).toBe(true);});
 it('sem diodo: o transistor queima e a missão explica',()=>{const t=begin('motor');
  get(t.S,'pin').on=true;play(t,2500);get(t.S,'pin').on=false;const r=play(t,100);
  expect(r.fb[0]).toBe('bad');expect(r.fb[1]).toMatch(/pico de tensão/);});
 it('diodo virado: avisa',()=>{const t=begin('motor');place(t.S,['dio',[4,1],[4,2]]);
  expect(play(t,50).fb[1]).toMatch(/lado errado/);});
});
