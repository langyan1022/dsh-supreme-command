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

/** 小屏内容：MOSS // 550W 抬头 + 滚动十六进制数据（每帧重绘一次即可） */
function drawScreen(screen, t) {
  const ctx = screen.ctx
  const w = screen.canvas.width
  const h = screen.canvas.height
  ctx.fillStyle = '#04120f'
  ctx.fillRect(0, 0, w, h)
  /* 扫描线 */
  ctx.fillStyle = 'rgba(94,240,207,.08)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
  /* 抬头 */
  ctx.font = 'bold 13px Consolas, monospace'
  ctx.fillStyle = '#5ef0cf'
  ctx.fillText('MOSS // 550W', 5, 14)
  ctx.fillStyle = '#ff4a2a'
  ctx.fillRect(5, 19, 20, 3)
  /* 滚动数据 */
  screen.scroll = (screen.scroll + 1) % 4096
  ctx.font = '10px Consolas, monospace'
  const hex = '0123456789ABCDEF'
  for (let row = 0; row < 5; row++) {
    let line = ''
    for (let k = 0; k < 13; k++) {
      const n = (screen.scroll + row * 31 + k * 7 + Math.floor(t * 3)) % 16
      line += hex[n]
    }
    ctx.fillStyle = row === 2 ? '#ff7a4a' : 'rgba(94,240,207,.86)'
    ctx.fillText(line, 6, 33 + row * 6.4)
  }
}

/** 550W 机身小屏（CAD-Bottom strip / circuit window）的动效纹理 */
function createScreenCanvas(THREE) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return { canvas, ctx, texture, scroll: 0, last: 0 }
}

function readCfg() {
  try {
    const c = window.__DSC_CFG__ || {}
    return {
      enabled: c.pet !== false,
      size: Math.round(Math.min(520, Math.max(80, Number(c.petSize) || DEFAULTS.size))),
      snap: c.petSnap !== false
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
    box.style.top = clamp(y, 56, Math.max(56, vh() - cfg.size - 8)) + 'px'
  }

  /* 吸附：拖到下半区松手 → 同 x 吸回顶部（CSS 过渡做动画） */
  const snapToTop = () => {
    const top = Math.max(56, Math.min(92, Math.round(vh() * 0.09)))
    box.classList.add('is-snapping')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      box.style.top = top + 'px'
    }))
    try { localStorage.setItem('dsc:pet-pos', JSON.stringify({ x: box.offsetLeft, y: top })) } catch (err) { /* noop */ }
    window.setTimeout(() => box.classList.remove('is-snapping'), 360)
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
  let meshAssign = null
  const animStore = { leds: [], screen: null, lights: [] }
  const JOINT_NAMES = ['mount', 'shoulder', 'elbow', 'head']
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
      if (node.isMesh && node.material) {
        const list = Array.isArray(node.material) ? node.material.slice() : [node.material]
        let changed = false
        for (let mi = 0; mi < list.length; mi++) {
          const mat = list[mi]
          const name = String(mat.name || '')
          if (/cyan-white status light/i.test(name)) {
            const copy = mat.clone()
            copy.emissiveIntensity = 1
            list[mi] = copy
            animStore.leds.push({ mat: copy, phase: animStore.leds.length * 2.3, red: false })
            changed = true
          } else if (/ceramic LED package/i.test(name)) {
            const copy = mat.clone()
            copy.emissive = new THREE.Color(0xff2d12)
            copy.emissiveIntensity = 0.6
            list[mi] = copy
            animStore.leds.push({ mat: copy, phase: animStore.leds.length * 1.7, red: true })
            changed = true
          } else if (/circuit diagram window|circuit window/i.test(name + ' ' + node.name)) {
            const copy = mat.clone()
            const screen = createScreenCanvas(THREE)
            copy.map = screen.texture
            copy.emissiveMap = screen.texture
            copy.emissive = new THREE.Color(0xffffff)
            copy.emissiveIntensity = 1.05
            copy.color = new THREE.Color(0x0a1a16)
            copy.needsUpdate = true
            list[mi] = copy
            screen.mat = copy
            animStore.screen = screen
            changed = true
          }
        }
        if (changed) node.material = Array.isArray(node.material) ? list : list[0]
      }
    })
    /* 逐 mesh 归类：头顶机身 → head；y≥200 的安装件 → base；其余按到 boom/forearm 轴线的距离分 */
    const S = new THREE.Vector3(43.72372817993164, 199.61929321289062, -20.99999237060547)
    const E = new THREE.Vector3(109.67351531982422, 170.25534057617188, -17.32156753540039)
    const W = new THREE.Vector3(83.83039855957031, 63.620994567871094, -18.83231544494629)
    const H = new THREE.Vector3(43.500003814697266, 75.99998474121094, -26.499998092651367)
    const segDist = (point, a, b2) => {
      const ab = b2.clone().sub(a)
      const ap = point.clone().sub(a)
      const len2 = ab.lengthSq() || 1
      const t = Math.max(0, Math.min(1, ap.dot(ab) / len2))
      return point.distanceTo(a.clone().addScaledVector(ab, t))
    }
    root.updateMatrixWorld(true)
    const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const c0 = new THREE.Vector3()
    meshAssign = new Map()
    root.traverse((node) => {
      if (!node.isMesh) return
      node.geometry.computeBoundingBox()
      node.geometry.boundingBox.getCenter(c0)
      c0.applyMatrix4(node.matrixWorld).applyMatrix4(invRoot)
      let label
      const inHead = c0.x < 92 && c0.y < 138 && c0.z < 34 && c0.y > -12
      if (inHead) label = 'head'
      else if (c0.y >= 200) label = 'base'
      else label = segDist(c0, S, E) <= segDist(c0, E, W) ? 'boom' : 'forearm'
      meshAssign.set(node, label)
    })
    frameModel(root)
    bob.add(root)
    ready = true
  } catch (err) {
    state('model-failed', { error: String((err && err.stack) || err) })
    box.remove()
    return null
  }
  /* 真关节：按 MOSS 的锚点搭 shoulderYaw → elbowYaw → wristPitch 链，
     再把每个 mesh 挂到它所属的段上（零件本身保持世界位置，只有枢轴动）。 */
  const rootNode = bob.children[0]
  if (!rootNode) { box.remove(); return null }
  rootNode.updateMatrixWorld(true)
  const S2 = new THREE.Vector3(43.72372817993164, 199.61929321289062, -20.99999237060547)
  const E2 = new THREE.Vector3(109.67351531982422, 170.25534057617188, -17.32156753540039)
  const W2 = new THREE.Vector3(83.83039855957031, 63.620994567871094, -18.83231544494629)
  const H2 = new THREE.Vector3(43.500003814697266, 75.99998474121094, -26.499998092651367)
  const gS = new THREE.Group(); gS.name = 'dsc-rig-shoulder'; gS.position.copy(S2)
  const gE = new THREE.Group(); gE.name = 'dsc-rig-elbow'; gE.position.copy(E2).sub(S2)
  const gW = new THREE.Group(); gW.name = 'dsc-rig-wrist'; gW.position.copy(W2).sub(E2)
  rootNode.add(gS); gS.add(gE); gE.add(gW)
  const boomAxis = new THREE.Vector3(0, 1, 0)
  const elbowAxis = E2.clone().sub(S2).cross(W2.clone().sub(E2)).normalize()
  const wristAxis = W2.clone().sub(E2).cross(H2.clone().sub(W2)).normalize()
  let moved = 0
  if (meshAssign) {
    for (const [mesh, label] of meshAssign) {
      if (label === 'base') continue
      const target = label === 'boom' ? gS : label === 'forearm' ? gE : gW
      try { target.attach(mesh); moved++ } catch (err) { /* 单个零件挂不上就算了 */ }
    }
  }
  try { window.__DSC_PET_ANIM__ = animStore } catch (e) { /* noop */ }
  gS.updateMatrixWorld(true)
  /* 前脸叠加层：一块真正会动的小屏 + 6 颗扫描 LED（绕开 GLB 的 UV/材质限制） */
  const front = new THREE.Group()
  front.name = 'dsc-front-overlay'
  gW.add(front)
  const overlayScreen = createScreenCanvas(THREE)
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 17),
    new THREE.MeshBasicMaterial({ map: overlayScreen.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  )
  /* gW 在 root 空间的原点是 wristPitch(83.8,63.6,-18.8)，这里换算到前脸 (44,40,29) 附近 */
  screenMesh.position.set(-39.5, -23.5, 48)
  front.add(screenMesh)
  animStore.screen2 = overlayScreen
  animStore.ledBars = []
  const ledGeo = new THREE.PlaneGeometry(6.2, 1.9)
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35ffd9), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
    const bar = new THREE.Mesh(ledGeo, mat)
    bar.position.set(-39.5 - 15.5 + i * 6.2, -10.6, 48)
    front.add(bar)
    animStore.ledBars.push(bar)
  }
  try { window.__DSC_FRONT__ = front } catch (err) { /* noop */ }

  /* 镜头附近的红色补光：随"呼吸"变化，像 550W 的光学核心 */
  const glow = new THREE.PointLight(0xff3a22, 0.45, 110, 2)
  glow.position.set(0, -4, 16)
  gW.add(glow)
  animStore.lights.push(glow)
  animStore.leds.forEach((l, i) => { l.phase = i * 1.7 })
  joints = { shoulder: gS, elbow: gE, wrist: gW, axes: { boomAxis, elbowAxis, wristAxis }, moved }
  state('ready', { joints: ['shoulder', 'elbow', 'wrist'], arms: moved })

  /* 舵机式姿态：离散目标 → 缓动到位 → 停住（不是连续摆动）。
     角度参考 MOSS 自己的 standby / listen / think / speak 姿态表。 */
  const SERVO_POSES = [
    { yaw: 0, bend: 0, pitch: 0 },      /* standby */
    { yaw: -11, bend: 4, pitch: 17 },   /* listen */
    { yaw: -9, bend: 3, pitch: 13 },    /* think */
    { yaw: -13, bend: 5, pitch: 19 },   /* speak */
    { yaw: 6, bend: 2, pitch: 7 }       /* glance */
  ]
  const pose = { yaw: 0, bend: 0, pitch: 0 }
  const fromPose = { yaw: 0, bend: 0, pitch: 0 }
  const toPose = { yaw: 0, bend: 0, pitch: 0 }
  let moveStart = performance.now()
  let moveDuration = 1200
  let nextPoseAt = performance.now() + 2000
  const rand = (lo, hi) => lo + Math.random() * (hi - lo)
  const easeInOut = (x) => x * x * (3 - 2 * x)
  const pickPose = () => {
    fromPose.yaw = pose.yaw
    fromPose.bend = pose.bend
    fromPose.pitch = pose.pitch
    const tgt = SERVO_POSES[Math.floor(Math.random() * SERVO_POSES.length)]
    toPose.yaw = tgt.yaw + rand(-1.2, 1.2)
    toPose.bend = tgt.bend + rand(-0.8, 0.8)
    toPose.pitch = tgt.pitch + rand(-1.2, 1.2)
    moveStart = performance.now()
    moveDuration = rand(850, 1500)
    nextPoseAt = moveStart + moveDuration + rand(1900, 4600)
  }
  const servoNudge = () => {
    fromPose.yaw = pose.yaw
    fromPose.bend = pose.bend
    fromPose.pitch = pose.pitch
    toPose.yaw = -13
    toPose.bend = 5
    toPose.pitch = 19
    moveStart = performance.now()
    moveDuration = 650
    nextPoseAt = moveStart + moveDuration + 1600
  }
  const stepPose = (now) => {
    const raw = Math.max(0, Math.min(1, (now - moveStart) / moveDuration))
    const e = easeInOut(raw)
    pose.yaw = fromPose.yaw + (toPose.yaw - fromPose.yaw) * e
    pose.bend = fromPose.bend + (toPose.bend - fromPose.bend) * e
    pose.pitch = fromPose.pitch + (toPose.pitch - fromPose.pitch) * e
  }
  const _q = new THREE.Quaternion()
  const applyPose = () => {
    if (!joints.shoulder) return
    joints.shoulder.quaternion.setFromAxisAngle(joints.axes.boomAxis, (pose.yaw * Math.PI) / 180)
    joints.elbow.quaternion.setFromAxisAngle(joints.axes.elbowAxis, (pose.bend * Math.PI) / 180)
    joints.wrist.quaternion.setFromAxisAngle(joints.axes.wristAxis, (pose.pitch * Math.PI) / 180)
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
    const moved = drag.moved
    const dragging = drag
    drag = null
    try { box.releasePointerCapture(dragging.id) } catch (err) { /* noop */ }
    box.classList.remove('is-dragging')
    const releasedTop = box.offsetTop
    if (moved < 5) { servoNudge(); return }
    const bottom = releasedTop + cfg.size
    const shouldSnap = cfg.snap !== false && moved > 4 && (
      releasedTop + cfg.size * 0.5 > vh() * 0.5 ||   /* 中心过了半屏 */
      bottom > vh() - 12                             /* 已经贴到窗口底部 */
    )
    if (shouldSnap) {
      snapToTop()
    } else {
      try { localStorage.setItem('dsc:pet-pos', JSON.stringify({ x: box.offsetLeft, y: box.offsetTop })) } catch (err) { /* noop */ }
    }
  }
  box.addEventListener('pointerup', endDrag)
  box.addEventListener('pointercancel', endDrag)
  box.addEventListener('lostpointercapture', endDrag)
  /* 全局兜底：在窗口外松手、触控板丢事件时也要能吸附 */
  window.addEventListener('pointerup', endDrag, true)
  window.addEventListener('pointercancel', endDrag, true)

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
      /* 只保留一点点悬浮感，不再整机摆动 */
      bob.position.y = Math.sin(t * 0.8) * 0.006

      const now = performance.now()
      var dbgPose = window.__DSC_PET_POSE__
      if (dbgPose && dbgPose.frozen) {
        pose.yaw = dbgPose.yaw
        pose.bend = dbgPose.bend
        pose.pitch = dbgPose.pitch
      } else {
        if (now > nextPoseAt) pickPose()
        stepPose(now)
      }
      applyPose()

      /* 灯效：状态灯呼吸 + LED 扫描 */
      for (let i = 0; i < animStore.leds.length; i++) {
        const led = animStore.leds[i]
        if (!led.mat) continue
        if (led.red) {
          led.mat.emissiveIntensity = 0.55 + 1.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + led.phase))
        } else {
          led.mat.emissiveIntensity = 0.7 + 1.1 * (0.5 + 0.5 * Math.sin(t * 0.9 + led.phase))
        }
      }
      /* 小屏幕：每 110ms 重绘滚动数据 */
      if (animStore.screen && t - animStore.screen.last > 0.11) {
        animStore.screen.last = t
        drawScreen(animStore.screen, t)
        animStore.screen.texture.needsUpdate = true
      }
      /* 叠加小屏：滚动数据 */
      if (animStore.screen2 && t - animStore.screen2.last > 0.11) {
        animStore.screen2.last = t
        drawScreen(animStore.screen2, t)
        animStore.screen2.texture.needsUpdate = true
      }
      /* 6 颗 LED：高斯扫描，一颗一颗亮过去 */
      if (animStore.ledBars) {
        const scan = (t * 1.25) % animStore.ledBars.length
        for (let i = 0; i < animStore.ledBars.length; i++) {
          const bar = animStore.ledBars[i]
          const d = i - scan
          const glowV = Math.exp(-(d * d) / 0.55)
          bar.material.opacity = 0.18 + 0.82 * glowV
          bar.material.color.setRGB(0.2 + 0.35 * glowV, 0.85 + 0.15 * glowV, 0.72 + 0.25 * glowV)
        }
      }
      /* 红色补光呼吸 */
      for (const light of animStore.lights) light.intensity = 0.28 + 0.34 * (0.5 + 0.5 * Math.sin(t * 1.35))
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
      const next = Math.round(Math.min(520, Math.max(80, Number(size) || cfg.size)))
      if (next === cfg.size) return
      cfg.size = next
      box.style.width = box.style.height = next + 'px'
      resize()
      place(box.offsetLeft, box.offsetTop)
      dirty = true
      if (raf === 0) tick()
    },
    setEnabled: (on) => { cfg.enabled = !!on; if (on) { setVisible(true) } else { setVisible(false); box.remove() } },
    setSnap: (on) => { cfg.snap = !!on }
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
    const size = Math.round(Math.min(520, Math.max(80, Number(next.size) || 140)))
    cfg.snap = next.snap !== false
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

/* 设置面板可能在另一个 window/iframe：BroadcastChannel + storage + 轮询三路兜底 */
function readStoredPetConfig() {
  try {
    const raw = localStorage.getItem('dsc:pet-config')
    if (!raw) return null
    const cfg = JSON.parse(raw)
    if (!cfg || typeof cfg !== 'object') return null
    return { enabled: cfg.enabled !== false, size: Number(cfg.size) || 140, snap: cfg.snap !== false }
  } catch (err) { return null }
}
try {
  if (typeof BroadcastChannel === 'function') {
    const bus = new BroadcastChannel('dsc-pet')
    bus.onmessage = (ev) => { if (ev && ev.data) applyPetConfig(ev.data) }
  }
} catch (err) { /* noop */ }
try {
  window.addEventListener('storage', (ev) => {
    if (ev && ev.key === 'dsc:pet-config' && ev.newValue) {
      try { applyPetConfig(JSON.parse(ev.newValue)) } catch (err) { /* noop */ }
    }
  })
} catch (err) { /* noop */ }
/* 轮询兜底：设置面板在独立进程/窗口且 storage 事件不过来的话，也能跟上 */
let lastStoredConfig = JSON.stringify(readStoredPetConfig() || null)
window.setInterval(() => {
  const cfg = readStoredPetConfig()
  const key = JSON.stringify(cfg || null)
  if (key !== lastStoredConfig) {
    lastStoredConfig = key
    if (cfg) applyPetConfig(cfg)
  }
}, 600)
/* 启动时先用持久化的实时配置（面板写过但本模块还没加载） */
try {
  const stored = readStoredPetConfig()
  if (stored) {
    lastStoredConfig = JSON.stringify(stored)
    cfg = Object.assign({}, cfg, { enabled: stored.enabled !== false, size: stored.size, snap: stored.snap !== false })
  }
} catch (err) { /* noop */ }

startPet().catch((err) => { state('crashed', { error: String((err && err.stack) || err) }) })
