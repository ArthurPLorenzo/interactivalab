import Matter from 'matter-js'
import * as Tone from 'tone'

const { Engine, Body, Bodies, World } = Matter

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas')
const ctx    = canvas.getContext('2d')

function resize() {
  const wrap = canvas.parentElement
  canvas.width  = wrap.clientWidth
  canvas.height = wrap.clientHeight
}
resize()
window.addEventListener('resize', () => {
  resize()
  // Keep ball inside new bounds
  Body.setPosition(ball, {
    x: Math.max(BALL_R, Math.min(canvas.width  - BALL_R, ball.position.x)),
    y: Math.max(BALL_R, Math.min(canvas.height - BALL_R, ball.position.y)),
  })
})

// ─── Physics engine ───────────────────────────────────────────────────────────
const engine = Engine.create({ gravity: { x: 0, y: 0 } })

const BALL_R = 26
const ball   = Bodies.circle(0, 0, BALL_R, {
  restitution: 0.05,
  friction:    0.005,
  frictionAir: 0.001,   // muito leve — momento persiste, força centrífuga acumula
  density:     0.004,
})
Body.setPosition(ball, { x: canvas.width / 2, y: canvas.height * 0.38 })
World.add(engine.world, ball)
Body.setStatic(ball, true)  // start in pause mode

// ─── State ────────────────────────────────────────────────────────────────────
let mode     = 'pause'  // 'pause' | 'play'
let gravScale = 1.0

// Rope: { id, anchor:{x,y}, maxLen, pluck:{t,maxT,amp,perpX,perpY}|null }
const ropes  = []
let   ropeId = 0
const MAX_ROPES         = 5
const ANCHOR_SNAP       = 52      // px — cursor must be this close to snap to anchor
const ROPE_MIN_LEN      = 45      // px — minimum rope length
const SPRING_K          = 0.00005 // Hooke: força = K * stretch * mass (por frame²)
const MAX_STRETCH_RATIO = 0.60    // zona elástica normal: até 60% além do comprimento base
const HARD_MULT         = 28      // spring fica 28× mais rígido além da zona elástica
const GRIP_K            = 0.000015 // spring fraco → inércia pesada; órbita possível com força centrífuga
const GRIP_DEAD         = 8        // px de dead-zone antes do grip aplicar força

// ─── Anchor grid (top + left + right edges) ───────────────────────────────────
const ANCHOR_EDGE = 16   // px from edge
const ANCHOR_STEP = 72

function getAnchors() {
  const W = canvas.width, H = canvas.height
  const pts = []
  for (let x = ANCHOR_STEP; x <= W - ANCHOR_STEP; x += ANCHOR_STEP)
    pts.push({ x, y: ANCHOR_EDGE })
  for (let y = ANCHOR_STEP; y <= H - ANCHOR_STEP; y += ANCHOR_STEP)
    pts.push({ x: ANCHOR_EDGE, y })
  for (let y = ANCHOR_STEP; y <= H - ANCHOR_STEP; y += ANCHOR_STEP)
    pts.push({ x: W - ANCHOR_EDGE, y })
  return pts
}

function closestAnchor(px, py) {
  let best = null, bd = Infinity
  for (const a of getAnchors()) {
    const d = Math.hypot(a.x - px, a.y - py)
    if (d < bd) { bd = d; best = a }
  }
  return bd < ANCHOR_SNAP ? best : null
}

// ─── Tone.js setup ────────────────────────────────────────────────────────────
const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.42 })
const synth  = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope:   { attack: 0.003, decay: 0.55, sustain: 0.03, release: 1.8 },
  volume: -6,
})
synth.connect(reverb)
reverb.toDestination()
synth.maxPolyphony = 5

async function pluckSound(rope) {
  await Tone.start()
  const dx   = ball.position.x - rope.anchor.x
  const dy   = ball.position.y - rope.anchor.y
  const dist = Math.hypot(dx, dy) || 1
  const taut = Math.min(1, dist / rope.maxLen)

  // Short + taut = high frequency; long + slack = low
  const freq = Math.max(82, Math.min(1046,
    1100 * (100 / rope.maxLen) * (0.55 + taut * 0.9)
  ))
  const vol = Math.max(-22, -5 - rope.maxLen / 45 + taut * 4)
  synth.volume.rampTo(vol, 0.01)
  synth.triggerAttackRelease(freq, '4n')
}

// ─── Pointer helpers ──────────────────────────────────────────────────────────
function ptrXY(e) {
  const r = canvas.getBoundingClientRect()
  const s = e.changedTouches?.[0] ?? e
  return { x: s.clientX - r.left, y: s.clientY - r.top }
}

function hitBall(px, py) {
  return Math.hypot(px - ball.position.x, py - ball.position.y) < BALL_R + 14
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function ropeNear(px, py) {
  const bx = ball.position.x, by = ball.position.y
  for (let i = ropes.length - 1; i >= 0; i--) {
    const r = ropes[i]
    if (distToSeg(px, py, bx, by, r.anchor.x, r.anchor.y) < 12) return r
  }
  return null
}

// ─── Interaction state ────────────────────────────────────────────────────────
let ptr        = null   // { type, ... }
let snapAnchor = null   // anchor highlighted during rope creation
let lastTap    = { t: 0, rope: null }
// ropeGrip: ponto de contato mecânico na corda — independente de ptr
// { rope, gx, gy, startX, startY }
let ropeGrip = null

canvas.addEventListener('pointerdown',  onDown)
canvas.addEventListener('pointermove',  onMove)
canvas.addEventListener('pointerup',    onUp)
canvas.addEventListener('pointercancel', () => { ptr = null; ropeGrip = null; snapAnchor = null })

function onDown(e) {
  const p = ptrXY(e)
  canvas.setPointerCapture(e.pointerId)

  // ── Pause mode ──────────────────────────────────────────────────────────────
  if (mode === 'pause') {
    // Double-click on rope → delete (in pause too)
    if (!hitBall(p.x, p.y)) {
      const rope = ropeNear(p.x, p.y)
      if (rope) {
        const now = Date.now()
        if (now - lastTap.t < 340 && lastTap.rope === rope) {
          ropes.splice(ropes.indexOf(rope), 1)
          updateRopeCount()
          return
        }
        lastTap = { t: now, rope }
      }
      return
    }
    ptr = {
      type: 'pause-ball',
      startX: p.x, startY: p.y,
      startBallX: ball.position.x,
      startBallY: ball.position.y,
    }
    canvas.style.cursor = 'grabbing'
    return
  }

  // ── Play mode ───────────────────────────────────────────────────────────────
  if (hitBall(p.x, p.y)) {
    Body.setStatic(ball, true)
    ptr = { type: 'play-ball', hist: [{ x: p.x, y: p.y, t: Date.now() }] }
    canvas.style.cursor = 'grabbing'
    return
  }

  const rope = ropeNear(p.x, p.y)
  if (rope) {
    const now = Date.now()
    if (now - lastTap.t < 340 && lastTap.rope === rope) {
      ropes.splice(ropes.indexOf(rope), 1)
      updateRopeCount()
      return
    }
    lastTap = { t: now, rope }
    // Grip mecânico na corda — cria ponto de contato físico
    ropeGrip = { rope, gx: p.x, gy: p.y, startX: p.x, startY: p.y }
    canvas.style.cursor = 'grabbing'
  }
}

function onMove(e) {
  const p = ptrXY(e)

  // ── Grip: atualiza posição sempre, independente de ptr ─────────────────────
  if (ropeGrip) {
    ropeGrip.gx = p.x
    ropeGrip.gy = p.y
    canvas.style.cursor = 'grabbing'
  }

  if (!ptr) {
    if (!ropeGrip) {
      // Hover feedback (só quando sem grip ativo)
      if (mode === 'pause') {
        snapAnchor = closestAnchor(p.x, p.y)
        canvas.style.cursor = hitBall(p.x, p.y) ? 'grab' : 'default'
      } else {
        canvas.style.cursor = hitBall(p.x, p.y) ? 'grab'
          : ropeNear(p.x, p.y) ? 'grab' : 'default'
      }
    }
    return
  }

  // ── Pause: mover bola ou preview de corda ────────────────────────────────────
  if (ptr.type === 'pause-ball') {
    snapAnchor = closestAnchor(p.x, p.y)
    if (snapAnchor) {
      Body.setPosition(ball, { x: ptr.startBallX, y: ptr.startBallY })
    } else {
      Body.setPosition(ball, {
        x: ptr.startBallX + (p.x - ptr.startX),
        y: ptr.startBallY + (p.y - ptr.startY),
      })
    }
    return
  }

  // ── Play: arrastar bola ──────────────────────────────────────────────────────
  if (ptr.type === 'play-ball') {
    const hist = ptr.hist
    hist.push({ x: p.x, y: p.y, t: Date.now() })
    if (hist.length > 8) hist.shift()
    Body.setPosition(ball, { x: p.x, y: p.y })
    return
  }
}

function onUp(e) {
  const p = ptrXY(e)

  // ── Soltar grip de corda ──────────────────────────────────────────────────────
  if (ropeGrip) {
    const totalMove = Math.hypot(p.x - ropeGrip.startX, p.y - ropeGrip.startY)
    if (totalMove > 14) {
      // Vibração visual + som ao soltar com tensão acumulada
      const rope = ropeGrip.rope
      const bx = ball.position.x, by = ball.position.y
      const ax = rope.anchor.x - bx, ay = rope.anchor.y - by
      const alen = Math.hypot(ax, ay) || 1
      const perpX = -ay / alen, perpY = ax / alen
      rope.pluck = {
        t: 0, maxT: 88,
        amp: Math.min(65, totalMove * 0.38),
        perpX, perpY,
      }
      pluckSound(rope)
    }
    ropeGrip = null
    canvas.style.cursor = 'default'
  }

  if (ptr?.type === 'pause-ball') {
    if (snapAnchor && ropes.length < MAX_ROPES) {
      const bx  = ball.position.x, by = ball.position.y
      const len = Math.hypot(bx - snapAnchor.x, by - snapAnchor.y)
      if (len >= ROPE_MIN_LEN) {
        ropes.push({ id: ropeId++, anchor: { ...snapAnchor }, maxLen: len, pluck: null })
        updateRopeCount()
      }
    }
    snapAnchor = null
    canvas.style.cursor = 'default'
  }

  if (ptr?.type === 'play-ball') {
    const hist = ptr.hist
    if (hist.length >= 2) {
      const a  = hist[Math.max(0, hist.length - 4)]
      const b  = hist[hist.length - 1]
      const dt = (b.t - a.t) || 16
      Body.setVelocity(ball, {
        x: (b.x - a.x) / dt * 16.67,
        y: (b.y - a.y) / dt * 16.67,
      })
    }
    Body.setStatic(ball, false)
    canvas.style.cursor = 'default'
  }

  ptr = null
}

// ─── Rope + Grip constraints ──────────────────────────────────────────────────
//
// Tudo via força pura — zero PBD, zero correção de posição, zero zeragem de
// velocidade. Verlet integra suavemente. Sem descontinuidades.
//
// Rope: Hooke linear até maxStretch, depois spring 28× mais rígido (parede mole).
// Grip: spring do ball ao ponto de contato; limite de rope mantido via spring duro.
//
function ropeForce(stretch, maxStretch) {
  if (stretch <= 0) return 0
  if (stretch <= maxStretch) return SPRING_K * stretch
  // Zona dura: spring linear mais rígido — sem PBD, sem salto
  return SPRING_K * maxStretch + SPRING_K * HARD_MULT * (stretch - maxStretch)
}

function applyRopeConstraints() {
  if (ptr?.type === 'play-ball') return

  // ── Grip: spring ball → ponto de contato ────────────────────────────────────
  if (ropeGrip && mode === 'play') {
    const bx = ball.position.x, by = ball.position.y
    const dx = bx - ropeGrip.gx, dy = by - ropeGrip.gy
    const dist = Math.hypot(dx, dy)
    if (dist > GRIP_DEAD && dist > 0) {
      const F = GRIP_K * (dist - GRIP_DEAD) * ball.mass
      Body.applyForce(ball, ball.position, {
        x: -(dx / dist) * F,
        y: -(dy / dist) * F,
      })
    }
  }

  // ── Ropes ───────────────────────────────────────────────────────────────────
  for (const rope of ropes) {
    const bx = ball.position.x, by = ball.position.y
    const dx = bx - rope.anchor.x, dy = by - rope.anchor.y
    const dist = Math.hypot(dx, dy)
    if (dist <= rope.maxLen || dist === 0) continue

    const nx = dx / dist, ny = dy / dist
    const stretch    = dist - rope.maxLen
    const maxStretch = rope.maxLen * MAX_STRETCH_RATIO

    if (ropeGrip?.rope === rope) {
      // Grip ativo: só aplica zona dura (elástica suspensa, hard limit mantido)
      if (stretch > maxStretch) {
        const F = ropeForce(stretch, maxStretch) * ball.mass
        Body.applyForce(ball, ball.position, { x: -nx * F, y: -ny * F })
      }
      continue
    }

    // Normal: Hooke → hard zone
    const F = ropeForce(stretch, maxStretch) * ball.mass
    Body.applyForce(ball, ball.position, { x: -nx * F, y: -ny * F })
  }
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────
const btnPlay = document.getElementById('btnPlay')

function setMode(m) {
  mode = m
  if (m === 'play') {
    Body.setVelocity(ball, { x: 0, y: 0 })
    Body.setAngularVelocity(ball, 0)
    Body.setStatic(ball, false)
    engine.gravity.y = gravScale
    btnPlay.textContent = '⏸ Pause'
    btnPlay.classList.add('active')
  } else {
    // Freeze ball wherever it stopped
    Body.setVelocity(ball, { x: 0, y: 0 })
    Body.setAngularVelocity(ball, 0)
    Body.setStatic(ball, true)
    engine.gravity.y = 0
    btnPlay.textContent = '▶ Play'
    btnPlay.classList.remove('active')
  }
}

btnPlay.addEventListener('click', () => setMode(mode === 'pause' ? 'play' : 'pause'))

// ─── Gravity slider ───────────────────────────────────────────────────────────
const gravSlider = document.getElementById('gravSlider')
const gravVal    = document.getElementById('gravVal')

gravSlider.addEventListener('input', () => {
  gravScale = parseFloat(gravSlider.value)
  gravVal.textContent = `${gravScale.toFixed(1)}×`
  if (mode === 'play') engine.gravity.y = gravScale
})

// ─── Rope count badge ─────────────────────────────────────────────────────────
function updateRopeCount() {
  const el = document.getElementById('ropeCount')
  el.textContent = ropes.length > 0 ? `${ropes.length}/${MAX_ROPES} cordas` : ''
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function drawAnchors() {
  const usedKeys = new Set(ropes.map(r => `${r.anchor.x},${r.anchor.y}`))
  for (const a of getAnchors()) {
    const key   = `${a.x},${a.y}`
    const isSnap = snapAnchor && a.x === snapAnchor.x && a.y === snapAnchor.y
    const isUsed = usedKeys.has(key)
    if (isUsed) continue // drawn by drawRopes()

    if (mode === 'pause') {
      ctx.beginPath()
      ctx.arc(a.x, a.y, isSnap ? 7 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = isSnap
        ? 'rgba(255,195,70,0.92)'
        : 'rgba(80,80,80,0.38)'
      ctx.fill()
    }
  }
}

function drawRopes() {
  const bx = ball.position.x, by = ball.position.y

  for (const rope of ropes) {
    const { anchor, pluck } = rope
    const ax  = anchor.x, ay = anchor.y
    const dist = Math.hypot(bx - ax, by - ay)
    const taut = Math.min(1, dist / rope.maxLen)

    // ── Corda com grip ativo: dois segmentos (ball→grip, grip→anchor) ──────────
    if (ropeGrip?.rope === rope) {
      const { gx, gy } = ropeGrip
      const gripDist = Math.hypot(bx - gx, by - gy)
      const t = Math.min(1, Math.max(0, (gripDist - GRIP_DEAD) / (rope.maxLen * 0.5)))

      ctx.save()

      // Segmento 1: ball → grip (colorido por tensão)
      const rv = Math.round(200 + t * 55)
      const gv = Math.max(40, Math.round(200 - t * 155))
      const bv = Math.max(8,  Math.round(175 - t * 168))
      ctx.strokeStyle = `rgba(${rv},${gv},${bv},0.92)`
      ctx.lineWidth   = 1.8 + t * 2.5
      if (t > 0.3) {
        ctx.shadowColor = `rgba(255,${Math.round(130*(1-t))},0,${t*0.55})`
        ctx.shadowBlur  = t * 14
      }
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(gx, gy)
      ctx.stroke()

      // Segmento 2: grip → anchor (neutro)
      ctx.shadowBlur  = 0
      ctx.strokeStyle = 'rgba(160,160,160,0.6)'
      ctx.lineWidth   = 1.4
      ctx.beginPath()
      ctx.moveTo(gx, gy)
      ctx.lineTo(ax, ay)
      ctx.stroke()

      ctx.restore()

      // Indicador de grip — anel âmbar
      ctx.beginPath()
      ctx.arc(gx, gy, 7, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,215,70,${0.55 + t * 0.4})`
      ctx.lineWidth   = 2
      ctx.stroke()

      // Ponto interno do grip
      ctx.beginPath()
      ctx.arc(gx, gy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,215,70,${0.6 + t * 0.3})`
      ctx.fill()

      // Anchor dot
      ctx.beginPath()
      ctx.arc(ax, ay, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(185,185,185,0.72)'
      ctx.fill()

      continue  // pula lógica normal para esta corda
    }

    if (pluck && pluck.t < pluck.maxT) {
      // ── Vibrating rope ─────────────────────────────────────────────────────
      const life = 1 - pluck.t / pluck.maxT
      const amp  = pluck.amp * life
      const N    = 48
      const vFreq = 0.18 + (180 / Math.max(50, rope.maxLen)) * 0.12

      ctx.save()
      ctx.shadowColor = `hsla(38, 96%, 65%, ${life * 0.55})`
      ctx.shadowBlur  = life * 10
      ctx.strokeStyle = `hsla(${36 + life * 8}, 95%, ${58 + life * 22}%, ${0.65 + life * 0.35})`
      ctx.lineWidth   = 1.5 + life * 0.8
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const t  = i / N
        const px = bx + t * (ax - bx)
        const py = by + t * (ay - by)
        const wave = amp
          * Math.sin(Math.PI * t)
          * Math.cos(pluck.t * vFreq)
        ctx.lineTo(px + pluck.perpX * wave, py + pluck.perpY * wave)
      }
      ctx.stroke()
      ctx.restore()

      pluck.t++
      if (pluck.t >= pluck.maxT) rope.pluck = null

    } else {
      // ── Static rope ─────────────────────────────────────────────────────────
      const stretch    = dist - rope.maxLen
      const maxStretch = rope.maxLen * MAX_STRETCH_RATIO
      let droop = 0

      ctx.save()

      if (stretch > 0) {
        // Sob tensão elástica: branco → laranja → vermelho conforme tensão
        const t  = Math.min(1, stretch / maxStretch)
        const rv = Math.round(200 + t * 55)
        const gv = Math.max(40, Math.round(200 - t * 155))
        const bv = Math.max(8,  Math.round(175 - t * 168))
        ctx.strokeStyle = `rgba(${rv},${gv},${bv},0.92)`
        ctx.lineWidth   = 1.5 + t * 2.5
        if (t > 0.38) {
          ctx.shadowColor = `rgba(255,${Math.round(130*(1-t))},0,${t*0.55})`
          ctx.shadowBlur  = t * 14
        }
      } else {
        // Frouxa ou neutra: cinza → branco conforme tautness
        const slack = -stretch  // positivo quando frouxa
        droop = mode === 'play' ? slack * 0.20 : 0
        const v = Math.round(80 + taut * 130)
        ctx.strokeStyle = `rgba(${v},${v},${v},0.78)`
        ctx.lineWidth   = 1.5
      }

      ctx.beginPath()
      ctx.moveTo(bx, by)
      if (droop > 3) {
        const mx = (bx + ax) / 2, my = (by + ay) / 2 + droop
        ctx.quadraticCurveTo(mx, my, ax, ay)
      } else {
        ctx.lineTo(ax, ay)
      }
      ctx.stroke()
      ctx.restore()
    }

    // Anchor dot
    ctx.beginPath()
    ctx.arc(ax, ay, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(185,185,185,0.72)'
    ctx.fill()
  }
}

function drawRopePreview() {
  if (mode !== 'pause' || ptr?.type !== 'pause-ball' || !snapAnchor) return
  const bx = ball.position.x, by = ball.position.y
  ctx.save()
  ctx.setLineDash([5, 8])
  ctx.strokeStyle = 'rgba(255,195,70,0.5)'
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(snapAnchor.x, snapAnchor.y)
  ctx.stroke()
  ctx.restore()
}

function drawBall() {
  const { x, y } = ball.position
  const r = BALL_R

  ctx.save()
  ctx.shadowColor  = 'rgba(0,0,0,0.75)'
  ctx.shadowBlur   = 28
  ctx.shadowOffsetY = mode === 'play' ? 10 : 5

  const grad = ctx.createRadialGradient(x - r*0.3, y - r*0.33, r*0.07, x, y, r)
  grad.addColorStop(0,   '#e0e0e0')
  grad.addColorStop(0.38,'#999999')
  grad.addColorStop(0.78,'#3c3c3c')
  grad.addColorStop(1,   '#181818')

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  // Specular highlight dot
  ctx.beginPath()
  ctx.arc(x - r*0.28, y - r*0.3, r*0.2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fill()
}

function drawHint() {
  ctx.save()
  ctx.fillStyle = 'rgba(110,110,110,0.48)'
  ctx.font      = '11.5px "JetBrains Mono","Courier New",monospace'
  ctx.textAlign = 'center'
  if (mode === 'pause' && ropes.length === 0) {
    ctx.fillText(
      'arraste a bola até a borda para criar corda · ▶ Play para físicar',
      canvas.width / 2, canvas.height - 22
    )
  } else if (mode === 'play' && ropes.length > 0) {
    ctx.fillText(
      'arraste a corda lateralmente para dedilhar · duplo clique para remover',
      canvas.width / 2, canvas.height - 22
    )
  }
  ctx.textAlign = 'left'
  ctx.restore()
}

function drawModeTag() {
  const tag = mode === 'pause' ? '[ PAUSE ]' : '[ PLAY ]'
  const col = mode === 'pause'
    ? 'rgba(110,110,110,0.38)'
    : 'rgba(110,200,80,0.42)'
  ctx.fillStyle = col
  ctx.font      = '10.5px "JetBrains Mono","Courier New",monospace'
  ctx.fillText(tag, 12, canvas.height - 12)
}

// ─── Main loop (RAF — physics + render merged) ────────────────────────────────
const FIXED_DT  = 1000 / 60
let   prevTime  = null
let   accumulator = 0

function loop(time) {
  const realDt = prevTime ? Math.min(time - prevTime, 50) : FIXED_DT
  prevTime = time

  if (mode === 'play') {
    accumulator += realDt
    while (accumulator >= FIXED_DT) {
      Engine.update(engine, FIXED_DT)
      applyRopeConstraints()
      accumulator -= FIXED_DT
    }
  }

  // Draw
  ctx.fillStyle = '#080808'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  drawAnchors()
  drawRopes()
  drawRopePreview()
  drawBall()
  drawHint()
  drawModeTag()

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
