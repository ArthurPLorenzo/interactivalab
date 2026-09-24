// Formatação de valores em pt-BR (vírgula decimal) e cores das faixas do resistor.
export const BC=['#111','#7a4a21','#d22','#f08a1c','#f2d31b','#2a9d4a','#2b62d9','#7b3fc4','#888','#f5f5f5'];
export const fmtR=r=>r===0?'sem resistor':r>=1e6?(r/1e6)+' MΩ':r>=1000?(r/1000).toString().replace('.',',')+' kΩ':r+' Ω';
export const fmtI=a=>a<=0?'0 mA':a<0.001?Math.round(a*1e6)+' µA':(a*1000).toFixed(a<0.01?1:0).replace('.',',')+' mA';
export const fVn=v=>String(v).replace('.',',')+' V';
export const fV=v=>(Math.abs(v)<10?v.toFixed(2):v.toFixed(1)).replace('.',',').replace(/^-0,00/,'0,00')+' V';
export const fA=i=>{const a=Math.abs(i);if(a<1e-6)return '0 mA';if(a<1e-3)return Math.round(a*1e6)+' µA';if(a<1)return (a*1e3).toFixed(a<0.01?1:0).replace('.',',')+' mA';return a.toFixed(1).replace('.',',')+' A';};
export const fW=p=>p<1?(p*1000).toFixed(p<0.01?1:0).replace('.',',')+' mW':p.toFixed(1).replace('.',',')+' W';
export const num=(v,d)=>v.toFixed(d).replace('.',',');
