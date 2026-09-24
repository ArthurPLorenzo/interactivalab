// Constantes e modelos das peças: diodo/LED (Shockley com extensão linear) e NPN (Ebers-Moll).
export const VT=0.02585,GMIN=1e-9,RINT=0.2,RW=0.01,DT=0.001,IST=1e-14,BF=100,BR=1;
export const RMM=0.1; // resistência interna do multímetro no modo corrente
export const LEDP={vermelho:{vf:2.0,c:'#ff3b2f'},verde:{vf:2.2,c:'#39e36b'},azul:{vf:3.1,c:'#3fa9ff'}};

// exp(x) que vira reta acima de xm, para o Newton não explodir. Devolve [valor, derivada].
export const lexp=(x,xm)=>{if(x>xm){const e=Math.exp(xm);return [e*(1+x-xm),e];}const e=Math.exp(Math.max(x,-80));return [e,e];};
export function dpar(c){if(c.type==='led'){const n=2,Is=0.01/Math.exp(LEDP[c.p.color].vf/(n*VT));return {n,Is,xm:Math.log(2/Is)};}return {n:1,Is:1e-14,xm:Math.log(2/1e-14)};}
export function npnEval(Vc,Vb,Ve){const xm=Math.log(1/IST),[ef,def]=lexp((Vb-Ve)/VT,xm),[er,der]=lexp((Vb-Vc)/VT,xm);
 const Ic=IST*(ef-er)-(IST/BR)*(er-1),Ib=(IST/BF)*(ef-1)+(IST/BR)*(er-1);
 const gF=IST*def/VT+1e-12,gR=IST*der/VT+1e-12,cbe=gF,cbc=-gR-gR/BR,bbe=gF/BF,bbc=gR/BR;
 return {Ic,Ib,pIc:[-cbc,cbe+cbc,-cbe],pIb:[-bbc,bbe+bbc,-bbe]};}

// Pino digital de saída do Arduino (ATmega328P): 5 V em HIGH, 0 V em LOW, ~25 Ω de resistência de saída.
// Limite absoluto: 40 mA por pino (o recomendado é até 20 mA).
export const RPIN=25,VPIN=5,IPIN_MAX=0.04;

// Motor DC pequeno de 5 V: enrolamento (R, L), constante do motor k (V por rad/s, e também N·m por A),
// atrito viscoso b e inércia J do eixo. Cs é a capacitância do próprio enrolamento, que recebe
// a energia da bobina quando a corrente é cortada de repente.
export const MOTOR={R:8,L:0.002,k:0.0045,b:2.5e-7,J:1e-6,Cs:1e-9};
export const VCE_MAX=40; // tensão máxima entre coletor e emissor de um transistor pequeno

// Motor como um ramo único (Euler implícito na bobina, força contraeletromotriz do passo anterior):
// corrente de a para b = G·(va − vb) + I0.
export function motorBranch(c){const Leq=MOTOR.L/DT,G=1/(MOTOR.R+Leq);return {G,I0:G*(Leq*c.iL-MOTOR.k*c.w)};}
export const rpm=w=>w*60/(2*Math.PI);
