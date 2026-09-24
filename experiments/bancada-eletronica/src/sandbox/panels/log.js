// Painel "O que aconteceu": guarda as 5 mensagens mais recentes.
import {$} from '../../ui.js';

export function log(msg,cls){const ul=$('#s-log'),li=document.createElement('li');li.textContent=msg;if(cls)li.className=cls;ul.prepend(li);while(ul.children.length>5)ul.lastChild.remove();}
