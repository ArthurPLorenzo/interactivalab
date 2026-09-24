import {describe,it,expect} from 'vitest';
import {N} from '../src/grid.js';
import {createSim} from '../src/sim/circuit.js';
import {step} from '../src/sim/simulate.js';
import {readMeter} from '../src/sim/multimeter.js';
import {MOTOR} from '../src/sim/models.js';
import {PRE,buildPreset} from '../src/sandbox/presets.js';

function circuit(parts){const S=createSim();buildPreset(S.comps,parts);return S;}
function run(S,ms,logs=[]){for(let i=0;i<ms;i++)step(S,(msg,cls)=>logs.push({msg,cls}));return logs;}
const find=(S,type)=>S.comps.find(c=>c.type===type);
const logged=(logs,re)=>logs.some(l=>re.test(l.msg));

describe('pino do Arduino',()=>{
 const ledOnPin=[['pin',[1,2],[1,3]],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:220}],['wire',[2,1],[4,1]],['led',[4,1],[4,2],{color:'vermelho'}],['wire',[4,2],[4,3]],['wire',[4,3],[1,3]]];

 it('em HIGH acende um LED com 220 Ω (≈ 12 mA) sem queimar',()=>{
  const S=circuit(ledOnPin);find(S,'pin').on=true;run(S,100);
  expect(find(S,'led').I).toBeGreaterThan(0.010);
  expect(find(S,'led').I).toBeLessThan(0.014);
  expect(find(S,'pin').burned).toBe(false);
 });

 it('em LOW não empurra corrente',()=>{
  const S=circuit(ledOnPin);run(S,100);
  expect(find(S,'led').I).toBeLessThan(1e-6);
 });

 it('queima se passar de 40 mA (pino ligado direto no GND)',()=>{
  const S=circuit([['pin',[1,2],[1,3]],['wire',[1,2],[2,2]],['wire',[2,2],[2,3]],['wire',[2,3],[1,3]]]);
  find(S,'pin').on=true;const logs=run(S,300);
  expect(find(S,'pin').burned).toBe(true);
  expect(logged(logs,/pino do Arduino queimou/)).toBe(true);
 });

 it('queima se ligar um motor direto nele',()=>{
  const S=circuit([['pin',[1,2],[1,3]],['wire',[1,2],[1,1]],['mot',[1,1],[2,1]],['wire',[2,1],[2,3]],['wire',[2,3],[1,3]]]);
  find(S,'pin').on=true;run(S,500);
  expect(find(S,'pin').burned).toBe(true);
 });
});

describe('motor DC',()=>{
 const motorOn=V=>[['bat',[1,2],[1,3],{V}],['wire',[1,2],[1,1]],['mot',[1,1],[2,1]],['wire',[2,1],[2,3]],['wire',[2,3],[1,3]]];

 it('na partida puxa muita corrente; girando, puxa pouca',()=>{
  const S=circuit(motorOn(5));const m=find(S,'mot');
  run(S,5);const start=m.I;
  run(S,3000);
  expect(start).toBeGreaterThan(0.3);
  expect(m.I).toBeGreaterThan(0.02);
  expect(m.I).toBeLessThan(0.1);
  // girando em regime, a força contraeletromotriz k·ω quase iguala a tensão aplicada
  expect(MOTOR.k*m.w).toBeCloseTo(m.v-m.I*MOTOR.R,2);
 });

 it('gira proporcional à corrente (em 3 V e em 6 V, ω ÷ I é o mesmo)',()=>{
  const a=circuit(motorOn(3)),b=circuit(motorOn(6));run(a,3000);run(b,3000);
  const ma=find(a,'mot'),mb=find(b,'mot');
  expect(mb.w).toBeGreaterThan(1.8*ma.w);
  expect((ma.w/ma.I)/(mb.w/mb.I)).toBeCloseTo(1,2);
 });

 it('o multímetro em Ω lê a resistência do enrolamento (8 Ω)',()=>{
  const S=circuit([['mot',[1,1],[2,1]]]);Object.assign(S.mm,{mode:'Ω',r:N(1,1),b:N(2,1)});
  expect(readMeter(S,'mm').slice(0,2)).toEqual(['8,0','Ω']);
 });

 it('ao abrir a chave com o motor girando, dá um pico de tensão e faísca na chave',()=>{
  const S=circuit([['bat',[1,2],[1,3],{V:5}],['wire',[1,2],[1,1]],['sw',[1,1],[2,1]],['mot',[2,1],[3,1]],['wire',[3,1],[3,3]],['wire',[3,3],[1,3]]]);
  find(S,'sw').on=true;run(S,2000);
  find(S,'sw').on=false;const logs=run(S,20);
  const m=find(S,'mot');
  expect(m.lastSpike).toBeGreaterThan(50);
  expect(logged(logs,/Faísca na chave/)).toBe(true);
 });
});

describe('diodo de proteção (flyback)',()=>{
 function cycle(preset){
  const S=circuit(PRE[preset].s),pin=find(S,'pin'),logs=[];
  pin.on=true;run(S,2500,logs);
  const spinning=find(S,'mot').w;
  pin.on=false;run(S,200,logs);
  return {S,logs,spinning};
 }

 it('sem diodo: ao desligar, o pico do motor queima o transistor',()=>{
  const {S,logs,spinning}=cycle('motor');
  expect(spinning).toBeGreaterThan(500);
  expect(find(S,'npn').burned).toBe(true);
  expect(find(S,'npn').why).toMatch(/pico de tensão do motor/);
  expect(logged(logs,/pico de tensão do motor/)).toBe(true);
 });

 it('com diodo: a corrente dá a volta pelo diodo e o transistor sobrevive',()=>{
  const {S,logs,spinning}=cycle('flyback');
  expect(spinning).toBeGreaterThan(500);
  expect(find(S,'npn').burned).toBe(false);
  expect(find(S,'dio').burned).toBe(false);
  expect(find(S,'mot').lastSpike).toBe(0);
  expect(logged(logs,/diodo de proteção segurou o pico/)).toBe(true);
 });

 it('com diodo, o motor e o pino funcionam normalmente enquanto ligados',()=>{
  const S=circuit(PRE.flyback.s);find(S,'pin').on=true;run(S,2500);
  expect(find(S,'pin').burned).toBe(false);
  expect(Math.abs(find(S,'pin').I)).toBeLessThan(0.02);
  expect(find(S,'dio').I).toBeLessThan(1e-4); // em operação normal o diodo fica bloqueando
 });
});
