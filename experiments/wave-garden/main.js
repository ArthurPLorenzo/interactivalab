import * as Tone from 'tone'
import {
  WORLDS, waveSpeed, wavelength, createTank, setStones, drop, advance, updateRms, amplitudeAt, heightAt,
} from './physics.js'
import { TANK, RANGES } from './ranges.js'

const $ = id => document.getElementById(id)
const fmt = (v, d) => v.toFixed(d).replace('.', ',')

// ─── Cores ────────────────────────────────────────────────────────────────────
// A cuba é sempre de areia (nos dois temas); o registro da boia segue o tema.
const SAND = [226, 207, 160]
const SAND_INK = '#3b3222'
const C = {}
function readColors() {
  const cs = getComputedStyle(document.documentElement)
  for (const k of ['paper-2', 'grid-strong', 'ink', 'ink-soft', 'trace']) C[k] = cs.getPropertyValue('--' + k).trim()
}
readColors()
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors)

// ─── Estado ───────────────────────────────────────────────────────────────────
const tank = createTank(TANK.W, TANK.H, TANK.dx)
const W = {
  world: 'terra', h: RANGES.h.value, f: RANGES.f.value, tool: 'gota',
  stones: [], sources: [], ruler: null, buoy: null,
  event: null, changedAt: 0, vAtStart: null, stillFound: false, paused: false,
}
const speed = () => waveSpeed(WORLDS[W.world].g, W.h)
const lambda = () => wavelength(speed(), W.f)
const changed = () => { W.changedAt = tank.t; W.stillFound = false }

const notice = (cls, msg) => { W.event = { cls, msg, until: performance.now() + 10000 } }
const noticeActive = () => W.event && performance.now() < W.event.until
function markDone(key) { $('goals').querySelector(`[data-g="${key}"]`).classList.add('done') }

// ─── Som ──────────────────────────────────────────────────────────────────────
let soundOn = true
const plink = new Tone.MembraneSynth({
  pitchDecay: 0.015, octaves: 3,
  envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -14,
}).toDestination()
const tick = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 }, volume: -26,
}).toDestination()

function playPlink() { if (soundOn) Tone.start().then(() => plink.triggerAttackRelease('G4', '16n')) }
function playTick() { if (soundOn && Tone.context.state === 'running') tick.triggerAttackRelease('C6', 0.05) }

$('sound').addEventListener('click', () => {
  soundOn = !soundOn
  $('sound').setAttribute('aria-pressed', soundOn)
  $('sound').textContent = soundOn ? 'Som ligado' : 'Som desligado'
  if (soundOn) Tone.start()
})

// ─── Mundo ────────────────────────────────────────────────────────────────────
const WORLD_NOTES = {
  terra: () => 'De volta à Terra: g = 9,81 m/s².',
  tita: () => `Titã, a maior lua de Saturno, tem lagos e mares de metano líquido de verdade. A gravidade lá é 7 vezes menor que a da Terra, e as ondas andam a ${fmt(Math.sqrt(1.35 / 9.81) * 100, 0)}% da velocidade daqui.`,
  marte: () => `Marte já teve lagos, há uns 3 bilhões de anos. Com g = 3,71 m/s², as ondas andariam a ${fmt(Math.sqrt(3.71 / 9.81) * 100, 0)}% da velocidade na Terra.`,
  jupiter: () => 'Júpiter não tem chão nem lago: é quase todo gás. Esta é uma cuba imaginária com a gravidade de lá, 2,5 vezes a da Terra.',
}
const worldBtns = Object.entries(WORLDS).map(([key, w]) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = w.name
  b.addEventListener('click', () => setWorld(key, true))
  $('world').appendChild(b)
  return [key, b]
})
function setWorld(key, announce) {
  W.world = key
  worldBtns.forEach(([k, b]) => b.setAttribute('aria-pressed', k === key))
  $('gval').textContent = `g = ${fmt(WORLDS[key].g, 2)} m/s²`
  if (announce) notice('', WORLD_NOTES[key]())
  changed()
  ui()
}

// ─── Ferramentas ──────────────────────────────────────────────────────────────
const TOOLS = {
  gota: { name: 'Gota', tip: 'Toque na areia para soltar uma gota.' },
  pingador: { name: 'Pingador', tip: 'Toque para pôr um pingador, que sobe e desce sem parar. Cabem dois, batendo juntos. Toque num pingador para tirá-lo.' },
  pedra: { name: 'Pedra', tip: 'Toque na areia para pôr uma pedra. Arraste uma pedra para mudá-la de lugar, ou toque nela para tirá-la.' },
  regua: { name: 'Régua', tip: 'As cristas (topos da onda) são as linhas claras. Arraste do meio de uma até o meio da próxima, ou pegue várias de uma vez.' },
  boia: { name: 'Boia', tip: 'Toque para pôr a boia. Embaixo da cuba aparece o sobe e desce dela.' },
}
const toolBtns = Object.entries(TOOLS).map(([key, t]) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = t.name
  b.addEventListener('click', () => setTool(key))
  $('tools').appendChild(b)
  return [key, b]
})
function setTool(key) {
  W.tool = key
  toolBtns.forEach(([k, b]) => b.setAttribute('aria-pressed', k === key))
  $('tip').textContent = TOOLS[key].tip
}

// ─── Pedras ───────────────────────────────────────────────────────────────────
// Cada pedra tem um contorno um pouco irregular só no desenho; para a água ela é um círculo.
function makeStone(x, y, r) {
  const pts = []
  for (let i = 0; i < 12; i++) pts.push(1 + (Math.random() - 0.5) * 0.12)
  return { x, y, r, pts, rot: Math.random() * Math.PI }
}
const applyStones = () => { setStones(tank, W.stones); changed() }

// ─── Controles ────────────────────────────────────────────────────────────────
function setRange(input, r) { Object.assign(input, { min: r.min, max: r.max, step: r.step }); input.value = r.value }
setRange($('h'), RANGES.h)
setRange($('f'), RANGES.f)

$('h').addEventListener('input', e => { W.h = +e.target.value; changed(); ui() })
$('f').addEventListener('input', e => { W.f = +e.target.value; changed(); ui() })

// Desafio da profundidade: compara a velocidade de antes com a de depois de mexer no controle.
const startDepth = () => { if (W.vAtStart === null) W.vAtStart = speed() }
$('h').addEventListener('pointerdown', startDepth)
$('h').addEventListener('focus', startDepth)
$('h').addEventListener('change', () => {
  const ratio = speed() / W.vAtStart
  if (ratio > 0.47 && ratio < 0.53) {
    markDone('slow')
    notice('ok', `A onda agora anda a ${fmt(speed() * 100, 1)} cm/s, a metade de antes. Com um quarto da profundidade, metade da velocidade, porque v = √(g·h) e a raiz de um quarto é meio.`)
  }
  W.vAtStart = speed()
  ui()
})
$('h').addEventListener('blur', () => { W.vAtStart = null })

$('pause').addEventListener('click', () => {
  W.paused = !W.paused
  $('pause').setAttribute('aria-pressed', W.paused)
  $('pause').textContent = W.paused ? 'Soltar a água' : 'Pausar a água'
})
$('calm').addEventListener('click', () => { tank.u.fill(0); tank.v.fill(0); tank.rms.fill(0); changed() })
$('clear').addEventListener('click', () => {
  W.stones = []; W.sources = []; W.ruler = null; W.buoy = null
  tank.u.fill(0); tank.v.fill(0); tank.rms.fill(0)
  applyStones(); fit(); ui()
})

// ─── Exemplos ─────────────────────────────────────────────────────────────────
const PRESETS = {
  zen: {
    msg: 'Três pedras, como num jardim zen. Solte gotas perto delas e veja a onda bater e voltar.',
    build: () => { W.stones = [makeStone(0.55, 0.42, 0.09), makeStone(1.35, 0.78, 0.12), makeStone(1.62, 0.3, 0.06)]; W.sources = [] },
  },
  duas: {
    msg: 'Dois pingadores batendo juntos. As linhas em que a areia fica parada saem em leque entre eles.',
    build: () => { W.stones = []; W.sources = [{ x: 0.85, y: 0.3 }, { x: 1.15, y: 0.3 }] },
  },
  fresta: {
    msg: 'Uma parede de pedras com uma fresta no meio. Depois da fresta, a onda se abre em leque: isso é a difração.',
    build: () => {
      W.stones = []
      for (let y = 0.03; y < TANK.H; y += 0.085) if (Math.abs(y - TANK.H / 2) > 0.1) W.stones.push(makeStone(0.9, y, 0.05))
      W.sources = [{ x: 0.35, y: TANK.H / 2 }]
    },
  },
  pedra: {
    msg: 'Uma pedra grande no caminho. A onda bate nela e volta, e também contorna as bordas: atrás da pedra quase não fica sombra.',
    build: () => { W.stones = [makeStone(1.25, TANK.H / 2, 0.13)]; W.sources = [{ x: 0.5, y: TANK.H / 2 }] },
  },
}
function loadPreset(key, announce = true) {
  PRESETS[key].build()
  tank.u.fill(0); tank.v.fill(0); tank.rms.fill(0)
  applyStones()
  if (announce) notice('', PRESETS[key].msg)
  ui()
}
$('preset').addEventListener('change', e => { if (e.target.value) loadPreset(e.target.value); e.target.value = '' })

// ─── Canvas ───────────────────────────────────────────────────────────────────
const cv = $('tank'), ctx = cv.getContext('2d')
const CHART_H = 96, CHART_SECONDS = 6, CHART_RANGE = 0.4, SIDE_H = 130
let cssW = 0, tankH = 0, scale = 1
function fit() {
  cssW = cv.getBoundingClientRect().width
  tankH = cssW * TANK.H / TANK.W
  scale = cssW / TANK.W
  const cssH = tankH + SIDE_H + (W.buoy ? CHART_H : 0), dpr = window.devicePixelRatio || 1
  cv.style.height = cssH + 'px'
  cv.width = Math.round(cssW * dpr)
  cv.height = Math.round(cssH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
new ResizeObserver(() => { if (cv.getBoundingClientRect().width !== cssW) fit() }).observe(cv)

// A superfície é desenhada numa imagem do tamanho da grade e ampliada com suavização.
const off = document.createElement('canvas')
off.width = tank.nx
off.height = tank.ny
const octx = off.getContext('2d'), img = octx.createImageData(tank.nx, tank.ny)
const grain = new Float32Array(tank.nx * tank.ny).map(() => 0.97 + Math.random() * 0.06)

function drawSand() {
  const { nx, ny, u, wall } = tank, d = img.data
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    let s = 1
    if (i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && !wall[k]) {
      // luz vindo do alto à esquerda: encostas viradas para ela clareiam, as outras escurecem
      // Crista clara, vale escuro (pela altura), com um relevo leve por cima.
      // tanh: contraste forte nas ondas fracas, sem estourar perto das gotas.
      s = 1 + 0.42 * Math.tanh(u[k] * 3.2 - (u[k + 1] - u[k - 1] + u[k + nx] - u[k - nx]) * 2.5)
    }
    s *= grain[k]
    const p = k * 4
    d[p] = SAND[0] * s; d[p + 1] = SAND[1] * s; d[p + 2] = SAND[2] * s; d[p + 3] = 255
  }
  octx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(off, 0, 0, cssW, tankH)
}

const X = m => m * scale

function drawStones() {
  for (const s of W.stones) {
    ctx.save()
    ctx.translate(X(s.x), X(s.y))
    ctx.rotate(s.rot)
    ctx.shadowColor = 'rgba(40, 30, 10, 0.35)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    ctx.beginPath()
    s.pts.forEach((p, i) => {
      const a = i / s.pts.length * Math.PI * 2, r = X(s.r) * p
      i ? ctx.lineTo(r * Math.cos(a), r * Math.sin(a)) : ctx.moveTo(r * Math.cos(a), r * Math.sin(a))
    })
    ctx.closePath()
    const g = ctx.createRadialGradient(-X(s.r) * 0.3, -X(s.r) * 0.3, 1, 0, 0, X(s.r) * 1.1)
    g.addColorStop(0, '#a9a39b')
    g.addColorStop(1, '#5d5750')
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()
  }
}

function drawScale() {
  // Régua nas bordas de cima e da esquerda, a cada 10 cm
  ctx.strokeStyle = SAND_INK
  ctx.fillStyle = SAND_INK
  ctx.lineWidth = 1.5
  ctx.font = "12px 'Atkinson Hyperlegible', system-ui, sans-serif"
  ctx.textAlign = 'left'
  for (let m = 0.1, n = 1; m < TANK.W; m += 0.1, n++) {
    const len = n % 5 === 0 ? 12 : 6
    ctx.beginPath(); ctx.moveTo(X(m), 0); ctx.lineTo(X(m), len); ctx.stroke()
    if (n % 5 === 0) ctx.fillText(n === 10 ? '1 m' : `${fmt(n / 10, 1)} m`, X(m) + 3, 22)
  }
  for (let m = 0.1, n = 1; m < TANK.H; m += 0.1, n++) {
    const len = n % 5 === 0 ? 12 : 6
    ctx.beginPath(); ctx.moveTo(0, X(m)); ctx.lineTo(len, X(m)); ctx.stroke()
  }
}

function drawTools() {
  for (const s of W.sources) {
    const lift = heightAt(tank, s.x, s.y) * 3
    ctx.fillStyle = SAND_INK
    ctx.beginPath(); ctx.arc(X(s.x), X(s.y) - lift, 6, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = SAND_INK
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(X(s.x), X(s.y), 11, 0, Math.PI * 2); ctx.stroke()
  }
  if (W.ruler) {
    const { x1, y1, x2, y2 } = W.ruler, L = Math.hypot(x2 - x1, y2 - y1)
    const nx = -(y2 - y1) / (L || 1), ny = (x2 - x1) / (L || 1)
    ctx.strokeStyle = '#b3261e'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(X(x1), X(y1)); ctx.lineTo(X(x2), X(y2))
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.moveTo(X(x) - nx * 8, X(y) - ny * 8); ctx.lineTo(X(x) + nx * 8, X(y) + ny * 8) }
    ctx.stroke()
    const label = `${fmt(L * 100, 1)} cm`, mx = X((x1 + x2) / 2) + nx * 18, my = X((y1 + y2) / 2) + ny * 18
    ctx.font = "700 14px 'Atkinson Hyperlegible', system-ui, sans-serif"
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(247, 240, 222, 0.92)'
    ctx.fillRect(mx - tw / 2 - 5, my - 11, tw + 10, 20)
    ctx.fillStyle = '#b3261e'
    ctx.textAlign = 'center'
    ctx.fillText(label, mx, my + 4)
  }
  if (W.buoy) {
    const b = W.buoy, y = X(b.y) - heightAt(tank, b.x, b.y) * 10
    ctx.fillStyle = '#d23a2a'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(X(b.x), y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
}

// ─── Visto de lado ────────────────────────────────────────────────────────────
// Um corte da água ao longo da linha tracejada: a régua esticada até as bordas da cuba,
// ou, sem régua, a linha horizontal que passa pelo primeiro pingador.
function cutLine() {
  const r = W.ruler, rl = r ? Math.hypot(r.x2 - r.x1, r.y2 - r.y1) : 0
  let cx, cy, dx = 1, dy = 0
  if (rl > 0.01) { cx = r.x1; cy = r.y1; dx = (r.x2 - r.x1) / rl; dy = (r.y2 - r.y1) / rl }
  else { const s = W.sources[0]; cx = s ? s.x : TANK.W / 2; cy = s ? s.y : TANK.H / 2 }
  // quanto dá para andar para trás (t0) e para frente (t1) sem sair da cuba
  const lim = (p, d, max) => (d > 0 ? [-p / d, (max - p) / d] : d < 0 ? [(max - p) / d, -p / d] : [-Infinity, Infinity])
  const [a1, b1] = lim(cx, dx, TANK.W), [a2, b2] = lim(cy, dy, TANK.H)
  return { cx, cy, dx, dy, t0: Math.max(a1, a2) + 0.005, t1: Math.min(b1, b2) - 0.005, rl }
}

function drawCutOnTank() {
  const c = cutLine()
  ctx.save()
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = 'rgba(59, 50, 34, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(X(c.cx + c.dx * c.t0), X(c.cy + c.dy * c.t0))
  ctx.lineTo(X(c.cx + c.dx * c.t1), X(c.cy + c.dy * c.t1))
  ctx.stroke()
  ctx.restore()
}

function drawSide() {
  const top = tankH, h = SIDE_H, mid = top + h / 2 + 10, amp = h / 2 - 32
  const c = cutLine(), span = c.t1 - c.t0, N = 400
  const sx = t => (t - c.t0) / span * cssW
  ctx.fillStyle = C['paper-2']
  ctx.fillRect(0, top, cssW, h)
  ctx.fillStyle = C.ink
  ctx.fillRect(0, top, cssW, 2)
  ctx.fillStyle = C['ink-soft']
  ctx.font = "13px 'Atkinson Hyperlegible', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.fillText('A água vista de lado, ao longo da linha tracejada', 10, top + 20)

  // nível da água parada
  ctx.save()
  ctx.setLineDash([4, 6])
  ctx.strokeStyle = C['grid-strong']
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(cssW, mid); ctx.stroke()
  ctx.restore()

  // superfície da água; onde tem pedra, um bloco cinza
  const pts = []
  for (let i = 0; i <= N; i++) {
    const t = c.t0 + span * i / N, x = c.cx + c.dx * t, y = c.cy + c.dy * t
    const [ci, cj] = [Math.round(x / TANK.dx), Math.round(y / TANK.dx)]
    const wall = tank.wall[cj * tank.nx + ci]
    pts.push({ t, wall, u: wall ? 0 : Math.max(-1, Math.min(1, heightAt(tank, x, y) / CHART_RANGE)) })
  }
  ctx.fillStyle = '#8a847c'
  for (const p of pts) if (p.wall) ctx.fillRect(sx(p.t) - 1, mid - amp, cssW / N + 2, 2 * amp)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  let pen = false
  for (const p of pts) {
    if (p.wall) { pen = false; continue }
    const x = sx(p.t), y = mid - p.u * amp
    pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    pen = true
  }
  ctx.stroke()

  // marca a crista e o vale mais perto do meio da régua (ou do corte), fora dos trechos cortados pela escala
  const center = c.rl > 0.01 ? c.rl / 2 : (c.t0 + c.t1) / 2
  let crest = null, trough = null
  for (let i = 2; i < pts.length - 2; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1]
    if (p.wall || a.wall || b.wall || Math.abs(p.u) > 0.97) continue
    if (p.u > 0.15 && p.u >= a.u && p.u > b.u && (!crest || Math.abs(p.t - center) < Math.abs(crest.t - center))) crest = p
    if (p.u < -0.15 && p.u <= a.u && p.u < b.u && (!trough || Math.abs(p.t - center) < Math.abs(trough.t - center))) trough = p
  }
  ctx.font = "700 12px 'Atkinson Hyperlegible', system-ui, sans-serif"
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  if (crest) ctx.fillText('crista', sx(crest.t), mid - crest.u * amp - 8)
  if (trough) ctx.fillText('vale', sx(trough.t), Math.min(top + h - 4, mid - trough.u * amp + 16))

  // pontas da régua
  if (c.rl > 0.01) {
    ctx.strokeStyle = C.trace
    ctx.fillStyle = C.trace
    ctx.lineWidth = 2
    const x1 = sx(0), x2 = sx(c.rl), yb = top + h - 8
    ctx.beginPath()
    ctx.moveTo(x1, top + 26); ctx.lineTo(x1, yb)
    ctx.moveTo(x2, top + 26); ctx.lineTo(x2, yb)
    ctx.moveTo(x1, yb - 4); ctx.lineTo(x2, yb - 4)
    ctx.stroke()
  }
}

function drawChart() {
  if (!W.buoy) return
  const top = tankH + SIDE_H, h = CHART_H, mid = top + h / 2 + 8
  ctx.fillStyle = C['paper-2']
  ctx.fillRect(0, top, cssW, h)
  ctx.fillStyle = C.ink
  ctx.fillRect(0, top, cssW, 2)
  ctx.fillStyle = C['ink-soft']
  ctx.font = "13px 'Atkinson Hyperlegible', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.fillText(`boia: sobe e desce nos últimos ${CHART_SECONDS} s`, 10, top + 20)
  const hist = W.buoy.hist
  if (hist.length < 2) return
  const now = tank.t
  ctx.strokeStyle = C.trace
  ctx.lineWidth = 2
  ctx.beginPath()
  hist.forEach(([t, u], i) => {
    const x = cssW - (now - t) / CHART_SECONDS * cssW, y = mid - Math.max(-1, Math.min(1, u / CHART_RANGE)) * (h / 2 - 16)
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  })
  ctx.stroke()
}

// ─── Toques na cuba ───────────────────────────────────────────────────────────
let drag = null
const toMeters = e => {
  const r = cv.getBoundingClientRect()
  return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]
}
const inTank = (x, y) => x > 0.02 && y > 0.02 && x < TANK.W - 0.02 && y < TANK.H - 0.02
const stoneAt = (x, y) => W.stones.findLast(s => Math.hypot(x - s.x, y - s.y) < s.r * 1.1)

cv.addEventListener('pointerdown', e => {
  const [x, y] = toMeters(e)
  if (!inTank(x, y)) return
  Tone.start()
  cv.setPointerCapture(e.pointerId)
  const tool = W.tool
  if (tool === 'gota') { drop(tank, x, y, 2.2, 0.02); playPlink() }
  else if (tool === 'pingador') {
    const hit = W.sources.findIndex(s => Math.hypot(x - s.x, y - s.y) < 0.05)
    if (hit >= 0) W.sources.splice(hit, 1)
    else { if (W.sources.length >= 2) W.sources.shift(); W.sources.push({ x, y }) }
    changed()
  } else if (tool === 'pedra') {
    const s = stoneAt(x, y)
    if (s) drag = { type: 'stone', s, ox: x - s.x, oy: y - s.y, moved: false }
    else { W.stones.push(makeStone(x, y, 0.05 + Math.random() * 0.04)); applyStones() }
  } else if (tool === 'regua') {
    W.ruler = { x1: x, y1: y, x2: x, y2: y, checked: false }
    drag = { type: 'ruler' }
  } else if (tool === 'boia') {
    const first = !W.buoy
    W.buoy = { x, y, hist: [] }
    if (first) fit()
  }
  ui()
})
cv.addEventListener('pointermove', e => {
  if (!drag) return
  const [x, y] = toMeters(e)
  if (drag.type === 'ruler') {
    W.ruler.x2 = Math.max(0, Math.min(TANK.W, x))
    W.ruler.y2 = Math.max(0, Math.min(TANK.H, y))
    W.ruler.checked = false
    ui()
  } else if (drag.type === 'stone') {
    drag.s.x = Math.max(0.03, Math.min(TANK.W - 0.03, x - drag.ox))
    drag.s.y = Math.max(0.03, Math.min(TANK.H - 0.03, y - drag.oy))
    drag.moved = true
    applyStones()
  }
})
cv.addEventListener('pointerup', () => {
  if (drag?.type === 'stone' && !drag.moved) { W.stones.splice(W.stones.indexOf(drag.s), 1); applyStones() }
  if (drag?.type === 'ruler' && Math.hypot(W.ruler.x2 - W.ruler.x1, W.ruler.y2 - W.ruler.y1) < 0.01) W.ruler = null
  drag = null
  ui()
})

// ─── Painel ───────────────────────────────────────────────────────────────────
// Toda medida com a régua recebe resposta: acertou, ou o que ajustar.
// Vale medir várias cristas de uma vez: a régua divide pelo número de comprimentos de onda.
function checkRuler(r, lam) {
  const L = Math.hypot(r.x2 - r.x1, r.y2 - r.y1), cm = x => `${fmt(x * 100, 1)} cm`
  if (!W.sources.length) {
    notice('', `Na régua: ${cm(L)}. Para medir o comprimento de onda, ponha um pingador: com gotas soltas, as cristas não ficam a uma distância fixa.`)
    return
  }
  const n = Math.max(1, Math.round(L / lam)), each = L / n, err = Math.abs(each - lam) / lam
  if (err < 0.1) {
    markDone('ruler')
    let msg = n === 1
      ? `Na régua: ${cm(L)}. A conta dá λ = v ÷ f = ${cm(lam)}. Medida e conta batem.`
      : `Na régua: ${cm(L)}, que são ${n} comprimentos de onda: ${cm(L)} ÷ ${n} = ${cm(each)}. A conta dá λ = ${cm(lam)}. Medir várias cristas de uma vez é mais preciso.`
    if (W.world === 'tita') {
      markDone('tita')
      const earth = wavelength(waveSpeed(WORLDS.terra.g, W.h), W.f)
      msg += ` Na Terra, com a mesma água e o mesmo pingador, seriam ${cm(earth)}: em Titã a onda anda mais devagar, então as cristas ficam mais perto.`
    }
    notice('ok', msg)
    return
  }
  const nearSource = W.sources.some(s => Math.min(Math.hypot(s.x - r.x1, s.y - r.y1), Math.hypot(s.x - r.x2, s.y - r.y2)) < 0.05)
  if (Math.abs(L / (lam / 2) - 1) < 0.15) {
    notice('warn', `Na régua: ${cm(L)}, quase a metade de λ = ${cm(lam)}. Você mediu de uma crista (linha clara) até um vale (linha escura): isso é meio comprimento de onda. Veja no corte embaixo da cuba e vá de um pico até o pico seguinte.`)
    return
  }
  notice('warn', `Na régua: ${cm(L)}. A conta dá λ = ${cm(lam)}, uma diferença de ${fmt(err * 100, 0)}%. ` +
    (nearSource
      ? 'Uma ponta está no pingador, mas ele não é uma crista. No corte embaixo da cuba, ponha as pontas vermelhas em dois picos vizinhos.'
      : 'No corte embaixo da cuba, as pontas vermelhas da régua precisam ficar em dois picos vizinhos. Dica: pause a água para medir com calma.'))
}

function checkChallenges() {
  const lam = lambda(), v = speed()
  const r = W.ruler
  if (r && !r.checked && !drag) {
    r.checked = true
    checkRuler(r, lam)
  }
  // Areia parada: a boia mexe bem menos que um ponto à mesma distância na linha do meio dos dois pingadores
  if (W.sources.length === 2 && W.buoy && !W.stillFound) {
    const [a, b] = W.sources, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    const dist = Math.hypot(W.buoy.x - mx, W.buoy.y - my)
    if (tank.t - W.changedAt > 3 + dist / v && dist > 0.1) {
      let nx = -(b.y - a.y), ny = b.x - a.x
      const n = Math.hypot(nx, ny); nx /= n; ny /= n
      if (nx * (W.buoy.x - mx) + ny * (W.buoy.y - my) < 0) { nx = -nx; ny = -ny }
      const rx = mx + nx * dist, ry = my + ny * dist
      if (inTank(rx, ry)) {
        const here = amplitudeAt(tank, W.buoy.x, W.buoy.y), ref = amplitudeAt(tank, rx, ry)
        if (ref > 0.05 && here < 0.25 * ref) {
          W.stillFound = true
          markDone('still')
          notice('ok', 'Achou: a boia quase não se mexe. Aqui a onda de um pingador chega sempre meio comprimento de onda atrasada em relação à do outro. Crista com vale: as duas se apagam.')
        }
      }
    }
  }
}

function ui() {
  const g = WORLDS[W.world].g, v = speed(), lam = lambda()
  $('h-out').textContent = `${fmt(W.h * 100, W.h * 100 % 1 ? 2 : 1)} cm`
  $('f-out').textContent = `${fmt(W.f, 1)} Hz`
  $('r-v').textContent = `${fmt(v * 100, 1)} cm/s`
  $('r-l').textContent = `${fmt(lam * 100, 1)} cm`
  $('r-ruler').textContent = W.ruler ? `${fmt(Math.hypot(W.ruler.x2 - W.ruler.x1, W.ruler.y2 - W.ruler.y1) * 100, 1)} cm` : '—'

  $('math').innerHTML =
    `<p class="eq">v = √(g × h) = √(${fmt(g, 2)} × ${fmt(W.h, 4)}) = ${fmt(v, 3)} m/s</p>` +
    `<p class="eq">λ = v ÷ f = ${fmt(v, 3)} ÷ ${fmt(W.f, 1)} = ${fmt(lam, 3)} m</p>` +
    '<p>A velocidade não depende de quantas vezes por segundo o pingador bate: pingador mais rápido só deixa as cristas mais juntas.</p>' +
    '<p>Essa conta vale para água rasa, quando a onda é bem mais comprida que a profundidade. Em água funda as ondas seguem outra regra.</p>'

  let cls = '', msg
  if (noticeActive()) ({ cls, msg } = W.event)
  else if (!W.sources.length) msg = 'Solte gotas tocando na areia. Para ondas sem parar, escolha Pingador e toque na cuba.'
  else if (W.sources.length === 1) {
    msg = `Cada crista sai do pingador a cada ${fmt(1 / W.f, 2)} s e anda a ${fmt(v * 100, 1)} cm/s. Então as cristas ficam a λ = v ÷ f = ${fmt(lam * 100, 1)} cm uma da outra. Confira com a régua.`
    if (lam > 1.2) msg += ' Com ondas tão compridas, pouco mais de uma crista cabe na cuba.'
  } else msg = 'Onde crista encontra crista, a onda cresce. Onde crista encontra vale, as duas se apagam e a areia fica parada. Procure essas linhas com a boia.'
  const st = $('status')
  st.className = 'status' + (cls ? ' ' + cls : '')
  if (st.textContent !== msg) st.textContent = msg
}

// ─── Laço principal ───────────────────────────────────────────────────────────
let last = null, uiTimer = 0, lastBeat = 0
function frame(time) {
  const dt = last === null ? 0 : Math.min(1 / 30, (time - last) / 1000)
  last = time
  if (dt > 0 && !W.paused) {
    const sources = W.sources.map(s => ({ x: s.x, y: s.y, f: W.f, amp: 1 }))
    advance(tank, dt, speed(), sources)
    updateRms(tank, dt)
    const beat = Math.floor(tank.t * W.f)
    if (W.sources.length && beat !== lastBeat) playTick()
    lastBeat = beat
    if (W.buoy) {
      W.buoy.hist.push([tank.t, heightAt(tank, W.buoy.x, W.buoy.y)])
      while (W.buoy.hist.length && tank.t - W.buoy.hist[0][0] > CHART_SECONDS + 0.3) W.buoy.hist.shift()
    }
  }
  uiTimer += dt
  if (uiTimer > 0.25) { uiTimer = 0; checkChallenges(); ui() }

  if (cssW) {
    drawSand()
    drawStones()
    drawScale()
    drawCutOnTank()
    drawTools()
    drawSide()
    drawChart()
  }
  requestAnimationFrame(frame)
}

setWorld('terra', false)
setTool('gota')
loadPreset('zen', false)
fit()
drop(tank, 0.8, 0.5, 2.2, 0.02)
requestAnimationFrame(frame)
