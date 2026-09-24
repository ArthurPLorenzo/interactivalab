// Tamanho da cuba e faixas dos controles. Ficam aqui para os testes garantirem
// que a simulação é estável e que os desafios são possíveis.
export const TANK = { W: 2.0, H: 1.25, dx: 0.005 }

export const RANGES = {
  h: { min: 0.01, max: 0.04, step: 0.0025, value: 0.02 }, // profundidade (m)
  f: { min: 0.5,  max: 2.5,  step: 0.1,    value: 1.5 },  // batidas por segundo do pingador (Hz)
}
