import { describe, it, expect } from 'vitest'
import {
  WORLDS, waveSpeed, wavelength, createTank, setStones, stableDt, drop, step, advance,
  updateRms, amplitudeAt, heightAt,
} from '../physics.js'
import { TANK, RANGES } from '../ranges.js'

const g = WORLDS.terra.g

// Cuba menor que a da página, para os testes rodarem rápido.
const small = () => createTank(1.2, 0.8, TANK.dx)

// Corre `seconds` segundos acumulando a média de u² a cada passo.
function run(tk, seconds, v, sources) {
  const dt = stableDt(tk, v), n = Math.ceil(seconds / dt)
  for (let s = 0; s < n; s++) { step(tk, seconds / n, v, sources); updateRms(tk, seconds / n, 0.8) }
}

describe('velocidade e comprimento de onda', () => {
  it('v = √(g·h): 2 cm de água na Terra → ≈ 0,44 m/s', () => {
    expect(waveSpeed(g, 0.02)).toBeCloseTo(0.443, 3)
    expect(wavelength(0.443, 1.5)).toBeCloseTo(0.295, 3)
  })

  it('a gota se espalha na velocidade √(g·h)', () => {
    const tk = small(), v = waveSpeed(g, 0.02), cx = 0.3, cy = 0.4
    drop(tk, cx, cy)
    advance(tk, 1.0, v)
    // a crista mais alta ao longo da linha horizontal que sai da gota
    let best = 0, bx = 0
    for (let x = cx + 0.05; x < 1.1; x += TANK.dx) { const u = heightAt(tk, x, cy); if (u > best) { best = u; bx = x } }
    expect((bx - cx) / (v * 1.0)).toBeGreaterThan(0.9)
    expect((bx - cx) / (v * 1.0)).toBeLessThan(1.05)
  })

  it('com um pingador, as cristas ficam a λ = v ÷ f uma da outra', () => {
    const tk = createTank(TANK.W, TANK.H, TANK.dx), v = waveSpeed(g, 0.02), f = 2, cy = TANK.H / 2
    advance(tk, 5, v, [{ x: 0.15, y: cy, f }])
    // cada crista é um máximo local; a posição exata sai de uma parábola pelos três pontos vizinhos
    const crests = []
    for (let x = 0.4; x < 1.85; x += TANK.dx) {
      const a = heightAt(tk, x - TANK.dx, cy), b = heightAt(tk, x, cy), c = heightAt(tk, x + TANK.dx, cy)
      if (b > a && b >= c && b > 0.02) crests.push(x + TANK.dx * (a - c) / (2 * (a - 2 * b + c)))
    }
    expect(crests.length).toBeGreaterThanOrEqual(4)
    const gaps = crests.slice(1).map((x, i) => x - crests[i])
    const mean = gaps.reduce((s, d) => s + d, 0) / gaps.length
    expect(mean / wavelength(v, f)).toBeGreaterThan(0.95)
    expect(mean / wavelength(v, f)).toBeLessThan(1.05)
  })

  it('um quarto da profundidade deixa a onda com metade da velocidade', () => {
    expect(waveSpeed(g, 0.01) / waveSpeed(g, 0.04)).toBeCloseTo(0.5, 10)
    const { h } = RANGES
    expect(h.max / h.min).toBeGreaterThanOrEqual(4)
  })
})

describe('pedras e encontros', () => {
  it('a onda bate na pedra e volta, no tempo 2D ÷ v', () => {
    const tk = small(), v = waveSpeed(g, 0.02), x0 = 0.3, cy = 0.4, D = 0.25
    setStones(tk, [{ x: x0 + D + 0.3, y: cy, r: 0.3 }])
    drop(tk, x0, cy)
    const dt = stableDt(tk, v)
    let best = 0, tBest = 0
    for (let t = 0; t < 1.8; t += dt) {
      step(tk, dt, v)
      if (t > 0.3) { const u = Math.abs(heightAt(tk, x0, cy)); if (u > best) { best = u; tBest = t } }
    }
    expect(best).toBeGreaterThan(0.01)
    expect(tBest / (2 * D / v)).toBeGreaterThan(0.9)
    expect(tBest / (2 * D / v)).toBeLessThan(1.15)
  })

  it('dois pingadores: a areia fica parada onde a diferença de caminho é meio λ', () => {
    const tk = createTank(TANK.W, TANK.H, TANK.dx), v = waveSpeed(g, 0.02), f = 2, lam = wavelength(v, f)
    const d = 1.5 * lam, mx = TANK.W / 2, my = 0.3, R = 0.7
    const sources = [{ x: mx - d / 2, y: my, f }, { x: mx + d / 2, y: my, f }]
    run(tk, 6, v, sources)
    // Ponto a uma distância R do meio onde os caminhos até os dois pingadores diferem de meio λ:
    // uma crista chega junto com um vale.
    const diff = a => Math.hypot(mx + R * Math.sin(a) - (mx - d / 2), my + R * Math.cos(a) - my) -
      Math.hypot(mx + R * Math.sin(a) - (mx + d / 2), my + R * Math.cos(a) - my)
    let lo = 0, hi = Math.PI / 2
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; diff(m) < lam / 2 ? (lo = m) : (hi = m) }
    const loud = amplitudeAt(tk, mx, my + R) // na linha do meio as duas chegam juntas e se somam
    // o ponto mais parado do arco, procurado na simulação
    let best = Infinity, aBest = 0
    for (let a = 0.1; a < 0.6; a += 0.005) {
      const amp = amplitudeAt(tk, mx + R * Math.sin(a), my + R * Math.cos(a))
      if (amp < best) { best = amp; aBest = a }
    }
    expect(loud).toBeGreaterThan(0.05)
    expect(Math.abs(aBest - lo) * 180 / Math.PI).toBeLessThan(3)
    expect(best / loud).toBeLessThan(0.25)
  })
})

describe('estabilidade', () => {
  it('não explode na onda mais rápida possível (Júpiter, água mais funda)', () => {
    const tk = small(), v = waveSpeed(WORLDS.jupiter.g, RANGES.h.max)
    drop(tk, 0.6, 0.4)
    advance(tk, 3, v, [{ x: 0.3, y: 0.4, f: RANGES.f.max }])
    const max = tk.u.reduce((m, x) => Math.max(m, Math.abs(x)), 0)
    expect(Number.isFinite(max)).toBe(true)
    expect(max).toBeLessThan(3)
  })

  it('a onda mais curta possível ainda tem uns 8 pontos da grade por comprimento de onda', () => {
    const vMin = Math.min(...Object.values(WORLDS).map(w => waveSpeed(w.g, RANGES.h.min)))
    expect(wavelength(vMin, RANGES.f.max) / TANK.dx).toBeGreaterThanOrEqual(7.5)
  })
})
