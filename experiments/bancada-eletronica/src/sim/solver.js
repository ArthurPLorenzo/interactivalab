// Eliminação de Gauss com pivoteamento parcial. Altera A e b; devolve null se a matriz for singular.
export function solve(A,b){const n=b.length;
 for(let i=0;i<n;i++){let p=i,mx=Math.abs(A[i][i]);for(let r=i+1;r<n;r++){const v=Math.abs(A[r][i]);if(v>mx){mx=v;p=r;}}
  if(mx<1e-20)return null;if(p!==i){const t=A[i];A[i]=A[p];A[p]=t;const tb=b[i];b[i]=b[p];b[p]=tb;}
  const pv=A[i][i];for(let r=i+1;r<n;r++){const f=A[r][i]/pv;if(f){for(let c=i;c<n;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i];}}}
 const x=new Float64Array(n);for(let i=n-1;i>=0;i--){let s=b[i];for(let c=i+1;c<n;c++)s-=A[i][c]*x[c];x[i]=s/A[i][i];}return x;}
