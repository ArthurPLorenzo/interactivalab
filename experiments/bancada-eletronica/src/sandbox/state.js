// Estado do Sandbox: o circuito (simulador) + o que a interface está fazendo.
import {createSim} from '../sim/circuit.js';

export const S=Object.assign(createSim(),{tool:'sel',pend:[],selC:null,probe:null,ghost:null});
