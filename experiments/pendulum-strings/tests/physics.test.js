import { describe, it, expect } from 'vitest'
import {
  PLANETS, STRINGS, pendulumStep, smallAnglePeriod, exactPeriod, createTimer, timerUpdate,
  stringFrequency, noteOf, centsBetween,
} from '../physics.js'
import { RANGES } from '../ranges.js'

const g = PLANETS.terra.g
const deg = d => d * Math.PI / 180

// Solta o pêndulo parado em θ0 e devolve o período medido pelo cronômetro.
function measure(L, theta0, gg = g, seconds = 20, dt = 1 / 240) {
  const s = { theta: theta0, omega: 0, t: 0 }, tm = createTimer()
  while (s.t < seconds) { pendulumStep(s, dt, L, gg); timerUpdate(tm, s) }
  return tm.period
}

describe('pêndulo', () => {
  it('pêndulo de ~0,994 m na Terra tem período de 2 s (bate o segundo)', () => {
    expect(smallAnglePeriod(0.994, g)).toBeCloseTo(2.0, 2)
  })

  it('com ângulo pequeno, o período medido bate com T = 2π√(L/g)', () => {
    const T = measure(1, deg(5))
    expect(T / smallAnglePeriod(1, g)).toBeCloseTo(1, 2)
    expect(T / exactPeriod(1, g, deg(5))).toBeCloseTo(1, 4)
  })

  it('com ângulo grande, demora mais que a fórmula simples (60° → ~7% a mais)', () => {
    const T = measure(1, deg(60))
    expect(T / exactPeriod(1, g, deg(60))).toBeCloseTo(1, 4)
    expect(T / smallAnglePeriod(1, g)).toBeCloseTo(1.073, 3)
  })

  it('na Lua, o mesmo pêndulo é √(9,81/1,62) ≈ 2,46× mais lento', () => {
    expect(measure(1, deg(5), PLANETS.lua.g, 40) / measure(1, deg(5))).toBeCloseTo(Math.sqrt(9.81 / 1.62), 2)
  })

  it('sem atrito, a energia se conserva por um minuto', () => {
    const L = 1, s = { theta: deg(45), omega: 0, t: 0 }
    const E = st => 0.5 * L * L * st.omega ** 2 + g * L * (1 - Math.cos(st.theta))
    const E0 = E(s)
    while (s.t < 60) pendulumStep(s, 1 / 240, L, g)
    expect(Math.abs(E(s) - E0) / E0).toBeLessThan(1e-6)
  })

  it('o cronômetro marca uma passagem a cada meio período', () => {
    const s = { theta: deg(10), omega: 0, t: 0 }, tm = createTimer()
    let ticks = 0
    while (s.t < 10) { pendulumStep(s, 1 / 240, 1, g); if (timerUpdate(tm, s)) ticks++ }
    expect(ticks).toBe(Math.floor(10 / (exactPeriod(1, g, deg(10)) / 2) - 0.5) + 1)
  })

  it('dá para acertar 60 tiques por minuto com os controles', () => {
    const { L } = RANGES
    let best = Infinity
    for (let l = L.min; l <= L.max + 1e-9; l += L.step) best = Math.min(best, Math.abs(120 / smallAnglePeriod(l, g) - 60))
    expect(best).toBeLessThan(0.5)
  })
})

describe('corda', () => {
  it('corda fina de aço, 0,65 m, 70 N: ≈ 330 Hz (o Mi mais agudo do violão)', () => {
    const f = stringFrequency(0.65, 70, STRINGS.fina.mu)
    expect(f).toBeGreaterThan(320)
    expect(f).toBeLessThan(330)
    expect(noteOf(f).label).toBe('Mi4')
  })

  it('metade do comprimento → uma oitava acima', () => {
    expect(stringFrequency(0.3, 50, 0.001) / stringFrequency(0.6, 50, 0.001)).toBeCloseTo(2, 10)
  })

  it('4× a tensão → uma oitava acima', () => {
    expect(stringFrequency(0.6, 200, 0.001) / stringFrequency(0.6, 50, 0.001)).toBeCloseTo(2, 10)
  })

  it('corda 4× mais pesada por metro → uma oitava abaixo', () => {
    expect(stringFrequency(0.6, 50, STRINGS.media.mu) / stringFrequency(0.6, 50, STRINGS.fina.mu)).toBeCloseTo(0.5, 10)
  })

  it('dá para tocar um Lá 440 (±10 cents) com os controles, sem arrebentar a corda', () => {
    const { sL: L, m } = RANGES
    let best = Infinity
    for (let l = L.min; l <= L.max + 1e-9; l += L.step)
      for (let k = m.min; k <= m.max + 1e-9; k += m.step) {
        const T = k * g
        if (T > STRINGS.fina.maxT) continue
        best = Math.min(best, Math.abs(centsBetween(440, stringFrequency(l, T, STRINGS.fina.mu))))
      }
    expect(best).toBeLessThan(10)
  })
})

describe('notas', () => {
  it('reconhece notas da afinação padrão', () => {
    expect(noteOf(440)).toEqual({ name: 'Lá', octave: 4, label: 'Lá4', cents: 0 })
    expect(noteOf(261.63).label).toBe('Dó4')
    expect(noteOf(466.16).label).toBe('Lá#4')
    expect(noteOf(55).label).toBe('Lá1')
  })

  it('mede o desvio em cents', () => {
    expect(noteOf(445).cents).toBe(20)
    expect(noteOf(435).cents).toBe(-20)
    expect(centsBetween(220, 440)).toBeCloseTo(1200, 10)
  })
})
