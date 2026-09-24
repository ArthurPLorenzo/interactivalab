// ── Shared helpers ────────────────────────────────────────────────────────────
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// Colors come from the CSS tokens, so canvases follow light/dark mode.
function themeColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = k => cs.getPropertyValue(k).trim()
  return { paper2: v('--paper-2'), grid: v('--grid'), gridStrong: v('--grid-strong'), ink: v('--ink'), trace: v('--trace') }
}

// Graph paper; `offset` scrolls it to the left. Every 5th line is darker.
function drawGrid(ctx, w, h, cell, c, offset = 0) {
  ctx.fillStyle = c.paper2
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 1
  const first = Math.floor(offset / cell)
  for (let i = first; (i * cell - offset) <= w; i++) {
    const x = Math.round(i * cell - offset) + 0.5
    ctx.strokeStyle = i % 5 === 0 ? c.gridStrong : c.grid
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let j = 0; j * cell <= h; j++) {
    const y = Math.round(j * cell) + 0.5
    ctx.strokeStyle = j % 5 === 0 ? c.gridStrong : c.grid
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

// ── Hero: a mass on a spring writes its own motion on moving paper ────────────
const plotter = document.getElementById('plotter')
if (plotter) {
  const ctx = plotter.getContext('2d')
  const CELL = 24, SPEED = 70 // paper speed, px/s
  const OMEGA = 2 * Math.PI / 1.6, ZETA = 0.004
  let w = 0, h = 0, y = 0, v = 0, t = 0, drag = false, pointerY = 0, grabOffset = 0
  const hist = [] // [time, displacement]

  const massX = () => w - Math.min(150, w * 0.22)
  const penX = () => massX() - 36
  const restY = () => h / 2

  function fit() {
    const r = plotter.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    plotter.width = Math.round(r.width * dpr)
    plotter.height = Math.round(r.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    w = r.width
    h = r.height
    if (reducedMotion) {
      // Static record: the trace is already on the paper, nothing moves
      hist.length = 0
      t = penX() / SPEED
      for (let s = 0; s <= t; s += 1 / 30) hist.push([s, h * 0.28 * Math.cos(OMEGA * s)])
      y = hist[hist.length - 1][1]
      draw()
    }
  }

  function step(dt) {
    if (drag) {
      y = Math.max(-h * 0.36, Math.min(h * 0.36, pointerY - grabOffset - restY()))
      v = 0
    } else {
      v += (-OMEGA * OMEGA * y - 2 * ZETA * OMEGA * v) * dt
      y += v * dt
    }
    t += dt
    hist.push([t, y])
    while (hist.length && t - hist[0][0] > penX() / SPEED + 0.5) hist.shift()
  }

  function draw() {
    const c = themeColors(), mx = massX(), px = penX(), my = restY() + y
    drawGrid(ctx, w, h, CELL, c, reducedMotion ? 0 : (t * SPEED) % (CELL * 5))

    // What the pen has written so far
    ctx.strokeStyle = c.trace
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    hist.forEach(([ti, yi], i) => {
      const x = px - (t - ti) * SPEED, yy = restY() + yi
      i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)
    })
    ctx.stroke()

    // Spring from the top edge down to the mass
    ctx.strokeStyle = c.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mx, 0)
    const top = 14, bottom = my - 24, coils = 12
    ctx.lineTo(mx, top)
    for (let i = 1; i <= coils; i++) ctx.lineTo(mx + (i % 2 ? 11 : -11), top + (bottom - top) * (i - 0.5) / coils)
    ctx.lineTo(mx, bottom)
    ctx.lineTo(mx, my)
    ctx.stroke()

    // Mass, arm and pen tip
    ctx.fillStyle = c.ink
    ctx.fillRect(mx - 24, my - 24, 48, 48)
    ctx.fillRect(px, my - 1.5, mx - 24 - px, 3)
    ctx.fillStyle = c.trace
    ctx.beginPath(); ctx.arc(px, my, 5, 0, Math.PI * 2); ctx.fill()
  }

  const local = e => e.clientY - plotter.getBoundingClientRect().top
  const onMass = e => {
    const r = plotter.getBoundingClientRect()
    return Math.abs(e.clientX - r.left - massX()) < 36 && Math.abs(local(e) - restY() - y) < 36
  }
  plotter.addEventListener('pointerdown', e => {
    if (reducedMotion || !onMass(e)) return
    drag = true
    pointerY = local(e)
    grabOffset = pointerY - restY() - y
    plotter.setPointerCapture(e.pointerId)
  })
  plotter.addEventListener('pointermove', e => {
    if (drag) pointerY = local(e)
    else plotter.style.cursor = !reducedMotion && onMass(e) ? 'grab' : 'default'
  })
  plotter.addEventListener('pointerup', () => { drag = false })

  new ResizeObserver(fit).observe(plotter)
  fit()
  if (!reducedMotion) {
    // The paper arrives already written: the mass has been swinging before we looked
    y = h * 0.28
    for (let s = -penX() / SPEED - 0.5; s < 0; s += 1 / 60) hist.push([s, y * Math.cos(OMEGA * s)])
    let last = null
    const loop = time => {
      const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000)
      last = time
      step(dt)
      draw()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
}

// ── Wave garden card preview (two drippers on raked sand) ─────────────────────
document.querySelectorAll('.card-preview[data-preview="waves"]').forEach(canvas => {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height, cell = 3
  const sources = [[w * 0.42, h * 0.3], [w * 0.58, h * 0.3]]
  const k = 2 * Math.PI / 26, omega = 2 * Math.PI * 0.9
  let t = 0

  // Height of the surface: two circular waves in step, weaker farther out
  const height = (x, y) => sources.reduce((s, [sx, sy]) => {
    const r = Math.hypot(x - sx, y - sy) + 4
    return s + Math.sin(k * r - omega * t) * 3 / Math.sqrt(r)
  }, 0)

  function frame() {
    t += 1 / 60
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const s = Math.max(0.6, Math.min(1.35, 1 - (height(x + 1, y) - height(x - 1, y) + height(x, y + 1) - height(x, y - 1)) * 1.2))
      ctx.fillStyle = `rgb(${226 * s | 0},${207 * s | 0},${160 * s | 0})`
      ctx.fillRect(x, y, cell, cell)
    }
    ctx.fillStyle = '#3b3222'
    for (const [sx, sy] of sources) { ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill() }
    if (!reducedMotion) requestAnimationFrame(frame)
  }

  setTimeout(frame, reducedMotion ? 0 : Math.random() * 2000)
})

// ── Pendulum card preview (pendulum on graph paper + its angle trace) ─────────
document.querySelectorAll('.card-preview[data-preview="pendulum"]').forEach(canvas => {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const pivotX = w * 0.5, pivotY = 12, L = 92, chartTop = 118, period = 1.9
  const angle = t => 0.5 * Math.cos(2 * Math.PI * t / period)
  let t = 0

  function frame() {
    const c = themeColors()
    t += 1 / 60

    drawGrid(ctx, w, chartTop, 10, c)
    const theta = angle(t)
    const bx = pivotX + L * Math.sin(theta), by = pivotY + L * Math.cos(theta)
    ctx.strokeStyle = c.ink
    ctx.fillStyle = c.ink
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(bx, by); ctx.stroke()
    ctx.fillRect(pivotX - 16, pivotY - 5, 32, 4)
    ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill()

    // Angle over the last few seconds, newest on the right
    ctx.fillStyle = c.paper2
    ctx.fillRect(0, chartTop, w, h - chartTop)
    ctx.fillStyle = c.ink
    ctx.fillRect(0, chartTop, w, 1.5)
    const mid = (chartTop + h) / 2
    ctx.strokeStyle = c.trace
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const y = mid - angle(t - (w - x) / 60) * 44
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()

    if (!reducedMotion) requestAnimationFrame(frame)
  }

  // Stagger so cards don't sync
  setTimeout(frame, reducedMotion ? 0 : Math.random() * 2000)
})

// ── Circuit card preview (battery → resistor → LED loop) ──────────────────────
document.querySelectorAll('.card-preview[data-preview="circuit"]').forEach(canvas => {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const x0 = 60, y0 = 40, x1 = 240, y1 = 130
  let t = 0

  function frame() {
    t++
    ctx.fillStyle = '#1f4d3a'
    ctx.fillRect(0, 0, w, h)

    // Board holes
    ctx.fillStyle = '#276047'
    for (let x = 9; x < w; x += 18) for (let y = 9; y < h; y += 18) {
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI*2); ctx.fill()
    }

    // Trace, then current flowing along it
    ctx.lineWidth = 4
    ctx.strokeStyle = '#d49a4a'
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    ctx.save()
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffd36b'
    ctx.setLineDash([3, 11])
    ctx.lineDashOffset = -t * 0.5
    ctx.beginPath()
    ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.closePath()
    ctx.stroke()
    ctx.restore()

    // Battery
    ctx.fillStyle = '#2b2f2c'
    ctx.fillRect(x0 - 18, 68, 36, 34)
    ctx.fillStyle = '#e9efe9'
    ctx.font = '700 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('9 V', x0, 90)

    // Resistor
    ctx.fillStyle = '#e2c592'
    ctx.fillRect(126, y0 - 7, 48, 14)
    ;['#f2d31b', '#7b3fc4', '#7a4a21'].forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(134 + k * 8, y0 - 7, 4, 14) })

    // LED, glowing with a slow pulse
    const glow = 0.55 + 0.45 * Math.sin(t * 0.05)
    const g = ctx.createRadialGradient(x1, 85, 2, x1, 85, 34)
    g.addColorStop(0, `rgba(255,59,47,${0.75 * glow})`)
    g.addColorStop(1, 'rgba(255,59,47,0)')
    ctx.fillStyle = g
    ctx.fillRect(x1 - 36, 49, 72, 72)
    ctx.fillStyle = '#ff3b2f'
    ctx.beginPath(); ctx.moveTo(x1 - 12, 76); ctx.lineTo(x1 + 12, 76); ctx.lineTo(x1, 94); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#e9efe9'
    ctx.fillRect(x1 - 12, 95, 24, 3)

    requestAnimationFrame(frame)
  }

  // Stagger so cards don't sync
  setTimeout(frame, Math.random() * 2000)
})
