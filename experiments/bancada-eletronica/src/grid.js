// Geometria da placa: pontos numerados k = linha*COLS + coluna.
export const COLS=8,ROWS=6,SP=56,OFF=30;
export const px=k=>OFF+(k%COLS)*SP,py=k=>OFF+Math.floor(k/COLS)*SP,N=(c,r)=>r*COLS+c,cr=k=>[k%COLS,Math.floor(k/COLS)];
export function adj(a,b){const [c1,r1]=cr(a),[c2,r2]=cr(b);return a!==b&&Math.max(Math.abs(c1-c2),Math.abs(r1-r2))===1;}
