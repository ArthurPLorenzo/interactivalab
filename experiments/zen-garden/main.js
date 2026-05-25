import * as Tone from 'tone'

// ── Constants ──────────────────────────────────────────────────────────────────

const SAND_BASE   = { r: 226, g: 207, b: 160 }   // #e2cfa0
const GROOVE_COLOR  = 'rgba(168, 138, 82, 0.6)'
const GROOVE_SHADOW = 'rgba(100,  78, 35, 0.32)'

const RAKE_CONFIGS = {
  thin:   { tineCount: 3, tineSpacing: 7  },
  medium: { tineCount: 5, tineSpacing: 9  },
  wide:   { tineCount: 7, tineSpacing: 9  },
}

const STONE_PALETTES = [
  ['#c2bab2', '#726860'],
  ['#b4ada6', '#645c54'],
  ['#cacac0', '#7a7870'],
  ['#b0a89e', '#5e5650'],
  ['#bfb8b0', '#6e6660'],
  ['#c8c0b6', '#7a7268'],
]

// ── State ──────────────────────────────────────────────────────────────────────

let stones       = []
let rakeMode     = 'thin'
let isRaking     = false
let prevPos      = null
let curPos       = null
let rakeAngle    = 0
let dragStone    = null
let dragOffset   = { x: 0, y: 0 }
let silenceMode  = false
let audioReady   = false
let canvasW      = 0
let canvasH      = 0

let sandCanvas  = null   // offscreen — static texture
let grooveCanvas = null  // offscreen — persistent grooves

// ── DOM ────────────────────────────────────────────────────────────────────────

const canvas    = document.getElementById('zenCanvas')
const ctx       = canvas.getContext('2d')
const toolbar   = document.getElementById('toolbar')
const topBar    = document.getElementById('topBar')
const btnReset  = document.getElementById('btnReset')
const btnSilence = document.getElementById('btnSilence')
const rakeButtons = document.querySelectorAll('[data-rake]')

// ── Audio — sand noise (Web Audio via Tone.js) ─────────────────────────────────

let sandGain = null

async function ensureAudio() {
  if (audioReady) return
  audioReady = true
  await Tone.start()

  const noise  = new Tone.Noise('pink').start()
  const filter = new Tone.Filter({ frequency: 500, type: 'bandpass', Q: 1.2 })
  sandGain = new Tone.Gain(0)
  noise.chain(filter, sandGain, Tone.getDestination())
}

function rampSand(target, time = 0.35) {
  if (!sandGain) return
  sandGain.gain.rampTo(target, time)
}

// ── Sand texture ──────────────────────────────────────────────────────────────

function makeSandCanvas(w, h) {
  const off = document.createElement('canvas')
  off.width  = w
  off.height = h
  const c = off.getContext('2d')

  c.fillStyle = `rgb(${SAND_BASE.r},${SAND_BASE.g},${SAND_BASE.b})`
  c.fillRect(0, 0, w, h)

  const img = c.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 24
    d[i]   = clamp(d[i]   + n,       0, 255)
    d[i+1] = clamp(d[i+1] + n * 0.88, 0, 255)
    d[i+2] = clamp(d[i+2] + n * 0.58, 0, 255)
    d[i+3] = 255
  }
  c.putImageData(img, 0, 0)
  return off
}

// ── Stone generation ──────────────────────────────────────────────────────────

function makeStonePoints(r) {
  const n = 7 + Math.floor(Math.random() * 5)
  return Array.from({ length: n }, (_, i) => {
    const baseAngle = (i / n) * Math.PI * 2
    const jitter    = (Math.random() - 0.5) * (Math.PI / n) * 0.9
    const dist      = r * (0.68 + Math.random() * 0.64)
    return {
      x: Math.cos(baseAngle + jitter) * dist,
      y: Math.sin(baseAngle + jitter) * dist * (0.7 + Math.random() * 0.35),
    }
  })
}

function spawnStones(w, h) {
  const count  = 4 + Math.floor(Math.random() * 3) // 4-6
  const margin = 90
  stones = []
  const usedPalettes = [...STONE_PALETTES].sort(() => Math.random() - 0.5)

  for (let i = 0; i < count; i++) {
    const r = 20 + Math.random() * 38
    stones.push({
      x:      margin + Math.random() * (w - margin * 2),
      y:      margin + Math.random() * (h - margin * 2),
      r,
      pts:    makeStonePoints(r),
      colors: usedPalettes[i % usedPalettes.length],
    })
  }
}

// ── Stone rendering ───────────────────────────────────────────────────────────

function stonePathOnCtx(c, stone) {
  const { pts } = stone
  const n = pts.length
  c.beginPath()
  for (let i = 0; i < n; i++) {
    const a   = pts[i]
    const b   = pts[(i + 1) % n]
    const c2  = pts[(i + 2) % n]
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (i === 0) c.moveTo(mid.x, mid.y)
    c.quadraticCurveTo(b.x, b.y, (b.x + c2.x) / 2, (b.y + c2.y) / 2)
  }
  c.closePath()
}

function drawStone(c, stone) {
  c.save()
  c.translate(stone.x, stone.y)

  // Shadow
  c.shadowColor   = 'rgba(0,0,0,0.42)'
  c.shadowBlur    = 16
  c.shadowOffsetX = 3
  c.shadowOffsetY = 6

  stonePathOnCtx(c, stone)

  const grad = c.createRadialGradient(
    -stone.r * 0.3, -stone.r * 0.3, stone.r * 0.05,
     stone.r * 0.1,  stone.r * 0.1, stone.r * 1.2,
  )
  grad.addColorStop(0, stone.colors[0])
  grad.addColorStop(1, stone.colors[1])
  c.fillStyle = grad
  c.fill()

  // Subtle rim highlight
  c.shadowColor   = 'transparent'
  c.shadowBlur    = 0
  c.shadowOffsetX = 0
  c.shadowOffsetY = 0
  c.strokeStyle   = 'rgba(255,255,255,0.1)'
  c.lineWidth     = 1
  c.stroke()

  c.restore()
}

// ── Stone hit test ────────────────────────────────────────────────────────────

function hitStone(x, y) {
  for (let i = stones.length - 1; i >= 0; i--) {
    if (Math.hypot(x - stones[i].x, y - stones[i].y) < stones[i].r * 1.15) {
      return stones[i]
    }
  }
  return null
}

// ── Stone deflection ──────────────────────────────────────────────────────────

function deflect(x, y) {
  let rx = x, ry = y
  for (const s of stones) {
    const dx = rx - s.x
    const dy = ry - s.y
    const d  = Math.hypot(dx, dy)
    const min = s.r + 5
    if (d < min && d > 0.01) {
      rx = s.x + (dx / d) * min
      ry = s.y + (dy / d) * min
    }
  }
  return { x: rx, y: ry }
}

// ── Groove drawing ────────────────────────────────────────────────────────────

function drawGrooveSegment(x0, y0, x1, y1, smoothedAngle) {
  const { tineCount, tineSpacing } = RAKE_CONFIGS[rakeMode]
  const dist  = Math.hypot(x1 - x0, y1 - y0)
  if (dist < 0.5) return

  const angle = smoothedAngle !== undefined ? smoothedAngle : Math.atan2(y1 - y0, x1 - x0)
  const perp  = angle + Math.PI / 2
  const steps = Math.max(3, Math.ceil(dist / 2))

  const gc = grooveCanvas.getContext('2d')
  gc.save()
  gc.strokeStyle   = GROOVE_COLOR
  gc.lineWidth     = 1.5
  gc.lineCap       = 'round'
  gc.lineJoin      = 'round'
  gc.shadowColor   = GROOVE_SHADOW
  gc.shadowBlur    = 2
  gc.shadowOffsetX = 0
  gc.shadowOffsetY = 1

  for (let t = 0; t < tineCount; t++) {
    const offset = (t - (tineCount - 1) / 2) * tineSpacing
    const pts = []

    for (let s = 0; s <= steps; s++) {
      const f  = s / steps
      const cx = x0 + (x1 - x0) * f
      const cy = y0 + (y1 - y0) * f
      const tx = cx + Math.cos(perp) * offset
      const ty = cy + Math.sin(perp) * offset
      pts.push(deflect(tx, ty))
    }

    gc.beginPath()
    gc.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) gc.lineTo(pts[i].x, pts[i].y)
    gc.stroke()
  }

  gc.restore()
}

// ── Rake cursor ───────────────────────────────────────────────────────────────

function drawRakeCursor(c, x, y, angle) {
  const { tineCount, tineSpacing } = RAKE_CONFIGS[rakeMode]
  const totalW   = (tineCount - 1) * tineSpacing
  const handleLen = 46
  const tineLen   = 14

  c.save()
  c.translate(x, y)
  c.rotate(angle + Math.PI / 2)

  c.strokeStyle = 'rgba(90, 68, 38, 0.8)'
  c.lineWidth   = 2
  c.lineCap     = 'round'
  c.shadowColor = 'rgba(0,0,0,0.35)'
  c.shadowBlur  = 4

  // Handle
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(0, -handleLen)
  c.stroke()

  // Head bar
  c.beginPath()
  c.moveTo(-totalW / 2 - 5, 0)
  c.lineTo( totalW / 2 + 5, 0)
  c.stroke()

  // Tines
  c.lineWidth = 1.5
  for (let t = 0; t < tineCount; t++) {
    const tx = -totalW / 2 + t * tineSpacing
    c.beginPath()
    c.moveTo(tx, 0)
    c.lineTo(tx, tineLen)
    c.stroke()
  }

  c.restore()
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  ctx.drawImage(sandCanvas,  0, 0)
  ctx.drawImage(grooveCanvas, 0, 0)
  for (const s of stones) drawStone(ctx, s)
  if (curPos && !dragStone) drawRakeCursor(ctx, curPos.x, curPos.y, rakeAngle)
  requestAnimationFrame(render)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function initCanvas() {
  const rect  = canvas.parentElement.getBoundingClientRect()
  canvasW = Math.floor(rect.width)
  canvasH = Math.floor(rect.height)
  canvas.width  = canvasW
  canvas.height = canvasH

  sandCanvas  = makeSandCanvas(canvasW, canvasH)

  grooveCanvas = document.createElement('canvas')
  grooveCanvas.width  = canvasW
  grooveCanvas.height = canvasH

  spawnStones(canvasW, canvasH)
}

// ── Input ─────────────────────────────────────────────────────────────────────

function getPos(e) {
  const rect = canvas.getBoundingClientRect()
  const src  = e.touches ? e.touches[0] : e
  return { x: src.clientX - rect.left, y: src.clientY - rect.top }
}

function onDown(e) {
  e.preventDefault()
  ensureAudio()
  const pos = getPos(e)
  curPos = pos

  const hit = hitStone(pos.x, pos.y)
  if (hit) {
    dragStone  = hit
    dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y }
    return
  }

  isRaking = true
  prevPos  = pos
  rampSand(0.05)
}

function onMove(e) {
  e.preventDefault()
  const pos = getPos(e)
  curPos = pos

  if (dragStone) {
    dragStone.x = pos.x - dragOffset.x
    dragStone.y = pos.y - dragOffset.y
    return
  }

  if (isRaking && prevPos) {
    const dx = pos.x - prevPos.x
    const dy = pos.y - prevPos.y
    if (Math.hypot(dx, dy) > 1) {
      rakeAngle = lerpAngle(rakeAngle, Math.atan2(dy, dx), 0.14)
      drawGrooveSegment(prevPos.x, prevPos.y, pos.x, pos.y, rakeAngle)
      prevPos = pos
    }
  }
}

function onUp() {
  if (isRaking) rampSand(0, 0.55)
  isRaking  = false
  dragStone = null
  prevPos   = null
}

canvas.addEventListener('mousedown',  onDown)
canvas.addEventListener('mousemove',  onMove)
canvas.addEventListener('mouseup',    onUp)
canvas.addEventListener('mouseleave', onUp)
canvas.addEventListener('touchstart', onDown, { passive: false })
canvas.addEventListener('touchmove',  onMove, { passive: false })
canvas.addEventListener('touchend',   onUp)

// ── Controls ──────────────────────────────────────────────────────────────────

rakeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    rakeMode = btn.dataset.rake
    rakeButtons.forEach(b => b.classList.toggle('active', b === btn))
  })
})

btnReset.addEventListener('click', () => {
  // Clear grooves
  grooveCanvas.getContext('2d').clearRect(0, 0, canvasW, canvasH)
  // Fresh sand
  sandCanvas = makeSandCanvas(canvasW, canvasH)
  // New stones
  spawnStones(canvasW, canvasH)
})

btnSilence.addEventListener('click', toggleSilence)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && silenceMode) exitSilence() })

function toggleSilence() { silenceMode ? exitSilence() : enterSilence() }

function enterSilence() {
  silenceMode = true
  toolbar.classList.add('hidden')
  topBar.classList.add('hidden')
  document.body.classList.add('silence-mode')
  btnSilence.textContent = '✕ Sair'
}

function exitSilence() {
  silenceMode = false
  toolbar.classList.remove('hidden')
  topBar.classList.remove('hidden')
  document.body.classList.remove('silence-mode')
  btnSilence.textContent = '🌿 Silêncio'
}

// ── Resize ────────────────────────────────────────────────────────────────────

let resizeTimer = null
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    // Capture current grooves
    const tmpGroove = document.createElement('canvas')
    tmpGroove.width  = canvasW
    tmpGroove.height = canvasH
    tmpGroove.getContext('2d').drawImage(grooveCanvas, 0, 0)

    initCanvas()

    // Restore grooves scaled to new size
    grooveCanvas.getContext('2d').drawImage(tmpGroove, 0, 0, canvasW, canvasH)
  }, 150)
})

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function lerpAngle(a, b, t) {
  let diff = b - a
  while (diff >  Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * t
}

// ── Init ──────────────────────────────────────────────────────────────────────

initCanvas()
render()
