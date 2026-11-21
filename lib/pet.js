/**
 * 550W 桌面宠物（主题可选件）。
 *
 * 加载本机 MOSS 的 550W 模型（Host 路由 /dsh-command/pet/model.glb 会从本机路径读），
 * 用 three.js 渲染成一个小窗口挂件：
 *   · 可拖动摆放（位置记在 localStorage），默认停在顶部，可左右滑动
 *   · 待机：缓慢自转 + 轻微浮动 + 机械臂小幅摆动；点一下会"挥手"加速摆动
 *   · 无吊轨/无边框，纯悬浮；静帧/减少动态时不动
 *
 * 任何一步失败（没有 WebGL / 模型 404 / three 加载失败）都会静默移除自己，不影响主题。
 */

const DEFAULTS = { size: 140, top: 92 }

function readCfg() {
  try {
    const c = window.__DSC_CFG__ || {}
    return {
      enabled: c.pet !== false,
      size: Math.round(Math.min(260, Math.max(80, Number(c.petSize) || DEFAULTS.size)))
    }
  } catch (err) {
    return { enabled: true, size: DEFAULTS.size }
  }
}

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (err) { return fallback }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (err) { /* noop */ }
}

function state(stage, extra) {
  try { window.__DSC_PET_STATE__ = Object.assign({ stage }, extra || {}) } catch (err) { /* noop */ }
}

export async function startPet() {
  state('start')
  let cfg = readCfg()
  if (!cfg.enabled) return null
  if (window.__DSC_PET__) return window.__DSC_PET__
  window.__DSC_PET__ = true

  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  let THREE
  let GLTFLoader
  let MeshoptDecoder
  try {
    THREE = await import('./three/three.module.min.js')
    ;({ GLTFLoader } = await import('./three/GLTFLoader.js'))
    ;({ MeshoptDecoder } = await import('./three/meshopt_decoder.module.js'))
  } catch (err) {
    state('three-failed', { error: String((err && err.stack) || err) })
    return null
  }
  state('three-loaded')

  /* ── DOM ─────────────────────────────────────────────────────────────── */
  const box = document.createElement('div')
  box.className = 'dsc-pet'
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', '550W 桌面宠物（可拖动）')
  box.style.width = box.style.height = cfg.size + 'px'
  const canvas = document.createElement('canvas')
  box.appendChild(canvas)
  const tag = document.createElement('span')
  tag.className = 'dsc-pet__tag'
  tag.textContent = '550W'
  box.appendChild(tag)
  ;(document.body || document.documentElement).appendChild(box)

  const saved = storageGet('dsc:pet-pos', null)
  const vw = () => window.innerWidth || document.documentElement.clientWidth || 1280
  const vh = () => window.innerHeight || document.documentElement.clientHeight || 800
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
  /* 默认贴着顶部、以左右滑动为主；拖动仍可上下，但限制在视口上半部 */
  const place = (x, y) => {
    box.style.left = clamp(x, 6, vw() - cfg.size - 6) + 'px'
    box.style.top = clamp(y, 56, Math.max(56, vh() * 0.45)) + 'px'
  }
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y)
  else place(vw() - cfg.size - 28, DEFAULTS.top)

  /* ── three 场景 ──────────────────────────────────────────────────────── */
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (err) {
    state('webgl-failed', { error: String((err && err.stack) || err) })
    box.remove()
    return null
  }
  state('renderer-ready')
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  renderer.setPixelRatio(dpr)
  renderer.setClearAlpha(0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xfff2e8, 2.1)
  key.position.set(2.4, 3.2, 2.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xff3b30, 1.2)
  rim.position.set(-2.6, 0.8, -2.2)
  scene.add(rim)

  const pivot = new THREE.Group()
  scene.add(pivot)
  const bob = new THREE.Group()
  pivot.add(bob)

  let mixerTime = 0
  let ready = false
  let joints = {}
  const rawParts = {}
  const JOINT_NAMES = ['shoulder', 'elbow', 'head']
  /* 锚点来自 moss-exterior.json（CAD mm，根空间） */
  const ANCHORS = {
    shoulder: [43.72372817993164, 199.61929321289062, -20.99999237060547],
    elbow: [109.67351531982422, 170.25534057617188, -17.32156753540039],
    wrist: [83.83039855957031, 63.620994567871094, -18.83231544494629]
  }
  let waveUntil = 0
  let visible = true
  let dirty = true

  const resize = () => {
    const size = cfg.size
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    renderer.setSize(size, size, false)
    camera.aspect = 1
    camera.updateProjectionMatrix()
  }
  resize()

  const frameModel = (object) => {
    /* 先归一化到 ~1 单位：模型本体可能是几百单位，直接取景会越过 far 被裁掉 */
    const raw = new THREE.Box3().setFromObject(object)
    const rawSize = raw.getSize(new THREE.Vector3())
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1
    object.scale.multiplyScalar(1 / maxDim)
    const box3 = new THREE.Box3().setFromObject(object)
    const size3 = box3.getSize(new THREE.Vector3())
    const center = box3.getCenter(new THREE.Vector3())
    object.position.sub(center)
    const fov = (camera.fov * Math.PI) / 180
    const dist = (Math.max(size3.x, size3.y, size3.z) / 2) / Math.tan(fov / 2) * 1.35
    camera.near = dist / 50
    camera.far = dist * 12
    camera.position.set(0, 0.08, dist)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    try {
      window.__DSC_PET_DEBUG__ = {
        normalise: 'unit',
        scale: object.scale.x,
        size: size3.toArray().map((v) => +v.toFixed(3)),
        cam: camera.position.toArray().map((v) => +v.toFixed(3)),
        near: +camera.near.toFixed(4),
        far: +camera.far.toFixed(2)
      }
    } catch (err) { /* noop */ }
  }

  const loader = new GLTFLoader()
  if (MeshoptDecoder) {
    try { await MeshoptDecoder.ready } catch (err) { /* noop */ }
    loader.setMeshoptDecoder(MeshoptDecoder)
  }
  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(new URL('./model.glb', import.meta.url).href, resolve, undefined, reject)
    })
    const root = gltf.scene
    root.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        for (const mat of mats) {
          for (const slot of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) {
            if (mat[slot]) mat[slot].colorSpace = slot === 'map' || slot === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace
          }
        }
      }
      if (JOINT_NAMES.includes(node.name) && !rawParts[node.name]) rawParts[node.name] = node
    })
    frameModel(root)
    bob.add(root)
    ready = true
  } catch (err) {
    state('model-failed', { error: String((err && err.stack) || err) })
    box.remove()
    return null
  }
  /* CAD 装配体没有可用的运动学链（直接转零件会散架），所以不动模型本身：
     用相机小幅环视 + 整机浮动来制造"它在看着你/轻轻转动"的活物感，绝不 360° 旋转 */
  const camBase = camera.position.clone()
  const camDist = camBase.length()
  joints = { camera: true }
  state('ready', { joints: ['camera'], arms: 1 })

  /* 关节姿态状态：随机选目标 → 缓动过去 → 停留 → 再换一个 */
  const pose = { yaw: 0, bend: 0, pitch: 0 }
  const target = { yaw: 0, bend: 0, pitch: 0 }
  let nextPoseAt = performance.now() + 1600
  const rand = (lo, hi) => lo + Math.random() * (hi - lo)
  const pickPose = () => {
    target.yaw = rand(-13, 13)
    target.bend = 0
    target.pitch = rand(-6, 8)
    nextPoseAt = performance.now() + rand(1900, 4600)
  }
  const applyPose = () => {
    const yaw = (pose.yaw * Math.PI) / 180
    const pitch = (pose.pitch * Math.PI) / 180
    camera.position.set(
      Math.sin(yaw) * camDist,
      camBase.y + Math.sin(pitch) * camDist * 0.55,
      Math.cos(yaw) * camDist
    )
    camera.lookAt(0, 0, 0)
  }

  /* ── 拖动 ────────────────────────────────────────────────────────────── */
  let drag = null
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
  const endDrag = (ev) => {
    if (!drag) return
    try { box.releasePointerCapture(ev.pointerId) } catch (err) { /* noop */ }
    box.classList.remove('is-dragging')
    if (drag.moved < 5) waveUntil = performance.now() + 1400
    storageSet('dsc:pet-pos', { x: box.offsetLeft, y: box.offsetTop })
    drag = null
  }
  box.addEventListener('pointerup', endDrag)
  box.addEventListener('pointercancel', endDrag)

  window.addEventListener('resize', () => place(box.offsetLeft, box.offsetTop), { passive: true })

  /* ── 动画 ────────────────────────────────────────────────────────────── */
  let raf = 0
  const clock = new THREE.Clock()
  const tick = () => {
    if (reduced) {
      /* 静态：只在需要时画一帧，省 GPU */
      if (ready && visible && dirty) { dirty = false; renderer.render(scene, camera) }
      return
    }
    raf = window.requestAnimationFrame(tick)
    if (!ready || !visible) return
    const dt = Math.min(0.05, clock.getDelta())
    mixerTime += dt
    const t = performance.now() / 1000
    const waving = performance.now() < waveUntil

    if (!reduced) {
      /* 不再 360° 自转：只做很小的朝向摆动，像在工作台前轻微转头 */
      pivot.rotation.y = Math.sin(t * 0.11) * 0.1
      bob.position.y = Math.sin(t * 0.9) * 0.01
      bob.rotation.z = Math.sin(t * 0.55) * 0.008

      if (performance.now() > nextPoseAt) pickPose()
      if (waving) {
        /* 点一下：连续小幅度"挥手" */
        target.yaw = Math.sin(t * 5.2) * 10
        target.bend = 18 + Math.sin(t * 5.6) * 14
        target.pitch = Math.sin(t * 4.4) * 6
        nextPoseAt = performance.now() + 500
      }
      const k = 1 - Math.exp(-dt * 2.4)
      pose.yaw += (target.yaw - pose.yaw) * k
      pose.bend += (target.bend - pose.bend) * k
      pose.pitch += (target.pitch - pose.pitch) * k
      applyPose()
    }
    renderer.render(scene, camera)
  }

  const setVisible = (next) => {
    visible = next
    dirty = true
    box.classList.toggle('is-hidden', !next)
    if (next && !raf) tick()
  }
  document.addEventListener('visibilitychange', () => setVisible(!document.hidden))
  try {
    const splash = document.getElementById('dsh-command-splash')
    if (splash) setVisible(false)
    const mo = new MutationObserver(() => {
      const s = document.getElementById('dsh-command-splash')
      setVisible(!s)
    })
    mo.observe(document.documentElement, { childList: true, subtree: true })
  } catch (err) { /* noop */ }

  const api = {
    box,
    place,
    show: () => setVisible(true),
    hide: () => setVisible(false),
    resize: (size) => {
      const next = Math.round(Math.min(260, Math.max(80, Number(size) || cfg.size)))
      if (next === cfg.size) return
      cfg.size = next
      box.style.width = box.style.height = next + 'px'
      resize()
      place(box.offsetLeft, box.offsetTop)
      dirty = true
      if (raf === 0) tick()
    },
    setEnabled: (on) => { cfg.enabled = !!on; if (on) { setVisible(true) } else { setVisible(false); box.remove() } }
  }
  window.__DSC_PET_INSTANCE__ = api
  tick()
  return api
}

state('module-loaded')

/** 供设置面板/主题用：{enabled,size} 变化时即时应用（不需要刷新） */
async function applyPetConfig(next) {
  try {
    if (!next) return
    const enabled = next.enabled !== false
    const size = Math.round(Math.min(260, Math.max(80, Number(next.size) || 140)))
    if (!enabled) {
      const inst = window.__DSC_PET_INSTANCE__
      if (inst) inst.hide()
      return
    }
    const inst = window.__DSC_PET_INSTANCE__
    if (inst) {
      inst.resize(size)
      inst.show()
      return
    }
    cfg = Object.assign({}, cfg, { enabled: true, size })
    await startPet({ enabled: true, size })
  } catch (err) {
    state('apply-failed', { error: String((err && err.stack) || err) })
  }
}

window.__DSC_PET_API__ = { apply: applyPetConfig }
window.addEventListener('dsc:pet-config', (ev) => { applyPetConfig(ev && ev.detail) })

startPet().catch((err) => { state('crashed', { error: String((err && err.stack) || err) }) })
