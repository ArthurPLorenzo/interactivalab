import * as Tone from 'tone'

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  '#ff6b6b', '#ff9f43', '#ffd93d', '#6bcb77',
  '#4d96ff', '#c77dff', '#ff6eb4', '#ffffff',
]

// ─── Pentatonic scale ─────────────────────────────────────────────────────────
const PENTA_NOTES = ['C', 'D', 'E', 'G', 'A']

// Duration weights: 15% half, 35% quarter, 35% eighth, 15% sixteenth
const DURATIONS = ['2n', '4n', '8n', '16n']
const DUR_WEIGHTS = [0.15, 0.50, 0.85, 1.00] // cumulative

function randomDuration() {
  const r = Math.random()
  for (let i = 0; i < DUR_WEIGHTS.length; i++) {
    if (r < DUR_WEIGHTS[i]) return DURATIONS[i]
  }
  return '4n'
}

// ─── State ────────────────────────────────────────────────────────────────────
let currentColor = PALETTE[0]
let brushSize = 20
let isDrawing = false
let lastX = 0, lastY = 0
let hasPaint = false
let isPlaying = false
let animFrameId = null
let savedImageData = null

// ─── DOM ──────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('paintCanvas')
const ctx = canvas.getContext('2d')
const playBtn = document.getElementById('playBtn')
const clearBtn = document.getElementById('clearBtn')
const brushSizeInput = document.getElementById('brushSize')
const colorPicker = document.getElementById('colorPicker')
const statusText = document.getElementById('statusText')
const canvasHint = document.getElementById('canvasHint')
const paletteEl = document.getElementById('palette')

// ─── Synth setup ─────────────────────────────────────────────────────────────
const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.28 })
await reverb.ready
reverb.toDestination()

const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle8' },
  envelope: { attack: 0.02, decay: 0.4, sustain: 0.15, release: 2.2 },
  volume: -8,
})
synth.connect(reverb)

// ─── Canvas init ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  // Preserve drawing when resizing
  const snapshot = hasPaint ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null
  const prevW = canvas.width, prevH = canvas.height

  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'
  ctx.scale(dpr, dpr)

  fillWhite()

  if (snapshot && hasPaint) {
    // Restore at original scale (best-effort)
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = prevW
    tmpCanvas.height = prevH
    tmpCanvas.getContext('2d').putImageData(snapshot, 0, 0)
    ctx.drawImage(tmpCanvas, 0, 0, rect.width, rect.height)
  }
}

function fillWhite() {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0) // reset transform for fill
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

// ─── Palette render ───────────────────────────────────────────────────────────
PALETTE.forEach(color => {
  const sw = document.createElement('button')
  sw.className = 'swatch'
  sw.style.background = color
  sw.title = color
  if (color === currentColor) sw.classList.add('active')
  sw.addEventListener('click', () => {
    currentColor = color
    colorPicker.value = color
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
    sw.classList.add('active')
  })
  paletteEl.appendChild(sw)
})

// ─── Color picker ─────────────────────────────────────────────────────────────
colorPicker.addEventListener('input', e => {
  currentColor = e.target.value
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
})

// ─── Brush size ───────────────────────────────────────────────────────────────
brushSizeInput.addEventListener('input', e => { brushSize = +e.target.value })

// ─── Drawing ──────────────────────────────────────────────────────────────────
function getPos(e) {
  const rect = canvas.getBoundingClientRect()
  if (e.touches) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

/**
 * Watercolor brush: soft circle + scattered satellite dots
 */
function paintAt(x, y, pressure = 1) {
  ctx.save()

  // Main stroke
  ctx.globalAlpha = 0.82 * pressure
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = brushSize * 0.55
  ctx.shadowColor = currentColor
  ctx.fillStyle = currentColor
  ctx.beginPath()
  ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
  ctx.fill()

  // Satellite droplets for watercolor feel
  const drops = Math.floor(brushSize / 6) + 2
  for (let i = 0; i < drops; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = (0.4 + Math.random() * 0.6) * brushSize * 0.7
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const r = (Math.random() * brushSize) / 6
    ctx.globalAlpha = Math.random() * 0.25 * pressure
    ctx.shadowBlur = r * 2
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function strokeBetween(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.max(1, Math.ceil(dist / (brushSize * 0.3)))
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    paintAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
  }
}

function startDraw(e) {
  if (isPlaying) return
  e.preventDefault()
  isDrawing = true
  const { x, y } = getPos(e)
  lastX = x; lastY = y
  paintAt(x, y)
  if (!hasPaint) {
    hasPaint = true
    canvasHint.classList.add('hidden')
    setStatus('Pintando...')
  }
}

function moveDraw(e) {
  if (!isDrawing || isPlaying) return
  e.preventDefault()
  const { x, y } = getPos(e)
  strokeBetween(lastX, lastY, x, y)
  lastX = x; lastY = y
}

function endDraw() {
  if (!isDrawing) return
  isDrawing = false
  if (hasPaint) setStatus('Pronto — clique em Tocar para ouvir')
}

canvas.addEventListener('mousedown', startDraw)
canvas.addEventListener('mousemove', moveDraw)
canvas.addEventListener('mouseup', endDraw)
canvas.addEventListener('mouseleave', endDraw)
canvas.addEventListener('touchstart', startDraw, { passive: false })
canvas.addEventListener('touchmove', moveDraw, { passive: false })
canvas.addEventListener('touchend', endDraw)

// ─── Clear ────────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  stopPlayback()
  fillWhite()
  hasPaint = false
  canvasHint.classList.remove('hidden')
  setStatus('Pronto para pintar')
})

// ─── Playback ─────────────────────────────────────────────────────────────────
playBtn.addEventListener('click', async () => {
  if (isPlaying) { stopPlayback(); return }
  if (!hasPaint) { setStatus('Pinte algo primeiro!'); return }
  await startPlayback()
})

async function startPlayback() {
  await Tone.start()

  const notes = extractNotes()
  if (notes.length === 0) {
    setStatus('Nenhuma cor encontrada — pinte algo!')
    return
  }

  // Assign random durations
  const sequence = notes.map(n => ({ ...n, dur: randomDuration() }))

  // Compute cumulative times (in seconds at BPM 90)
  Tone.Transport.bpm.value = 90
  const timings = []
  let t = 0
  sequence.forEach(n => {
    const durSec = Tone.Time(n.dur).toSeconds()
    timings.push({ ...n, startSec: t, durSec })
    t += durSec
  })
  const totalSec = t

  // Save canvas for cursor overlay
  savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Schedule notes
  Tone.Transport.cancel()
  timings.forEach(({ pitch, velocity, dur, startSec }) => {
    Tone.Transport.schedule(time => {
      synth.triggerAttackRelease(pitch, dur, time, velocity)
    }, startSec)
  })

  // Schedule stop
  Tone.Transport.schedule(() => {
    // Use Tone callback → defer DOM to next tick
    setTimeout(() => stopPlayback(), 0)
  }, totalSec + 0.1)

  isPlaying = true
  updatePlayBtn(true)
  setStatus(`Tocando ${sequence.length} notas — ${Math.ceil(totalSec)}s`)
  Tone.Transport.start()

  // Cursor animation
  const startWall = performance.now()
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.width / dpr
  const cssH = canvas.height / dpr

  function animateCursor() {
    if (!isPlaying) return
    const elapsed = (performance.now() - startWall) / 1000
    const progress = Math.min(elapsed / totalSec, 1)
    const cursorX = progress * cssW

    // Restore painting
    ctx.putImageData(savedImageData, 0, 0)

    // Active strip highlight
    const stripW = Math.max(6, cssW / notes.length)
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cursorX - stripW / 2, 0, stripW, cssH)
    ctx.restore()

    // Cursor line
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.shadowBlur = 8
    ctx.shadowColor = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(cursorX, 0)
    ctx.lineTo(cursorX, cssH)
    ctx.stroke()
    ctx.restore()

    if (progress < 1) {
      animFrameId = requestAnimationFrame(animateCursor)
    }
  }

  animFrameId = requestAnimationFrame(animateCursor)
}

function stopPlayback() {
  Tone.Transport.stop()
  Tone.Transport.cancel()
  isPlaying = false
  updatePlayBtn(false)

  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null }

  // Restore clean painting
  if (savedImageData) {
    ctx.putImageData(savedImageData, 0, 0)
    savedImageData = null
  }

  setStatus(hasPaint ? 'Pronto — clique em Tocar para ouvir' : 'Pronto para pintar')
}

// ─── Note extraction ─────────────────────────────────────────────────────────
const STRIP_PX = 8 // pixel columns per note group

function extractNotes() {
  const dpr = window.devicePixelRatio || 1
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data
  const W = canvas.width       // physical pixels
  const H = canvas.height
  const step = Math.round(STRIP_PX * dpr)
  const notes = []

  for (let px = 0; px < W; px += step) {
    let sumH = 0, sumS = 0, sumB = 0, count = 0

    for (let xi = px; xi < Math.min(px + step, W); xi++) {
      for (let yi = 0; yi < H; yi++) {
        const i = (yi * W + xi) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
        if (a < 15) continue
        if (r > 238 && g > 238 && b > 238) continue // skip white
        const { h, s, br } = rgbToHsb(r, g, b)
        sumH += h; sumS += s; sumB += br
        count++
      }
    }

    if (count === 0) continue

    const avgH = sumH / count
    const avgS = sumS / count
    const avgB = sumB / count
    notes.push(hsbToNote(avgH, avgS, avgB))
  }

  return notes
}

// ─── Color math ──────────────────────────────────────────────────────────────
function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  let h = 0, s = 0
  const br = max

  if (diff !== 0) {
    s = diff / max
    if (max === r) h = ((g - b) / diff + 6) % 6
    else if (max === g) h = (b - r) / diff + 2
    else h = (r - g) / diff + 4
    h *= 60
  }

  return { h, s, br }
}

function hsbToNote(h, s, br) {
  // Hue → pentatonic note
  const idx = Math.floor((h / 360) * PENTA_NOTES.length) % PENTA_NOTES.length
  const name = PENTA_NOTES[idx]

  // Brightness → octave (dark=3, mid=4, light=5)
  const octave = br < 0.35 ? 3 : br < 0.65 ? 4 : 5

  // Saturation → velocity (min 0.18 so nothing is silent)
  const velocity = 0.18 + s * 0.82

  return { pitch: `${name}${octave}`, velocity }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function updatePlayBtn(playing) {
  if (playing) {
    playBtn.textContent = '■ Parar'
    playBtn.classList.add('playing')
  } else {
    playBtn.textContent = '▶ Tocar'
    playBtn.classList.remove('playing')
  }
}

function setStatus(msg) {
  statusText.textContent = msg
}

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resizeCanvas)
resizeCanvas()
