// Troca de abas.
function go(id){document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x.dataset.p===id));document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==id);window.scrollTo({top:0,behavior:'smooth'});}
export function initNav(){
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>go(b.dataset.p));
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
}
