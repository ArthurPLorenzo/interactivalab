// Física do pêndulo e da corda, em unidades do SI. Sem DOM: testada em tests/physics.test.js.

// ─── Gravidade ────────────────────────────────────────────────────────────────
export const PLANETS = {
  terra:   { name: 'Terra',   g: 9.81 },
  lua:     { name: 'Lua',     g: 1.62 },
  marte:   { name: 'Marte',   g: 3.71 },
  jupiter: { name: 'Júpiter', g: 24.79 },
}

// ─── Pêndulo simples ──────────────────────────────────────────────────────────
// θ'' = −(g/L)·sen θ, sem aproximação de ângulo pequeno, integrado por Runge-Kutta 4.
// A massa não entra na equação: é justamente o que o experimento quer mostrar.
export function pendulumStep(s, dt, L, g) {
  const k = g / L
  const f = (th, om) => [om, -k * Math.sin(th)]
  const [a1, b1] = f(s.theta, s.omega)
  const [a2, b2] = f(s.theta + a1 * dt / 2, s.omega + b1 * dt / 2)
  const [a3, b3] = f(s.theta + a2 * dt / 2, s.omega + b2 * dt / 2)
  const [a4, b4] = f(s.theta + a3 * dt, s.omega + b3 * dt)
  s.theta += dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4)
  s.omega += dt / 6 * (b1 + 2 * b2 + 2 * b3 + b4)
  s.t += dt
}

// Fórmula de ângulo pequeno: T = 2π √(L/g)
export const smallAnglePeriod = (L, g) => 2 * Math.PI * Math.sqrt(L / g)

// Período exato para qualquer amplitude θ0, pela média aritmético-geométrica.
export function exactPeriod(L, g, theta0) {
  let a = 1, b = Math.cos(theta0 / 2)
  while (Math.abs(a - b) > 1e-15) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]
  return smallAnglePeriod(L, g) / a
}

// Cronômetro: marca cada passagem pelo ponto mais baixo (θ = 0).
// Um período é o tempo entre duas passagens no mesmo sentido.
export function createTimer() {
  return { prevTheta: null, prevT: 0, crossings: [], period: null }
}
export function timerUpdate(tm, s) {
  let crossed = false
  if (tm.prevTheta !== null && tm.prevTheta * s.theta < 0) {
    crossed = true
    // instante exato do cruzamento, interpolado dentro do passo
    tm.crossings.push(tm.prevT + (s.t - tm.prevT) * tm.prevTheta / (tm.prevTheta - s.theta))
    const c = tm.crossings
    if (c.length >= 3) tm.period = c[c.length - 1] - c[c.length - 3]
    if (c.length > 6) c.shift()
  }
  tm.prevTheta = s.theta
  tm.prevT = s.t
  return crossed
}

// ─── Corda vibrante (lei de Mersenne) ─────────────────────────────────────────
// f = (1 / 2L) · √(T / μ)   L: comprimento vibrante (m), T: tensão (N), μ: massa por metro (kg/m)
export const stringFrequency = (L, T, mu) => Math.sqrt(T / mu) / (2 * L)

// Cordas de aço. Cada uma tem 4× a massa por metro da anterior (o dobro do diâmetro)
// e aguenta 4× mais tensão antes de arrebentar.
export const STRINGS = {
  fina:   { name: 'fina',   mu: 0.0004, maxT: 100 },
  media:  { name: 'média',  mu: 0.0016, maxT: 400 },
  grossa: { name: 'grossa', mu: 0.0064, maxT: 1600 },
}

// ─── Notas musicais ───────────────────────────────────────────────────────────
const NOTE_NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si']

// Nota mais próxima na afinação padrão (Lá4 = 440 Hz) e o desvio em cents (1/100 de semitom).
export function noteOf(f) {
  const semis = 12 * Math.log2(f / 440) + 57 // semitons desde Dó0
  const n = Math.round(semis)
  const name = NOTE_NAMES[((n % 12) + 12) % 12]
  const octave = Math.floor(n / 12)
  return { name, octave, label: name + octave, cents: Math.round((semis - n) * 100) }
}

// Intervalo entre duas frequências, em cents.
export const centsBetween = (f1, f2) => 1200 * Math.log2(f2 / f1)
