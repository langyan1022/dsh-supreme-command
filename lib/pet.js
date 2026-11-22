/**
 * 550W 桌面宠物（MOSS 程序化渲染器优先，GLB 兜底）。
 *
 * 首选：直接复用本机 MOSS 网页的 `moss-render.js`（Worker + OffscreenCanvas），
 * 渲染它程序化重建的 550W——小屏、LED 阵列、光圈、TOF 转子、舵机姿态都是它自己的实现，
 * 效果与参考网页一致；资源（moss-exterior.glb / moss-tof.glb）由 Host 同源下发。
 * 本机没有 MOSS 时自动回退到 `pet-glb.js`（moss-exterior.glb + three.js 的轻量实现）。
 *
 * 两种模式共用：可拖动、顶部吸附、实时尺寸、启动屏期间隐藏、减少动态时静止。
 */

const ROUTE = '/dsh-command'
const DEFAULTS = { size: 140, top: 2 }

function readCfg() {
  try {
    const c = window.__DSC_CFG__ || {}
    return {
      enabled: c.pet !== false,
      size: Math.round(Math.min(520, Math.max(80, Number(c.petSize) || DEFAULTS.size))),
      snap: c.petSnap !== false
    }
  } catch (err) {
    return { enabled: true, size: DEFAULTS.size, snap: true }
  }
}
let cfg = readCfg()

function state(stage, extra) {
  try { window.__DSC_PET_STATE__ = Object.assign({ stage }, extra || {}) } catch (err) { /* noop */ }
}

function readStoredPetConfig() {
  try {
    const raw = localStorage.getItem('dsc:pet-config')
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c || typeof c !== 'object') return null
    return { enabled: c.enabled !== false, size: Number(c.size) || 140, snap: c.snap !== false }
  } catch (err) { return null }
}

async function hasMossRenderer() {
  try {
    if (typeof Worker !== 'function' || typeof window.OffscreenCanvas !== 'function') return false
    const res = await fetch(ROUTE + '/pet/moss-render.js', { method: 'HEAD', cache: 'no-store' })
    return !!res && res.ok
  } catch (err) { return false }
}

/** 回退到 GLB 轻量渲染（pet-glb.js 自己建 DOM，这里只负责把守卫让开） */
let fellBack = false
async function fallbackToGlb(reason) {
  if (fellBack) return null
  fellBack = true
  try { window.__DSC_PET__ = false } catch (err) { /* noop */ }
  state('fallback-glb', { reason: String(reason || '') })
  try {
    const mod = await import('./pet-glb.js')
    return await mod.startPet()
  } catch (err) {
    state('fallback-failed', { error: String((err && err.stack) || err) })
    return null
  }
}

export async function startPet() {
  state('start')
  cfg = readCfg()
  if (!cfg.enabled) return null
  if (window.__DSC_PET__) return window.__DSC_PET__
  window.__DSC_PET__ = true

  const stored = readStoredPetConfig()
  if (stored) cfg = Object.assign({}, cfg, { enabled: stored.enabled !== false, size: stored.size, snap: stored.snap !== false })
  if (!cfg.enabled) return null

  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const reduced = !!(reducedQuery && reducedQuery.matches)

  if (!(await hasMossRenderer())) return fallbackToGlb('no-moss-renderer')

  /* ── DOM：盒子 + 画布 + 铭牌 ─────────────────────────────────────────── */
  const box = document.createElement('div')
  box.className = 'dsc-pet'
  box.setAttribute('data-dsc-pet-widget', 'worker')
  box.style.width = box.style.height = cfg.size + 'px'
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = cfg.size
  canvas.style.transformOrigin = '50% 42%'
  canvas.style.transform = 'scale(0.94)'
  const tag = document.createElement('span')
  tag.className = 'dsc-pet__tag'
  tag.textContent = '550W · 载入中'
  box.appendChild(canvas)
  box.appendChild(tag)

  const vw = () => window.innerWidth || document.documentElement.clientWidth || 1280
  const vh = () => window.innerHeight || document.documentElement.clientHeight || 800
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
  const place = (x, y) => {
    box.style.left = clamp(x, 6, vw() - cfg.size - 6) + 'px'
    box.style.top = clamp(y, 0, Math.max(0, vh() - cfg.size - 2)) + 'px'
  }
  const snapToTop = () => {
    box.classList.add('is-snapping')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      box.style.top = '2px'
      try { localStorage.setItem('dsc:pet-pos', JSON.stringify({ x: box.offsetLeft, y: 2 })) } catch (err) { /* noop */ }
    }))
    window.setTimeout(() => box.classList.remove('is-snapping'), 360)
  }
  const saved = (() => { try { return JSON.parse(localStorage.getItem('dsc:pet-pos') || 'null') } catch (err) { return null } })()
  if (cfg.snap !== false) place(Number.isFinite(saved && saved.x) ? saved.x : vw() - cfg.size - 2, 2)
  else if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y)
  else place(vw() - cfg.size - 28, DEFAULTS.top)

  document.body.appendChild(box)
  box.classList.add('dsc-pet--worker')

  /* ── 拖动 / 吸附 ─────────────────────────────────────────────────────── */
  let drag = null
  const dsc = cfg
  box.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return
    drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, left: box.offsetLeft, top: box.offsetTop, moved: 0 }
    try { box.setPointerCapture(ev.pointerId) } catch (err) { /* noop */ }
    box.classList.add('is-dragging')
    ev.preventDefault()
  })
  box.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return
    const dx = ev.clientX - drag.x
    const dy = ev.clientY - drag.y
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy))
    place(drag.left + dx, drag.top + dy)
  })
  let worker = null
  const endDrag = (ev) => {
    if (!drag) return
    const moved = drag.moved
    drag = null
    try { box.releasePointerCapture(ev.pointerId) } catch (err) { /* noop */ }
    box.classList.remove('is-dragging')
    if (moved < 5) {
      /* 点一下：让 MOSS 渲染器做一次"看向"动作（用 joints 消息，跟参考网页一致） */
      try { worker && worker.postMessage({ type: 'joints', radians: -0.12, pitch: 0.1 }) } catch (err) { /* noop */ }
      return
    }
    if (cfg.snap !== false) snapToTop()
    else {
      try { localStorage.setItem('dsc:pet-pos', JSON.stringify({ x: box.offsetLeft, y: box.offsetTop })) } catch (err) { /* noop */ }
    }
  }
  box.addEventListener('pointerup', endDrag)
  box.addEventListener('pointercancel', endDrag)
  box.addEventListener('lostpointercapture', endDrag)
  window.addEventListener('pointerup', endDrag, true)
  window.addEventListener('pointercancel', endDrag, true)

  /* ── Worker 渲染 ────────────────────────────────────────────────────── */
  const theme = (() => {
    try { return getComputedStyle(document.documentElement).getPropertyValue('--dsc-accent').trim() || '#ff3b30' } catch (err) { return '#ff3b30' }
  })()
  const readStatus = () => {
    const rect = box.getBoundingClientRect()
    return {
      width: Math.max(1, Math.round(rect.width || cfg.size)),
      height: Math.max(1, Math.round(rect.height || cfg.size)),
      dpr: Math.min(2, window.devicePixelRatio || 1),
      visible: visible && !document.hidden,
      reduced,
      opening: !!document.getElementById('dsh-command-splash'),
      theme
    }
  }

  let surface = null
  try {
    surface = canvas.transferControlToOffscreen()
    worker = new Worker(ROUTE + '/pet/moss-render.js', { type: 'module', name: '550W CAD' })
  } catch (err) {
    box.remove()
    return fallbackToGlb('worker-create: ' + err.message)
  }

  let failed = false
  const failAndFallback = (reason) => {
    if (failed) return
    failed = true
    try { worker.terminate() } catch (err) { /* noop */ }
    try { box.remove() } catch (err) { /* noop */ }
    return fallbackToGlb(reason)
  }
  worker.onerror = (ev) => { failAndFallback('worker-error: ' + ((ev && ev.message) || 'unknown')) }
  worker.onmessage = (ev) => {
    const data = ev && ev.data
    if (!data || !data.type) return
    try {
      if (data.type === 'image') {
        /* worker 请求主线程解码贴花图片，解码后把 ImageBitmap 回传 */
        ;(async () => {
          try {
            const img = new Image()
            img.src = data.url
            await img.decode()
            const decal = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
            decal.getContext('2d').drawImage(img, 0, 0)
            const bitmap = decal.transferToImageBitmap()
            worker.postMessage({ type: 'image', id: data.id, bitmap }, [bitmap])
          } catch (err) {
            try { worker.postMessage({ type: 'image', id: data.id, message: String((err && err.message) || err) }) } catch (e2) { /* noop */ }
          }
        })()
        return
      }
      if (data.type === 'load-progress') { state('worker-loading', { stage: data.stage }); return }
      if (data.type === 'ready') { state('worker-ready', { software: !!data.software }); tag.textContent = '550W'; worker.postMessage({ type: 'framing' }); worker.postMessage({ type: 'view', preset: 'interview' }); return }
      if (data.type === 'first-frame' || data.type === 'watchdog') {
        worker.postMessage({ type: 'framing' })
        worker.postMessage({ type: 'view', preset: 'interview' })
      } else if (data.type === 'error') {
        failAndFallback('worker-message: ' + (data.message || ''))
      }
    } catch (err) { /* noop */ }
  }

  let visible = true
  const sendStatus = () => { try { worker.postMessage({ type: 'status', status: readStatus() }) } catch (err) { /* noop */ } }
  try { worker.postMessage({ type: 'init', canvas: surface, status: readStatus() }, [surface]) } catch (err) {
    return failAndFallback('worker-init: ' + err.message)
  }
  state('worker-init')

  /* 可见性：启动屏期间、页面隐藏时暂停 */
  let mo = null
  try {
    const splash = document.getElementById('dsh-command-splash')
    if (splash) { visible = false; box.style.opacity = '0' }
    mo = new MutationObserver(() => {
      const s = document.getElementById('dsh-command-splash')
      visible = !s
      box.style.opacity = visible ? '' : '0'
      box.style.pointerEvents = visible ? '' : 'none'
      sendStatus()
    })
    mo.observe(document.documentElement, { childList: true, subtree: true })
  } catch (err) { /* noop */ }
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden
    sendStatus()
  })

  /* 减少动态状态变化时同步给 worker */
  if (reducedQuery && reducedQuery.addEventListener) {
    reducedQuery.addEventListener('change', sendStatus)
  }

  /* ── 实时配置：尺寸 / 开关 / 吸附，三通道（事件 + BroadcastChannel + localStorage 轮询） ── */
  const api = {
    box,
    kind: 'worker',
    show: () => { box.style.display = '' },
    hide: () => { box.style.display = 'none' },
    resize: (size) => {
      const next = Math.round(Math.min(520, Math.max(80, Number(size) || cfg.size)))
      if (next === cfg.size) return
      cfg.size = next
      box.style.width = box.style.height = next + 'px'
      place(box.offsetLeft, box.offsetTop)
      sendStatus()
    },
    setSnap: (on) => { cfg.snap = !!on },
    destroy: () => {
      try { worker.terminate() } catch (err) { /* noop */ }
      try { mo && mo.disconnect() } catch (err) { /* noop */ }
      box.remove()
    }
  }
  window.__DSC_PET_INSTANCE__ = api

  const applyCfg = (next) => {
    if (!next) return
    cfg.snap = next.snap !== false
    if (next.enabled === false) {
      box.style.display = 'none'
      return
    }
    box.style.display = ''
    api.resize(Number(next.size) || cfg.size)
  }
  window.__DSC_PET_API__ = { apply: applyCfg }
  window.addEventListener('dsc:pet-config', (ev) => applyCfg(ev && ev.detail))
  try {
    if (typeof BroadcastChannel === 'function') {
      const bus = new BroadcastChannel('dsc-pet')
      bus.onmessage = (ev) => { if (ev && ev.data) applyCfg(ev.data) }
    }
  } catch (err) { /* noop */ }
  try {
    window.addEventListener('storage', (ev) => {
      if (ev && ev.key === 'dsc:pet-config' && ev.newValue) {
        try { applyCfg(JSON.parse(ev.newValue)) } catch (err) { /* noop */ }
      }
    })
  } catch (err) { /* noop */ }
  let lastStored = JSON.stringify(readStoredPetConfig() || null)
  window.setInterval(() => {
    const next = readStoredPetConfig()
    const key = JSON.stringify(next || null)
    if (key !== lastStored) { lastStored = key; if (next) applyCfg(next) }
  }, 600)

  /* 尺寸变化（窗口缩放）时把新尺寸同步给 worker */
  try {
    const ro = new ResizeObserver(() => sendStatus())
    ro.observe(box)
  } catch (err) { /* noop */ }

  return api
}

state('module-loaded')
startPet().catch((err) => { state('crashed', { error: String((err && err.stack) || err) }) })
