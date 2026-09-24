import * as Tone from 'tone'
import {
  PLANETS, STRINGS, pendulumStep, smallAnglePeriod, exactPeriod, createTimer, timerUpdate,
  stringFrequency, noteOf, centsBetween,
} from './physics.js'
import { RANGES } from './ranges.js'

const $ = id => document.getElementById(id)
const fmt = (v, d) => v.toFixed(d).replace('.', ',')
const DEG = Math.PI / 180

// ─── Cores do tema (lidas do CSS, para o canvas acompanhar o modo escuro) ─────
const C = {}
function readColors() {
  const cs = getComputedStyle(document.documentElement)
  for (const k of ['paper-2', 'grid', 'grid-strong', 'ink', 'ink-soft', 'trace'])
    C[k] = cs.getPropertyValue('--' + k).trim()
}
readColors()
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors)

// ─── Canvas nítido em telas de alta densidade ─────────────────────────────────
function setupCanvas(cv) {
  const ctx = cv.getContext('2d')
  const fit = () => {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    cv.width = Math.round(r.width * dpr)
    cv.height = Math.round(r.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cv.w = r.width
    cv.h = r.height
  }
  new ResizeObserver(fit).observe(cv)
  fit()
  return ctx
}

// Papel quadriculado: uma linha a cada `cell` px, mais forte a cada 5.
function drawPaper(ctx, x0, y0, w, h, cell, ox, oy) {
  ctx.fillStyle = C['paper-2']
  ctx.fillRect(x0, y0, w, h)
  ctx.lineWidth = 1
  const start = (o, a) => o - Math.ceil((o - a) / cell) * cell
  for (let x = start(ox, x0), i = Math.round((x - ox) / cell); x <= x0 + w; x += cell, i++) {
    ctx.strokeStyle = i % 5 === 0 ? C['grid-strong'] : C.grid
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, y0); ctx.lineTo(Math.round(x) + 0.5, y0 + h); ctx.stroke()
  }
  for (let y = start(oy, y0), i = Math.round((y - oy) / cell); y <= y0 + h; y += cell, i++) {
    ctx.strokeStyle = i % 5 === 0 ? C['grid-strong'] : C.grid
    ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(x0 + w, Math.round(y) + 0.5); ctx.stroke()
  }
}

function label(ctx, text, x, y, align = 'left', color = C['ink-soft'], size = 13) {
  ctx.fillStyle = color
  ctx.font = `${size}px 'Atkinson Hyperlegible', system-ui, sans-serif`
  ctx.textAlign = align
  ctx.fillText(text, x, y)
}

function setRange(input, r) {
  Object.assign(input, { min: r.min, max: r.max, step: r.step })
  input.value = r.value
}

function setStatus(el, cls, msg) {
  el.className = 'status' + (cls ? ' ' + cls : '')
  if (el.textContent !== msg) el.textContent = msg
}

function markDone(list, key) {
  $(list).querySelector(`[data-g="${key}"]`).classList.add('done')
}

// Mensagem de um acontecimento, que fica no aviso por alguns segundos.
const notice = (cls, msg) => ({ cls, msg, until: performance.now() + 9000 })
const noticeActive = e => e && performance.now() < e.until

// ─── Som ──────────────────────────────────────────────────────────────────────
let soundOn = true
const tickSynth = new Tone.Synth({
  oscillator: { type: 'square' },
  envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 },
  volume: -22,
}).toDestination()
const noteSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.8 },
  volume: -8,
}).toDestination()

function playTick() {
  if (soundOn && Tone.context.state === 'running') tickSynth.triggerAttackRelease(1600, 0.03)
}
async function playNote(f) {
  if (!soundOn || f < 20) return
  await Tone.start()
  noteSynth.triggerAttackRelease(f, 1.6)
}

$('sound').addEventListener('click', () => {
  soundOn = !soundOn
  $('sound').setAttribute('aria-pressed', soundOn)
  $('sound').textContent = soundOn ? 'Som ligado' : 'Som desligado'
  if (soundOn) Tone.start()
})

// ─── Planeta (vale para as duas abas) ─────────────────────────────────────────
let planet = 'terra'
const gNow = () => PLANETS[planet].g

const planetBtns = Object.entries(PLANETS).map(([key, p]) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = p.name
  b.addEventListener('click', () => setPlanet(key))
  $('planet').appendChild(b)
  return [key, b]
})

function setPlanet(key) {
  planet = key
  planetBtns.forEach(([k, b]) => b.setAttribute('aria-pressed', k === key))
  $('gval').textContent = `g = ${fmt(gNow(), 2)} m/s²`
  pendOnPlanet()
  strOnChange()
}

// ─── Abas ─────────────────────────────────────────────────────────────────────
const tabs = [['tab-pend', 'pane-pend'], ['tab-corda', 'pane-corda']]
tabs.forEach(([tab]) => $(tab).addEventListener('click', () => {
  tabs.forEach(([t, p]) => {
    $(t).setAttribute('aria-selected', t === tab)
    $(p).hidden = t !== tab
  })
}))

// ═════════════════════════════════════════════════════════════════════════════
// PÊNDULO
// ═════════════════════════════════════════════════════════════════════════════
const pCanvas = $('p-canvas')
const pctx = setupCanvas(pCanvas)
const P = {
  L: RANGES.L.value, bob: RANGES.bob.value, angle: RANGES.angle.value, side: 1,
  running: false, s: { theta: 0, omega: 0, t: 0 }, tm: createTimer(),
  trace: [], crossings: 0, flash: 0, massTest: null, event: null, drag: false,
}
const CHART_SECONDS = 8

setRange($('p-L'), RANGES.L)
setRange($('p-bob'), RANGES.bob)
setRange($('p-angle'), RANGES.angle)

function resetTimer() {
  P.tm = createTimer()
  P.tm.prevTheta = P.s.theta
  P.tm.prevT = P.s.t
  P.massTest = null
}

// Amplitude atual, pela energia: o ângulo máximo que a bola vai alcançar.
function amplitude() {
  const c = Math.cos(P.s.theta) - P.L * P.s.omega ** 2 / (2 * gNow())
  return Math.acos(Math.max(-1, Math.min(1, c)))
}

function release() {
  Tone.start()
  P.s = { theta: P.angle * DEG * P.side, omega: 0, t: 0 }
  P.trace = []
  P.crossings = 0
  P.event = null
  resetTimer()
  P.running = true
  pendUI()
}

function stop() {
  P.running = false
  P.s.theta = P.angle * DEG * P.side
  P.s.omega = 0
  pendUI()
}

$('p-run').addEventListener('click', () => (P.running ? stop() : release()))

$('p-L').addEventListener('input', e => {
  P.L = +e.target.value
  if (P.running) resetTimer()
  pendUI()
})
$('p-bob').addEventListener('input', e => {
  P.bob = +e.target.value
  if (P.running && P.tm.period) P.massTest = { before: P.tm.period, at: P.crossings }
  pendUI()
})
$('p-angle').addEventListener('input', e => {
  P.angle = +e.target.value
  if (!P.running) P.s.theta = P.angle * DEG * P.side
  pendUI()
})

function pendOnPlanet() {
  if (P.running) resetTimer()
  pendUI()
}

// Cada passagem pelo ponto mais baixo: tique, registro e checagem dos desafios.
function onCrossing() {
  P.crossings++
  P.flash = 1
  playTick()
  const T = P.tm.period
  if (!T) return
  if (Math.abs(120 / T - 60) < 0.5) markDone('p-goals', 'bpm')
  if (planet === 'lua') markDone('p-goals', 'moon')
  if (amplitude() >= 79.5 * DEG) markDone('p-goals', 'wide')
  if (P.massTest && P.crossings >= P.massTest.at + 3) {
    P.event = notice('ok', `Você trocou a massa e a ida e volta continuou em ${fmt(T, 3)} s (antes: ${fmt(P.massTest.before, 3)} s). A massa não entra na fórmula: bola leve ou pesada, o ritmo é o mesmo.`)
    markDone('p-goals', 'mass')
    P.massTest = null
  }
}

function pendUI() {
  const g = gNow(), Tf = smallAnglePeriod(P.L, g), T = P.running ? P.tm.period : null
  $('p-L-out').textContent = `${fmt(P.L, 2)} m`
  $('p-bob-out').textContent = `${fmt(P.bob, 2)} kg`
  $('p-angle-out').textContent = `${P.angle}°`
  $('p-angle').disabled = P.running
  $('p-run').textContent = P.running ? 'Parar' : 'Soltar'
  $('p-meas').textContent = T ? `${fmt(T, 3)} s` : '—'
  $('p-formula').textContent = `${fmt(Tf, 3)} s`
  $('p-bpm').textContent = T ? fmt(120 / T, 1) : '—'

  const ampDeg = P.running ? amplitude() / DEG : P.angle
  const Tx = exactPeriod(P.L, g, ampDeg * DEG)
  $('p-math').innerHTML =
    `<p class="eq">T = 2π × √(L ÷ g)</p>` +
    `<p class="eq">T = 2π × √(${fmt(P.L, 2)} ÷ ${fmt(g, 2)}) = ${fmt(Tf, 3)} s</p>` +
    `<p>A massa da bola (${fmt(P.bob, 2)} kg) não aparece em lugar nenhum da conta.</p>` +
    `<p>Tiques por minuto = 120 ÷ T, porque o pêndulo passa duas vezes pelo ponto mais baixo em cada ida e volta.</p>` +
    `<p>Essa fórmula vale para ângulos pequenos. Com ${Math.round(ampDeg)}° de abertura, a ida e volta exata leva ${fmt(Tx, 3)} s.</p>`

  let cls = '', msg
  if (noticeActive(P.event)) ({ cls, msg } = P.event)
  else if (!P.running) msg = 'Parado. Arraste a bola para o lado, ou escolha o ângulo, e aperte Soltar.'
  else if (!T) msg = 'Medindo: espere a bola ir e voltar uma vez.'
  else if (ampDeg <= 15) {
    cls = 'ok'
    msg = `Medido: ${fmt(T, 3)} s. A fórmula diz ${fmt(Tf, 3)} s. Com ângulos pequenos, T = 2π√(L ÷ g) acerta em cheio.`
  } else {
    cls = 'warn'
    msg = `Com ${Math.round(ampDeg)}° de abertura, a bola demora ${fmt((T / Tf - 1) * 100, 1)}% a mais do que a fórmula diz. Ela é uma aproximação que só vale para ângulos pequenos, até uns 15°.`
  }
  setStatus($('p-status'), cls, msg)
}

// Geometria do desenho: o pivô no alto, escala fixa em que cabe o fio de 2 m
// (na horizontal, até uns 50° de abertura; mais que isso, a bola encosta na borda).
function pendLayout() {
  const w = pCanvas.w, h = pCanvas.h, top = h * 0.72
  const scale = Math.min((top - 50) / RANGES.L.max, (w / 2 - 24) / (RANGES.L.max * 0.75))
  return { w, h, top, scale, px: w / 2, py: 22 }
}
const bobRadius = () => 7 + 13 * Math.cbrt(P.bob / RANGES.bob.max)
function bobPos(lay) {
  const r = P.L * lay.scale
  return [lay.px + r * Math.sin(P.s.theta), lay.py + r * Math.cos(P.s.theta)]
}

// Arrastar a bola define o ângulo de soltura (e para o pêndulo, se estiver balançando).
function pendPointer(e) {
  const r = pCanvas.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
pCanvas.addEventListener('pointerdown', e => {
  const lay = pendLayout(), [x, y] = pendPointer(e), [bx, by] = bobPos(lay)
  if (Math.hypot(x - bx, y - by) > bobRadius() + 16) return
  if (P.running) stop()
  P.drag = true
  pCanvas.setPointerCapture(e.pointerId)
})
pCanvas.addEventListener('pointermove', e => {
  const lay = pendLayout(), [x, y] = pendPointer(e)
  if (!P.drag) {
    const [bx, by] = bobPos(lay)
    pCanvas.style.cursor = Math.hypot(x - bx, y - by) < bobRadius() + 16 ? 'grab' : 'default'
    return
  }
  const a = Math.atan2(x - lay.px, Math.max(0, y - lay.py)) / DEG
  P.side = a < 0 ? -1 : 1
  P.angle = Math.max(RANGES.angle.min, Math.min(RANGES.angle.max, Math.round(Math.abs(a))))
  $('p-angle').value = P.angle
  P.s.theta = P.angle * DEG * P.side
  pendUI()
})
pCanvas.addEventListener('pointerup', () => { P.drag = false })

function drawPendulum() {
  const ctx = pctx, lay = pendLayout(), { w, h, top, scale, px, py } = lay
  if (!w) return
  const cell = scale * 0.1
  drawPaper(ctx, 0, 0, w, top, cell, px, py)

  // Posição de repouso e ângulo de soltura
  if (!P.running) {
    ctx.save()
    ctx.setLineDash([4, 6])
    ctx.strokeStyle = C['ink-soft']
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + P.L * scale); ctx.stroke()
    const ar = Math.min(60, P.L * scale * 0.4), a0 = Math.PI / 2, a1 = a0 - P.s.theta
    ctx.beginPath(); ctx.arc(px, py, ar, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke()
    ctx.restore()
    label(ctx, `${P.angle}°`, px + P.side * 10, py + ar + 16, P.side > 0 ? 'left' : 'right', C.ink, 14)
  }

  // Marca do ponto mais baixo, que acende a cada tique
  const lowY = py + P.L * scale
  ctx.strokeStyle = P.flash > 0 ? C.trace : C['grid-strong']
  ctx.lineWidth = 2 + 2 * P.flash
  ctx.beginPath(); ctx.moveTo(px - 8, lowY + bobRadius() + 6); ctx.lineTo(px + 8, lowY + bobRadius() + 6); ctx.stroke()

  // Fio, pivô e bola
  const [bx, by] = bobPos(lay)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke()
  ctx.fillStyle = C.ink
  ctx.fillRect(px - 26, py - 8, 52, 6)
  ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(bx, by, bobRadius(), 0, Math.PI * 2); ctx.fill()

  label(ctx, 'cada quadradinho = 10 cm', 10, top - 10)
  if (!P.running) label(ctx, 'arraste a bola para escolher o ângulo', 10, top - 30)

  // Registro do ângulo ao longo do tempo (a "fita" do oscilógrafo)
  const ch = h - top, mid = top + ch / 2 + 8, amp = (ch / 2 - 18) / 90
  ctx.fillStyle = C['paper-2']
  ctx.fillRect(0, top, w, ch)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.lineTo(w, top + 1); ctx.stroke()
  ctx.strokeStyle = C['grid-strong']
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke()
  label(ctx, `ângulo ao longo do tempo, últimos ${CHART_SECONDS} s`, 10, top + 20)
  if (P.trace.length > 1) {
    const now = P.s.t, xs = t => w - (now - t) / CHART_SECONDS * w
    ctx.strokeStyle = C.trace
    ctx.lineWidth = 2
    ctx.beginPath()
    P.trace.forEach(([t, th], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs(t), mid - th / DEG * amp))
    ctx.stroke()
    ctx.fillStyle = C.ink
    for (const t of P.tm.crossings) if (now - t < CHART_SECONDS) ctx.fillRect(xs(t) - 1, mid - 5, 2, 10)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CORDA QUE CANTA
// ═════════════════════════════════════════════════════════════════════════════
const sCanvas = $('s-canvas')
const sctx = setupCanvas(sCanvas)
const S = {
  L: RANGES.sL.value, m: RANGES.m.value, str: 'fina', broken: false,
  pluckT: null, last: null, event: null, drag: false,
  snapped: null, // { T, str } da corda que arrebentou
}

setRange($('s-L'), RANGES.sL)
setRange($('s-m'), RANGES.m)

const strBtns = Object.entries(STRINGS).map(([key, s]) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = s.name
  b.addEventListener('click', () => { S.str = key; strOnChange() })
  $('s-str').appendChild(b)
  return [key, b]
})

const tension = () => S.m * gNow()
const freq = () => stringFrequency(S.L, tension(), STRINGS[S.str].mu)

$('s-L').addEventListener('input', e => { S.L = +e.target.value; strOnChange() })
$('s-m').addEventListener('input', e => { S.m = +e.target.value; strOnChange() })
$('s-pluck').addEventListener('click', pluck)
$('s-fix').addEventListener('click', () => { S.broken = false; S.snapped = null; S.event = null; strOnChange() })

function strOnChange() {
  const T = tension(), st = STRINGS[S.str]
  if (!S.broken && T > st.maxT) {
    S.broken = true
    S.snapped = { T, str: S.str }
    S.pluckT = null
    S.event = null
    markDone('s-goals', 'snap')
  }
  strUI()
}

function pluck() {
  if (S.broken) return
  const f = freq(), n = noteOf(f)
  S.pluckT = 0
  playNote(f)
  S.event = null
  if (n.label === 'Lá4' && Math.abs(n.cents) <= 10) {
    markDone('s-goals', 'la')
    S.event = notice('ok', `Lá 440! A corda vibra ${fmt(f, 1)} vezes por segundo, a mesma nota do diapasão que as orquestras usam para afinar.`)
  }
  const last = S.last
  if (last && last.planet === planet && last.str === S.str && Math.abs(centsBetween(last.f, f) - 1200) <= 15) {
    if (last.m === S.m && last.L !== S.L) {
      markDone('s-goals', 'octL')
      S.event = notice('ok', `Uma oitava acima: de ${fmt(last.f, 0)} para ${fmt(f, 0)} Hz, o dobro. Com metade do comprimento, a corda vibra duas vezes mais rápido.`)
    } else if (last.L === S.L && last.m !== S.m) {
      markDone('s-goals', 'octM')
      S.event = notice('ok', `Uma oitava acima: de ${fmt(last.f, 0)} para ${fmt(f, 0)} Hz. Foi preciso ${fmt(S.m / last.m, 0)}× o peso para dobrar a frequência, porque ela cresce com a raiz quadrada da tensão.`)
    }
  }
  S.last = { f, L: S.L, m: S.m, str: S.str, planet }
  strUI()
}

function strUI() {
  const T = tension(), st = STRINGS[S.str], f = freq(), n = noteOf(f), g = gNow()
  strBtns.forEach(([k, b]) => b.setAttribute('aria-pressed', k === S.str))
  $('s-L-out').textContent = `${fmt(S.L * 100, 1)} cm`
  $('s-m-out').textContent = `${fmt(S.m, 1)} kg`
  $('s-f').textContent = `${fmt(f, f < 100 ? 1 : 0)} Hz`
  $('s-note').textContent = f < 20 ? '—' : n.label
  $('s-T').textContent = `${fmt(T, T < 10 ? 1 : 0)} N`
  $('s-pluck').disabled = S.broken
  $('s-fix').hidden = !S.broken
  $('s-fix').disabled = T > st.maxT

  $('s-math').innerHTML =
    `<p class="eq">T = m × g = ${fmt(S.m, 1)} × ${fmt(g, 2)} = ${fmt(T, 1)} N</p>` +
    `<p class="eq">f = (1 ÷ 2L) × √(T ÷ μ)</p>` +
    `<p class="eq">f = (1 ÷ (2 × ${fmt(S.L, 3)})) × √(${fmt(T, 1)} ÷ ${fmt(st.mu, 4)}) = ${fmt(f, 1)} Hz</p>` +
    `<p>μ é quanto pesa um metro de corda: ${fmt(st.mu * 1000, 1)} g na corda ${st.name}. Corda mais pesada vibra mais devagar.</p>`

  let cls = '', msg
  if (S.broken) {
    const sn = STRINGS[S.snapped.str]
    cls = 'bad'
    msg = `A corda arrebentou: recebeu ${fmt(S.snapped.T, 0)} N de tensão, e uma corda ${sn.name} de aço aguenta uns ${sn.maxT} N.` +
      (T > st.maxT
        ? ` Para trocar, primeiro deixe a tensão abaixo de ${st.maxT} N, o limite da corda ${st.name}: menos peso, ou uma corda mais grossa.`
        : ` Com a corda ${st.name} e ${fmt(T, 0)} N, dá para montar de novo: aperte Trocar a corda.`)
  } else if (noticeActive(S.event)) ({ cls, msg } = S.event)
  else if (f < 20) {
    cls = 'warn'
    msg = `${fmt(f, 1)} Hz: grave demais. Abaixo de umas 20 vibrações por segundo, o ouvido humano não escuta uma nota. Estique mais ou encurte a corda.`
  } else if (T > 0.8 * st.maxT) {
    cls = 'warn'
    msg = `Tensão alta: ${fmt(T, 0)} N, perto do limite de ${st.maxT} N desta corda. Mais um pouco e ela arrebenta.`
  } else {
    const c = n.cents
    const tune = Math.abs(c) <= 5 ? ', afinada' : c > 0 ? `, ${c} cents acima (um pouco aguda)` : `, ${-c} cents abaixo (um pouco grave)`
    msg = `A corda vibra ${fmt(f, 1)} vezes por segundo. A nota mais próxima é ${n.label}${tune}.`
  }
  setStatus($('s-status'), cls, msg)
}

// Geometria: presilha à esquerda, cavalete móvel, roldana à direita com o peso.
function strLayout() {
  const w = sCanvas.w, h = sCanvas.h, x0 = 36
  const scale = (w - x0 - 96) / (RANGES.sL.max + 0.04)
  const xP = x0 + (RANGES.sL.max + 0.04) * scale
  return { w, h, x0, scale, xP, y0: Math.round(h * 0.36), R: 15 }
}

function strPointer(e) {
  const r = sCanvas.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
sCanvas.addEventListener('pointerdown', e => {
  const lay = strLayout(), [x, y] = strPointer(e), xB = lay.x0 + S.L * lay.scale
  if (Math.abs(x - xB) < 18 && Math.abs(y - lay.y0 - 12) < 26) {
    S.drag = true
    sCanvas.setPointerCapture(e.pointerId)
  } else if (x > lay.x0 && x < xB && Math.abs(y - lay.y0) < 30) {
    Tone.start()
    pluck()
  }
})
sCanvas.addEventListener('pointermove', e => {
  const lay = strLayout(), [x, y] = strPointer(e), xB = lay.x0 + S.L * lay.scale
  if (!S.drag) {
    const onBridge = Math.abs(x - xB) < 18 && Math.abs(y - lay.y0 - 12) < 26
    const onString = x > lay.x0 && x < xB && Math.abs(y - lay.y0) < 30
    sCanvas.style.cursor = onBridge ? 'ew-resize' : onString && !S.broken ? 'pointer' : 'default'
    return
  }
  const r = RANGES.sL, L = Math.round((x - lay.x0) / lay.scale / r.step) * r.step
  S.L = Math.max(r.min, Math.min(r.max, +L.toFixed(3)))
  $('s-L').value = S.L
  strOnChange()
})
sCanvas.addEventListener('pointerup', () => { S.drag = false })

function drawString(dt) {
  const ctx = sctx, lay = strLayout(), { w, h, x0, scale, xP, y0, R } = lay
  if (!w) return
  drawPaper(ctx, 0, 0, w, h, scale * 0.05, x0, y0)
  const xB = x0 + S.L * scale, st = STRINGS[S.str]
  const thick = { fina: 1.5, media: 2.5, grossa: 3.8 }[S.str]
  const side = 16 + 26 * Math.cbrt(S.m / RANGES.m.max)

  // Mesa, presilha e roldana (presa na quina da mesa; o peso fica pendurado para fora)
  const yT = y0 + 80, xT = xP - 10
  ctx.fillStyle = C.ink
  ctx.fillRect(0, yT, xT, 8)
  ctx.fillRect(x0 - 16, y0 - 18, 16, yT - y0 + 18)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(xP, y0 + R); ctx.lineTo(xT, yT); ctx.stroke()
  ctx.beginPath(); ctx.arc(xP, y0 + R, R, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(xP, y0 + R, 3, 0, Math.PI * 2); ctx.fill()

  ctx.strokeStyle = C.ink
  ctx.lineWidth = thick
  if (S.broken) {
    // Duas pontas soltas, e o peso no chão
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + 70, y0 + 6, x0 + 80, y0 + 74); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(xP + R, y0 + R); ctx.quadraticCurveTo(xP + R + 4, h - side - 30, xP + R + 18, h - side - 4); ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.fillRect(xP + R + 18 - side / 2, h - side - 4, side, side)
    label(ctx, 'arrebentou', x0 + 96, y0 + 60, 'left', C.trace, 15)
  } else {
    // Trecho que vibra (entre a presilha e o cavalete)
    let amp = 0
    if (S.pluckT !== null) {
      S.pluckT += dt
      amp = 22 * Math.exp(-S.pluckT / 1.3)
      if (amp < 0.3) S.pluckT = null
    }
    const f = freq(), fv = Math.min(7, 1.5 + f / 150) // câmera lenta: a vibração real é rápida demais para ver
    const phase = Math.cos(2 * Math.PI * fv * (S.pluckT || 0))
    ctx.beginPath()
    for (let i = 0; i <= 60; i++) {
      const x = x0 + (xB - x0) * i / 60
      const y = y0 + amp * phase * Math.sin(Math.PI * i / 60)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
    // Resto da corda: até a roldana e descendo até o peso
    const yW = y0 + R + 70
    ctx.beginPath(); ctx.moveTo(xB, y0); ctx.lineTo(xP, y0); ctx.arc(xP, y0 + R, R, -Math.PI / 2, 0); ctx.lineTo(xP + R, yW); ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.fillRect(xP + R - side / 2, yW, side, side)
    label(ctx, `${fmt(S.m, 1)} kg`, xP + R, yW + side + 18, 'center', C.ink, 14)
    if (amp > 0.3) label(ctx, 'vibração em câmera lenta', (x0 + xB) / 2, y0 - 34, 'center')

    // Medida do comprimento que vibra
    const yd = y0 + 40
    ctx.strokeStyle = C.trace
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x0, yd - 6); ctx.lineTo(x0, yd + 6); ctx.moveTo(xB, yd - 6); ctx.lineTo(xB, yd + 6); ctx.moveTo(x0, yd); ctx.lineTo(xB, yd); ctx.stroke()
    label(ctx, `L = ${fmt(S.L * 100, 1)} cm`, (x0 + xB) / 2, yd + 20, 'center', C.trace, 14)
  }

  // Cavalete (triângulo embaixo da corda)
  ctx.fillStyle = C.ink
  ctx.beginPath(); ctx.moveTo(xB, y0 + 1); ctx.lineTo(xB - 11, y0 + 26); ctx.lineTo(xB + 11, y0 + 26); ctx.closePath(); ctx.fill()

  label(ctx, 'Arraste o cavalete para mudar o comprimento, ou toque na corda', 10, h - 12)
}

// ─── Laço principal ───────────────────────────────────────────────────────────
const STEP = 1 / 240
let last = null, acc = 0, uiTimer = 0

function loop(time) {
  const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000)
  last = time

  if (P.running) {
    acc += dt
    while (acc >= STEP) {
      pendulumStep(P.s, STEP, P.L, gNow())
      if (timerUpdate(P.tm, P.s)) onCrossing()
      acc -= STEP
    }
    P.trace.push([P.s.t, P.s.theta])
    while (P.trace.length && P.s.t - P.trace[0][0] > CHART_SECONDS + 0.5) P.trace.shift()
  } else acc = 0
  P.flash = Math.max(0, P.flash - dt * 4)

  uiTimer += dt
  if (uiTimer > 0.25) {
    uiTimer = 0
    if (P.running || noticeActive(P.event) || P.event) pendUI()
    if (S.event) strUI()
    if (P.event && !noticeActive(P.event)) P.event = null
    if (S.event && !noticeActive(S.event)) S.event = null
  }

  if (!$('pane-pend').hidden) drawPendulum()
  else drawString(dt)
  requestAnimationFrame(loop)
}

setPlanet('terra')
P.s.theta = P.angle * DEG
pendUI()
strUI()
requestAnimationFrame(loop)
