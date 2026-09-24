// Física da cuba de ondas, em unidades do SI. Sem DOM: testada em tests/physics.test.js.
//
// A superfície da água é um campo de alturas u(x, y) que obedece à equação de onda
//   ∂²u/∂t² = v² ∇²u,   com v = √(g·h) (ondas em água rasa)
// resolvida por diferenças finitas numa grade quadrada de lado dx.

// ─── Onde está a cuba ─────────────────────────────────────────────────────────
export const WORLDS = {
  terra:   { name: 'Terra',   g: 9.81 },
  tita:    { name: 'Titã',    g: 1.35 },
  marte:   { name: 'Marte',   g: 3.71 },
  jupiter: { name: 'Júpiter', g: 24.79 },
}

export const waveSpeed = (g, h) => Math.sqrt(g * h)
export const wavelength = (v, f) => v / f

// ─── Cuba ─────────────────────────────────────────────────────────────────────
const SPONGE = 0.06     // m: faixa nas bordas que ajuda a absorver as ondas que chegam de lado
const SPONGE_MAX = 8    // 1/s: amortecimento junto da borda
const DAMPING = 0.04    // 1/s: atrito leve da água em toda a cuba
const SOURCE_R = 0.012  // m: raio do pingador

export function createTank(W, H, dx) {
  const nx = Math.round(W / dx), ny = Math.round(H / dx), n = nx * ny
  const damp = new Float32Array(n)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const d = Math.min(i, j, nx - 1 - i, ny - 1 - j) * dx
    const s = Math.max(0, 1 - d / SPONGE)
    damp[j * nx + i] = DAMPING + SPONGE_MAX * s * s
  }
  return {
    W, H, dx, nx, ny, t: 0,
    u: new Float32Array(n),      // altura da superfície
    v: new Float32Array(n),      // velocidade vertical
    wall: new Uint8Array(n),     // 1 onde tem pedra
    damp,
    rms: new Float32Array(n),    // média móvel de u² (quanto cada ponto sobe e desce)
  }
}

export const cellOf = (tk, x, y) => [Math.round(x / tk.dx), Math.round(y / tk.dx)]

// Pedras são círculos { x, y, r } em metros.
export function setStones(tk, stones) {
  const { nx, ny, dx, wall } = tk
  wall.fill(0)
  for (const s of stones) {
    const i0 = Math.max(0, Math.floor((s.x - s.r) / dx)), i1 = Math.min(nx - 1, Math.ceil((s.x + s.r) / dx))
    const j0 = Math.max(0, Math.floor((s.y - s.r) / dx)), j1 = Math.min(ny - 1, Math.ceil((s.y + s.r) / dx))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++)
      if (Math.hypot(i * dx - s.x, j * dx - s.y) <= s.r) wall[j * nx + i] = 1
  }
  for (let k = 0; k < wall.length; k++) if (wall[k]) { tk.u[k] = 0; tk.v[k] = 0 }
}

// Maior passo de tempo estável (condição de Courant em 2D: v·dt/dx ≤ 1/√2), com folga.
export const stableDt = (tk, v) => 0.6 * tk.dx / (v * Math.SQRT2)

// Uma gota: um calombo suave na superfície.
export function drop(tk, x, y, amp = 1, radius = 0.015) {
  const { nx, ny, dx, u, wall } = tk
  const r = Math.ceil(3 * radius / dx), [ci, cj] = cellOf(tk, x, y)
  for (let j = Math.max(1, cj - r); j <= Math.min(ny - 2, cj + r); j++)
    for (let i = Math.max(1, ci - r); i <= Math.min(nx - 2, ci + r); i++) {
      const k = j * nx + i
      if (!wall[k]) u[k] += amp * Math.exp(-(((i - ci) ** 2 + (j - cj) ** 2) * dx * dx) / (radius * radius))
    }
}

// Borda aberta (condição de Mur): a onda sai da cuba em vez de bater e voltar.
// Cada ponto da borda copia o vizinho de dentro com o atraso de quem viaja à velocidade v.
function openEdges(tk, dt, speed, before) {
  const { nx, ny, dx, u } = tk, a = (speed * dt - dx) / (speed * dt + dx)
  const edge = (b, inner, n) => { u[b] = before.inner[n] + a * (u[inner] - before.edge[n]) }
  let n = 0
  for (let i = 0; i < nx; i++) {
    edge(i, i + nx, n++)
    edge((ny - 1) * nx + i, (ny - 2) * nx + i, n++)
  }
  for (let j = 0; j < ny; j++) {
    edge(j * nx, j * nx + 1, n++)
    edge(j * nx + nx - 1, j * nx + nx - 2, n++)
  }
}
function snapshotEdges(tk) {
  const { nx, ny, u } = tk
  if (!tk.edgeBuf) tk.edgeBuf = { edge: new Float32Array(2 * (nx + ny)), inner: new Float32Array(2 * (nx + ny)) }
  const { edge, inner } = tk.edgeBuf
  let n = 0
  for (let i = 0; i < nx; i++) {
    edge[n] = u[i]; inner[n++] = u[i + nx]
    edge[n] = u[(ny - 1) * nx + i]; inner[n++] = u[(ny - 2) * nx + i]
  }
  for (let j = 0; j < ny; j++) {
    edge[n] = u[j * nx]; inner[n++] = u[j * nx + 1]
    edge[n] = u[j * nx + nx - 1]; inner[n++] = u[j * nx + nx - 2]
  }
  return tk.edgeBuf
}

// Um passo de tempo. `sources`: pingadores { x, y, f, amp } que sobem e descem sem parar.
// Nas pedras a onda bate e volta sem perder energia (a água não atravessa a pedra).
export function step(tk, dt, speed, sources = []) {
  const { nx, ny, dx, u, v, wall, damp } = tk
  const c = speed * speed / (dx * dx)
  const before = snapshotEdges(tk)
  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1, k = j * nx + 1; i < nx - 1; i++, k++) {
      if (wall[k]) continue
      const uk = u[k]
      const l = wall[k - 1] ? uk : u[k - 1], r = wall[k + 1] ? uk : u[k + 1]
      const d = wall[k - nx] ? uk : u[k - nx], up = wall[k + nx] ? uk : u[k + nx]
      v[k] += dt * (c * (l + r + d + up - 4 * uk) - damp[k] * v[k])
    }
  }
  for (let k = 0; k < u.length; k++) u[k] += dt * v[k]
  openEdges(tk, dt, speed, before)
  tk.t += dt
  for (const s of sources) {
    const [ci, cj] = cellOf(tk, s.x, s.y), rr = Math.ceil(SOURCE_R / dx)
    const h = (s.amp ?? 1) * Math.sin(2 * Math.PI * s.f * tk.t)
    for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) {
      if (i < 1 || j < 1 || i > nx - 2 || j > ny - 2 || (i - ci) ** 2 + (j - cj) ** 2 > rr * rr) continue
      const k = j * nx + i
      if (!wall[k]) { u[k] = h; v[k] = 0 }
    }
  }
}

// Avança `total` segundos em passos estáveis.
export function advance(tk, total, speed, sources) {
  const n = Math.max(1, Math.ceil(total / stableDt(tk, speed)))
  for (let s = 0; s < n; s++) step(tk, total / n, speed, sources)
}

// Média móvel de u² em cada ponto, com memória de uns `tau` segundos.
export function updateRms(tk, dt, tau = 1.5) {
  const a = Math.min(1, dt / tau), { u, rms } = tk
  for (let k = 0; k < u.length; k++) rms[k] += (u[k] * u[k] - rms[k]) * a
}

// Amplitude típica num ponto (a partir da média de u²).
export function amplitudeAt(tk, x, y) {
  const [i, j] = cellOf(tk, x, y)
  return Math.sqrt(2 * tk.rms[j * tk.nx + i])
}

export const heightAt = (tk, x, y) => {
  const [i, j] = cellOf(tk, x, y)
  return tk.u[j * tk.nx + i]
}
