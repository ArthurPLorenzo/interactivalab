import {describe,it,expect} from 'vitest';
import {N} from '../src/grid.js';
import {createSim,addWire,bypassed} from '../src/sim/circuit.js';
import {step} from '../src/sim/simulate.js';
import {readMeter} from '../src/sim/multimeter.js';
import {PRE,buildPreset} from '../src/sandbox/presets.js';

// Monta um circuito a partir da mesma notação dos exemplos: [tipo, [col,lin], [col,lin], parâmetros].
function circuit(parts){const S=createSim();buildPreset(S.comps,parts);return S;}
// Roda `ms` passos de 1 ms e devolve o que foi para o registro.
function run(S,ms){const logs=[];for(let i=0;i<ms;i++)step(S,(msg,cls)=>logs.push({msg,cls}));return logs;}
const find=(S,type)=>S.comps.find(c=>c.type===type);
const probe=(S,mode,r,b)=>Object.assign(S.mm,{mode,r:N(...r),b:N(...b)});

// LED vermelho + 470 Ω em 9 V (exemplo "led" do Sandbox).
const LED470=PRE.led.s;

describe('LED e resistor',()=>{
 it('LED vermelho + 470 Ω em 9 V passa ≈ 15 mA',()=>{
  const S=circuit(LED470);run(S,50);
  const led=find(S,'led');
  expect(led.burned).toBe(false);
  expect(led.I).toBeGreaterThan(0.0140);
  expect(led.I).toBeLessThan(0.0155);
  expect(find(S,'res').I).toBeCloseTo(led.I,6);
 });

 it('LED sem resistor queima',()=>{
  const S=circuit([['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['wire',[1,1],[4,1]],['led',[4,1],[4,2],{color:'vermelho'}],['wire',[4,2],[4,3]],['wire',[4,3],[1,3]]]);
  const logs=run(S,200);
  const led=find(S,'led');
  expect(led.burned).toBe(true);
  expect(led.why).toMatch(/LED vermelho queimou/);
  expect(logs.some(l=>l.cls==='bad'&&/LED vermelho queimou/.test(l.msg))).toBe(true);
 });

 it('resistor com fio em paralelo fica sem corrente',()=>{
  // 9 V → 470 Ω (com fio por cima) → 1 kΩ → volta. A corrente vai pelo fio.
  const S=circuit([['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:470}],['res',[2,1],[3,1],{R:1000}],['wire',[3,1],[3,3]],['wire',[3,3],[1,3]]]);
  addWire(S.comps,N(1,1),N(2,1));
  run(S,20);
  const [r470,r1k]=S.comps.filter(c=>c.type==='res');
  expect(bypassed(r470,S.comps)).toBe(true);
  expect(r1k.I).toBeCloseTo(0.009,4);
  expect(Math.abs(r470.I)).toBeLessThan(1e-6);
 });
});

describe('transistor',()=>{
 it('10 kΩ na base satura o transistor e o LED passa ~14 mA',()=>{
  const S=circuit(PRE.npn.s);
  find(S,'sw').on=true;
  run(S,50);
  const q=find(S,'npn'),led=find(S,'led');
  expect(q.burned).toBe(false);
  expect(q.Vce).toBeLessThan(0.3);
  expect(led.I).toBeGreaterThan(0.013);
  expect(led.I).toBeLessThan(0.015);
 });

 it('sem corrente na base, o LED fica apagado',()=>{
  const S=circuit(PRE.npn.s);run(S,50);
  expect(find(S,'led').I).toBeLessThan(1e-6);
 });
});

describe('capacitor',()=>{
 it('1000 µF com 1 kΩ chega perto de 63% em ~1 s',()=>{
  const S=circuit([['bat',[1,2],[1,3],{V:9}],['wire',[1,2],[1,1]],['res',[1,1],[2,1],{R:1000}],['cap',[2,1],[2,2],{uF:1000,rate:16}],['wire',[2,2],[2,3]],['wire',[2,3],[1,3]]]);
  run(S,1000);
  const frac=find(S,'cap').v/9;
  expect(frac).toBeGreaterThan(0.62);
  expect(frac).toBeLessThan(0.645);
 });
});

describe('multímetro',()=>{
 it('em A, em paralelo com a bateria, queima o fusível',()=>{
  const S=circuit([['bat',[1,2],[1,3],{V:9}]]);
  probe(S,'A',[1,2],[1,3]);
  const logs=run(S,50);
  expect(S.mm.fuse).toBe(false);
  expect(logs.some(l=>/fusível do multímetro queimou/.test(l.msg))).toBe(true);
  expect(readMeter(S,'mm').slice(0,3)).toEqual(['0,00','mA','bad']);
 });

 it('em A, em série, lê a mesma corrente do circuito',()=>{
  const ref=circuit(LED470);run(ref,50);
  const Iref=find(ref,'led').I;
  // Mesmo circuito, sem o fio entre [2,1] e [3,1]; o multímetro fecha o buraco.
  const S=circuit(LED470);
  S.comps=S.comps.filter(c=>!(c.type==='wire'&&c.n.includes(N(2,1))&&c.n.includes(N(3,1))));
  probe(S,'A',[2,1],[3,1]);
  run(S,50);
  expect(S.mm.fuse).toBe(true);
  expect(S.mm.I).toBeCloseTo(Iref,5);
  expect(find(S,'led').I).toBeCloseTo(S.mm.I,6);
  const [val,unit,cls]=readMeter(S,'mm');
  expect(unit).toBe('mA');expect(cls).toBe('ok');
  expect(parseFloat(val.replace(',','.'))).toBeCloseTo(Iref*1000,1);
 });

 it('em Ω lê 470 Ω num resistor isolado',()=>{
  const S=circuit([['res',[1,1],[2,1],{R:470}]]);
  probe(S,'Ω',[1,1],[2,1]);
  expect(readMeter(S,'mm').slice(0,3)).toEqual(['470,0','Ω','ok']);
 });

 it('em Ω mostra "Err" com a bateria ligada',()=>{
  const S=circuit(LED470);
  probe(S,'Ω',[1,1],[2,1]);
  expect(readMeter(S,'mm').slice(0,3)).toEqual(['Err','','bad']);
 });

 it('em Ω mostra "OL" com as pontas sem caminho',()=>{
  const S=circuit([['res',[1,1],[2,1],{R:470}]]);
  probe(S,'Ω',[1,1],[5,5]);
  expect(readMeter(S,'mm')[0]).toBe('OL');
 });
});
