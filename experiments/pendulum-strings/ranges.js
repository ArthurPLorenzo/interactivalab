// Faixas dos controles. Ficam aqui para os testes garantirem que os desafios são possíveis.
export const RANGES = {
  L:     { min: 0.10, max: 2.00,  step: 0.01,  value: 1.00 }, // pêndulo: comprimento (m)
  bob:   { min: 0.05, max: 2.00,  step: 0.05,  value: 0.50 }, // pêndulo: massa (kg)
  angle: { min: 5,    max: 90,    step: 1,     value: 20 },   // pêndulo: ângulo de soltura (graus)
  sL:    { min: 0.20, max: 1.00,  step: 0.005, value: 0.65 }, // corda: comprimento vibrante (m)
  m:     { min: 0.5,  max: 20,    step: 0.5,   value: 5 },    // corda: massa pendurada (kg)
}
