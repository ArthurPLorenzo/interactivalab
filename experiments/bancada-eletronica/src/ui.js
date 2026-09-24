// Ajudantes de DOM compartilhados pelas abas e pelo Sandbox.
export const $=s=>document.querySelector(s);
export function seg(sel,opts,onPick){const el=$(sel);const btns=opts.map(o=>{const b=document.createElement('button');b.type='button';b.textContent=o.label;b.onclick=()=>onPick(o.v);el.appendChild(b);return [o.v,b];});return v=>btns.forEach(([k,b])=>b.classList.toggle('on',k===v));}
export const setStatus=(el,st,msg)=>{el.className='status '+st;el.textContent=msg;};
export const flowSpeed=(el,I,ref)=>{if(I>0){el.style.opacity=1;el.style.animationDuration=Math.max(.25,Math.min(4,ref/I))+'s';}else el.style.opacity=0;};
export function makeSel(label,opts,val,on){const l=document.createElement('label');l.append(label+' ');const s=document.createElement('select');
 opts.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(String(v)===String(val))o.selected=true;s.appendChild(o);});
 s.onchange=()=>{const o=opts.find(([v])=>String(v)===s.value);if(o)on(o[0]);};l.appendChild(s);return l;}
export function mkBtn(t,cls,fn){const b=document.createElement('button');b.type='button';b.className='btn'+(cls?' '+cls:'');b.textContent=t;b.onclick=fn;return b;}
