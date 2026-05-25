// Animate each card preview canvas with a looping painting simulation

// ── Painting card preview (brushstrokes) ──────────────────────────────────────
document.querySelectorAll('.card:not(.card--soon) .card-preview:not([data-preview])').forEach(canvas => {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  // Fill dark background
  ctx.fillStyle = '#0f0f17'
  ctx.fillRect(0, 0, w, h)

  const strokes = []

  function spawnStroke() {
    strokes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      hue: Math.random() * 360,
      radius: 6 + Math.random() * 18,
      alpha: 0.7 + Math.random() * 0.3,
      age: 0,
      maxAge: 80 + Math.random() * 60,
      dx: (Math.random() - 0.5) * 0.8,
      dy: (Math.random() - 0.5) * 0.8,
    })
  }

  // Seed with initial strokes
  for (let i = 0; i < 8; i++) spawnStroke()

  function frame() {
    // Slow fade to create trailing effect
    ctx.fillStyle = 'rgba(15,15,23,0.04)'
    ctx.fillRect(0, 0, w, h)

    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]
      const life = 1 - s.age / s.maxAge

      ctx.save()
      ctx.globalAlpha = life * s.alpha * 0.65
      ctx.shadowBlur = s.radius * 1.2
      ctx.shadowColor = `hsl(${s.hue}, 80%, 60%)`
      ctx.fillStyle = `hsl(${s.hue}, 80%, 60%)`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.radius * life * 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      s.x += s.dx
      s.y += s.dy
      s.age++
      s.hue += 0.4

      if (s.age >= s.maxAge) {
        strokes.splice(i, 1)
      }
    }

    // Spawn new strokes occasionally
    if (Math.random() < 0.06) spawnStroke()

    requestAnimationFrame(frame)
  }

  frame()
})

// ── Zen garden card preview (sand sweep) ──────────────────────────────────────
document.querySelectorAll('.card-preview[data-preview="zen"]').forEach(canvas => {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height

  const SAND = '#e2cfa0'
  const STONES = [
    { x: w * 0.28, y: h * 0.52, rx: 13, ry: 9, rot: -0.3 },
    { x: w * 0.68, y: h * 0.38, rx: 18, ry: 13, rot: 0.5 },
    { x: w * 0.82, y: h * 0.68, rx: 10, ry: 7, rot: 0.1 },
  ]

  function drawBase() {
    ctx.fillStyle = SAND
    ctx.fillRect(0, 0, w, h)
    // grain
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
    }
    STONES.forEach(s => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.shadowColor = 'rgba(0,0,0,0.32)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetY = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#928880'
      ctx.fill()
      ctx.restore()
    })
  }

  drawBase()

  const TINES = 5
  const TINE_GAP = 7
  const TINE_HALF = ((TINES - 1) * TINE_GAP) / 2
  const midY = h / 2

  let rakeX = -10
  let phase = 'sweep' // 'sweep' | 'pause'
  let pauseTick = 0

  function frame() {
    if (phase === 'pause') {
      pauseTick++
      if (pauseTick > 90) { phase = 'sweep'; rakeX = -10; drawBase() }
      requestAnimationFrame(frame)
      return
    }

    // draw tine pixels at rakeX
    ctx.strokeStyle = 'rgba(172, 143, 88, 0.52)'
    ctx.lineWidth = 1
    for (let t = 0; t < TINES; t++) {
      const ty = midY - TINE_HALF + t * TINE_GAP
      ctx.beginPath()
      ctx.moveTo(rakeX - 1, ty)
      ctx.lineTo(rakeX, ty)
      ctx.stroke()
    }

    rakeX += 0.7
    if (rakeX > w + 10) { phase = 'pause'; pauseTick = 0 }
    requestAnimationFrame(frame)
  }

  // Stagger start so cards don't sync
  setTimeout(frame, Math.random() * 3000)
})

// ── Accent bar color — CSS attr() doesn't work for non-content props,
// so apply via JS
document.querySelectorAll('.card[data-color]').forEach(card => {
  const color = card.dataset.color
  card.style.setProperty('--card-accent', color)
  if (!card.classList.contains('card--soon')) {
    const bar = document.createElement('div')
    bar.style.cssText = `position:absolute;top:0;left:0;right:0;height:3px;background:${color};border-radius:18px 18px 0 0;`
    card.prepend(bar)
  }
})
