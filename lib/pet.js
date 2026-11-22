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

const DEFAULTS = { size: 140, top: 2 }
/** 模块级配置：设置面板的实时 API 也要读写它（必须是模块作用域） */
let cfg = readCfg()

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
  cfg = readCfg()
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
    box.style.top = clamp(y, 0, Math.max(0, vh() - cfg.size - 2)) + 'px'
  }

  /* 吸附：拖到下半区松手 → 同 x 吸回顶部（CSS 过渡做动画） */
  const snapToTop = () => {
    const top = 2
    box.classList.add('is-snapping')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      box.style.top = top + 'px'
    }))
    try { localStorage.setItem('dsc:pet-pos', JSON.stringify({ x: box.offsetLeft, y: top })) } catch (err) { /* noop */ }
    window.setTimeout(() => box.classList.remove('is-snapping'), 360)
  }
  if (cfg.snap !== false) place(Number.isFinite(saved && saved.x) ? saved.x : vw() - cfg.size - 2, 2)
  else if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y)
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
  renderer.toneMappingExposure = 1.12

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100)

  /* 金属件必须有环境反射，否则整块发黑：用几块发光板搭一个极小"影棚"，PMREM 成环境贴图 */
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envPanel = (w, h, color, intensity, pos, rot) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    mesh.position.set(pos[0], pos[1], pos[2])
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2])
    envScene.add(mesh)
  }
  envPanel(9, 5, 0xffffff, 4.2, [0, 4.5, 5])
  envPanel(6, 6, 0xf2f6ff, 2.6, [-5, 2, 2], [0, Math.PI / 2, 0])
  envPanel(6, 6, 0xffe7d6, 1.8, [5, 1.4, 2], [0, -Math.PI / 2, 0])
  envPanel(10, 10, 0x3a3f47, 1.1, [0, -5, 0], [Math.PI / 2, 0, 0])
  scene.environment = pmrem.fromScene(envScene, 0.05).texture

  scene.add(new THREE.AmbientLight(0xffffff, 0.32))
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x30343a, 0.85))
  const key = new THREE.DirectionalLight(0xfff4ea, 1.9)
  key.position.set(2.4, 3.2, 2.6)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.65)
  fill.position.set(-2.8, 1.2, 2.2)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xff5a3a, 0.55)
  rim.position.set(-2.6, 0.6, -2.4)
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
  let fx = null

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
    const dist = (Math.max(size3.x, size3.y, size3.z) / 2) / Math.tan(fov / 2) * 1.08
    camera.near = dist / 50
    camera.far = dist * 12
    camera.position.set(0, 0.02, dist)
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
          if ('envMapIntensity' in mat) mat.envMapIntensity = 0.95
          if (mat.metalness !== undefined && mat.metalness > 0.6 && mat.roughness > 0.6) mat.roughness = 0.45
        }
      }
      if (JOINT_NAMES.includes(node.name) && !rawParts[node.name]) rawParts[node.name] = node
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        for (const mat of mats) {
          for (const slot of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) {
            if (mat[slot]) mat[slot].colorSpace = slot === 'map' || slot === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace
          }
          if ('envMapIntensity' in mat) mat.envMapIntensity = 0.95
          if (mat.metalness !== undefined && mat.metalness > 0.6 && mat.roughness > 0.6) mat.roughness = 0.45
        }
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
  gS.updateMatrixWorld(true)
  joints = { shoulder: gS, elbow: gE, wrist: gW, axes: { boomAxis, elbowAxis, wristAxis }, moved }
  state('ready', { joints: ['shoulder', 'elbow', 'wrist'], arms: moved })

  /* ── 原生灯光 / 镜头旋转：只改模型自带零件的材质与旋转，不新增任何 mesh / light ── */
  try {
    const LENS = new THREE.Vector3(51.8, 61.4, 21.3)   /* H50 镜片中心（CAD mm） */
    const lensMeshes = []
    const store = { lensPivot: null, leds: [], guides: [], indicator: [], ringMats: [] }
    rootNode.traverse((node) => {
      if (!node.isMesh) return
      const nName = String(node.name || '')
      const mats = Array.isArray(node.material) ? node.material.slice() : [node.material]
      let changed = false
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i]
        if (!mat) continue
        const name = String(mat.name || '')
        if (/ceramic LED package/i.test(name)) {
          const copy = mat.clone()
          copy.emissive = new THREE.Color(0xff4a1e)
          copy.emissiveIntensity = 0.5
          copy.needsUpdate = true
          mats[i] = copy
          store.leds.push(copy)
          changed = true
        } else if (/cyan-white status light/i.test(name)) {
          const copy = mat.clone()
          copy.emissiveIntensity = 1
          copy.needsUpdate = true
          mats[i] = copy
          store.guides.push(copy)
          changed = true
        }
      }
      if (changed) node.material = Array.isArray(node.material) ? mats : mats[0]
      if (/indicator insert/i.test(nName)) {
        const mats2 = Array.isArray(node.material) ? node.material : [node.material]
        const copy = mats2[0].clone()
        copy.emissive = new THREE.Color(0xff9a3a)
        copy.emissiveIntensity = 0.35
        copy.needsUpdate = true
        node.material = copy
        store.indicator.push(copy)
      }
      if (/head-batch-097/i.test(nName)) {
        const m = Array.isArray(node.material) ? node.material[0] : node.material
        const ring = m.clone()
        ring.emissive = new THREE.Color(0x2e0a05)
        ring.emissiveIntensity = 0.35
        ring.needsUpdate = true
        node.material = ring
        store.ringMats.push(ring)
      }
      if (/head-batch-097|narrow machined inner lip|transparent LCD cover|零件 87[01]/i.test(nName)) lensMeshes.push(node)
    })
    if (lensMeshes.length) {
      const lensPivot = new THREE.Group()
      lensPivot.name = 'dsc-lens-pivot'
      lensPivot.position.copy(LENS).sub(W2)
      gW.add(lensPivot)
      for (const m of lensMeshes) {
        try { lensPivot.attach(m) } catch (err) { /* noop */ }
      }
      store.lensPivot = lensPivot
    }
    fx = store
  } catch (err) { fx = null }

  /* 镜头旋转：照 MOSS 的 TOF rotor 节奏（0 → 64° → -42° → 0，10.45s 一轮） */
  const rotorAngle = (t) => {
    const cycle = 10.45
    const x = ((t % cycle) + cycle) % cycle
    const keys = [[0, 0], [2.6, 64], [3.3, 64], [6.9, -42], [7.55, -42], [9.65, 0], [10.45, 0]]
    for (let i = 1; i < keys.length; i++) {
      if (x <= keys[i][0]) {
        const [t0, a0] = keys[i - 1]
        const [t1, a1] = keys[i]
        const k = (x - t0) / (t1 - t0)
        const e = k * k * (3 - 2 * k)
        return (a0 + (a1 - a0) * e) * Math.PI / 180
      }
    }
    return 0
  }
  const updateFx = (t) => {
    if (!fx) return
    /* 镜头旋转：MOSS 的 TOF rotor（10.45s 一轮，0→64°→-42°→0） */
    if (fx.lensPivot) fx.lensPivot.rotation.z = rotorAngle(t)
    /* 状态灯：轻微呼吸（MOSS 里还有 speaking 加成，这里保持常亮呼吸） */
    for (let i = 0; i < fx.guides.length; i++) fx.guides[i].emissiveIntensity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7))
    /* LED 阵列：MOSS 的扫描位置 F = (sin(E*1.1-π/2)*.5+.5)*(n-1)，整块板按高斯亮度掠过 */
    const scan = 0.5 + 0.5 * Math.sin(t * 1.1 - Math.PI / 2)
    for (let i = 0; i < fx.leds.length; i++) fx.leds[i].emissiveIntensity = 0.12 + 1.15 * (0.35 + 0.65 * scan)
    /* 底部呼吸灯：MOSS 的 period 3.6s，intensity = .12 + 1.33*(.5-.5*cos(phase*2π)) */
    const phase = (t % 3.6) / 3.6
    const breathe = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
    for (let i = 0; i < fx.indicator.length; i++) fx.indicator[i].emissiveIntensity = 0.12 + 1.33 * breathe
    if (fx.ringMats) {
      const ringGlow = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.9))
      for (const m of fx.ringMats) m.emissiveIntensity = ringGlow
    }
    /* 小屏：8fps 刷新 */
    if (fx.screen && t - fx.screen.last > 0.125) {
      fx.screen.last = t
      drawScreenTex(fx.screen, t)
      fx.screen.tex.needsUpdate = true
    }
  }

  /* 舵机式姿态：离散目标 → 缓动到位 → 停住（不是连续摆动）。
     角度参考 MOSS 自己的 standby / listen / think / speak 姿态表。 */
  const SERVO_POSES = [
    { yaw: 0, bend: 0, pitch: 0 },      /* standby */
    { yaw: -6, bend: 1.5, pitch: 0 },   /* listen */
    { yaw: -4, bend: 1, pitch: 0 },     /* think */
    { yaw: -7.5, bend: 2, pitch: 0 },   /* speak */
    { yaw: 4, bend: 1, pitch: 0 }       /* glance */
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
    toPose.yaw = -8
    toPose.bend = 2
    toPose.pitch = 0
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
    /* 吸附开启时，宠物始终锚在顶部：任何一次拖动松手都滑回顶部（只允许左右拖） */
    if (cfg.snap !== false && moved > 4) {
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
      updateFx(t)
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
