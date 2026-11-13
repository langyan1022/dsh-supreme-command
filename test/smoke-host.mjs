/* Host 半侧自检：配置归一化 / 变量计算 / 路由响应 / index.html 注入。
 * 不启动 Blender、不启动 DSH：用一个假的 ctx 把 apply() 跑起来，直接调 handler。
 *
 * 用法: node test/smoke-host.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dsc-host-'))
process.env.DSH_HOME = TMP

const mod = await import('../lib/index.js')
const {
  name, inject, apply, DEFAULTS, normalize, buildVarsCss, buildSplashConfig
} = mod

let passed = 0
function ok(label, fn) {
  try {
    fn()
    passed++
    console.log('PASS ' + label)
  } catch (err) {
    console.log('FAIL ' + label + '  →  ' + (err && err.message))
    process.exitCode = 1
  }
}

/* ── 身份 ─────────────────────────────────────────────────────────────── */
ok('插件名/注入声明正确', () => {
  assert.equal(name, 'dsh-supreme-command')
  assert.deepEqual(inject, ['webServer', 'connection'])
  assert.equal(typeof apply, 'function')
})

/* ── 配置归一化 ───────────────────────────────────────────────────────── */
ok('默认值齐全且类型正确', () => {
  for (const key of ['enabled', 'splashEnabled', 'mode', 'speed', 'preset', 'accent', 'glow', 'scanlines', 'grain', 'hudFrames', 'vignette', 'titleZh', 'statusLines', 'showUeg', 'showBsc', 'sound']) {
    assert.ok(key in DEFAULTS, 'DEFAULTS 缺 ' + key)
  }
  assert.equal(DEFAULTS.mode, 'session')
  assert.equal(DEFAULTS.preset, 'command-red')
})

ok('speed 越界被夹取、非法枚举回默认', () => {
  assert.equal(normalize({ speed: 99 }).speed, 2)
  assert.equal(normalize({ speed: -3 }).speed, 0.5)
  assert.equal(normalize({ mode: 'nope' }).mode, DEFAULTS.mode)
  assert.equal(normalize({ glow: 5 }).glow, 2)
  assert.equal(normalize({ scanlines: -1 }).scanlines, 0)
})

ok('布尔值接受字符串/数字形态', () => {
  assert.equal(normalize({ enabled: 'false' }).enabled, false)
  assert.equal(normalize({ sound: 0 }).sound, false)
  assert.equal(normalize({ hudFrames: 1 }).hudFrames, true)
})

ok('颜色字段校验：非法回默认、空串表示跟预设', () => {
  assert.equal(normalize({ accent: 'red' }).accent, DEFAULTS.accent)
  assert.equal(normalize({ accent: '#22d3ee' }).accent, '#22d3ee')
  assert.equal(normalize({ bgBase: '' }).bgBase, '')
})

ok('改了 accent 但预设没换 → 自动落到 custom', () => {
  const cfg = normalize({ preset: 'command-red', accent: '#22d3ee' })
  assert.equal(cfg.preset, 'custom')
})

ok('空文案有兜底（排版不会塌）', () => {
  const cfg = normalize({ titleZh: '   ', operator: '' })
  assert.equal(cfg.titleZh, DEFAULTS.titleZh)
  assert.equal(cfg.operator, DEFAULTS.operator)
})

ok('statusLines 支持数组与字符串两种输入', () => {
  assert.equal(normalize({ statusLines: ['a', 'b'] }).statusLines, 'a\nb')
  assert.equal(normalize({ statusLines: 'x\ny' }).statusLines, 'x\ny')
  assert.equal(normalize({ statusLines: '' }).statusLines, DEFAULTS.statusLines)
})

/* ── 变量注入 ─────────────────────────────────────────────────────────── */
ok('buildVarsCss 注入 8 个基色/强度变量', () => {
  const css = buildVarsCss(normalize({ preset: 'cyan' }))
  for (const v of ['--dsc-accent', '--dsc-accent-2', '--dsc-bg', '--dsc-text', '--dsc-glow', '--dsc-scanlines', '--dsc-grain', '--dsc-vignette', '--dsc-logo', '--dsc-hud-frames']) {
    assert.ok(css.includes(v), '缺变量 ' + v)
  }
  assert.ok(css.includes('#22d3ee'), 'cyan 预设色没进去')
})

ok('logoColor 角色解析正确', () => {
  assert.ok(buildVarsCss(normalize({ logoColor: 'custom', logoCustom: '#00ff00' })).includes('#00ff00'))
  assert.ok(buildVarsCss(normalize({ logoColor: 'accent2' })).includes(DEFAULTS.accent2))
})

ok('themeMode=auto 才放开原生控件的 color-scheme', () => {
  assert.ok(buildVarsCss(normalize({ themeMode: 'auto' })).includes('color-scheme:auto'))
  assert.ok(!buildVarsCss(normalize({ themeMode: 'force-dark' })).includes('color-scheme:auto'))
})

ok('buildSplashConfig 把 statusLines 拆成数组、带 logo 路由', () => {
  const cfg = buildSplashConfig(normalize({}))
  assert.ok(Array.isArray(cfg.statusLines) && cfg.statusLines.length === 4)
  assert.equal(cfg.logoUrls.bsc, '/dsh-command/logo/bsc.svg')
  assert.equal(cfg.mode, 'session')
})

/* ── 路由与注入（假 ctx） ─────────────────────────────────────────────── */
const routes = []
const taps = []
const webServer = {
  register(route) { routes.push(route); return () => {} },
  tapIndex(fn) { taps.push(fn); return () => {} }
}
const ctx = {
  get(key) {
    if (key === 'webServer') return webServer
    if (key === 'connection') return { requestRejection: () => false }
    return undefined
  },
  effect(fn) { return fn() },
  logger: { warn() {} }
}

apply(ctx)

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: null,
    body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || null; return this },
    end(chunk) { if (chunk !== undefined) this.body += String(chunk); return this }
  }
  return res
}
function fakeReq(method = 'GET', url = '/', body) {
  const listeners = {}
  return {
    method,
    url,
    on(event, cb) { (listeners[event] = listeners[event] || []).push(cb); return this },
    destroy() {},
    emit(event, arg) { for (const cb of listeners[event] || []) cb(arg) },
    body
  }
}
async function callRoute(suffix, method = 'GET', payload) {
  const route = routes.find((r) => r.kind === 'exact' ? r.path === '/dsh-command' + suffix : r.path === '/dsh-command' + suffix)
  assert.ok(route, '路由没注册: ' + suffix)
  const res = fakeRes()
  const req = fakeReq(method, '/dsh-command' + suffix)
  const promise = route.handler(req, res)
  if (payload !== undefined) {
    req.emit('data', Buffer.from(JSON.stringify(payload)))
    req.emit('end')
  } else {
    req.emit('end')
  }
  await promise
  return res
}

ok('注册了 theme.css / splash.css / splash.js / config / health / logo', () => {
  const paths = routes.map((r) => r.path).sort()
  for (const p of ['/dsh-command/theme.css', '/dsh-command/splash.css', '/dsh-command/splash.js', '/dsh-command/config', '/dsh-command/health', '/dsh-command/logo']) {
    assert.ok(paths.includes(p), '缺路由 ' + p)
  }
})

const themeRes = await callRoute('/theme.css')
ok('theme.css 能返回（不是空、带 no-store）', () => {
  assert.equal(themeRes.statusCode, 200)
  assert.ok(themeRes.body.length > 2000, 'theme.css 太小: ' + themeRes.body.length)
  assert.match(String(themeRes.headers['Cache-Control']), /no-store/)
})

const splashCssRes = await callRoute('/splash.css')
ok('splash.css = splash.css + logos.css 合并下发', () => {
  assert.ok(splashCssRes.body.includes('.dsc-splash'), '缺 splash 规则')
  assert.ok(splashCssRes.body.includes('.dsc-bsc'), '缺 logo 规则（合并失败）')
})

const splashJsRes = await callRoute('/splash.js')
ok('splash.js 能返回且不含 </script> 字面量', () => {
  assert.equal(splashJsRes.statusCode, 200)
  assert.ok(splashJsRes.body.includes('__DSC_SPLASH__'))
  assert.ok(!splashJsRes.body.includes('</script>'))
})

const healthRes = await callRoute('/health')
ok('health 报告各静态文件是否就位', () => {
  const data = JSON.parse(healthRes.body)
  assert.equal(data.ok, true)
  assert.equal(data.files.theme, true)
  assert.equal(data.files.splashJs, true)
})

const logoRes = await (async () => {
  const route = routes.find((r) => r.kind === 'prefix' && r.path === '/dsh-command/logo')
  const res = fakeRes()
  await route.handler(fakeReq('GET', '/dsh-command/logo/bsc.svg'), res)
  return res
})()
ok('logo/bsc.svg 返回内联 SVG（currentColor 化）', () => {
  assert.equal(logoRes.statusCode, 200)
  assert.ok(logoRes.body.includes('<svg'))
  assert.ok(logoRes.body.includes('currentColor') || logoRes.body.includes('var(--dsc-logo'))
  assert.ok(!logoRes.body.includes('#344394'), '原蓝色没被替换掉')
})

const badLogo = fakeRes()
await routes.find((r) => r.path === '/dsh-command/logo').handler(fakeReq('GET', '/dsh-command/logo/../../etc/passwd'), badLogo)
ok('logo 路由拒绝非白名单名字', () => {
  assert.equal(badLogo.statusCode, 404)
})

const cfgGet = await callRoute('/config')
ok('GET /config 返回 config + defaults + presets + file', () => {
  const data = JSON.parse(cfgGet.body)
  assert.equal(data.ok, true)
  assert.ok(data.config && data.defaults && data.presets)
  assert.ok(data.presets['command-red'])
  assert.ok(String(data.file).includes('dsh-supreme-command.json'))
})

const cfgPost = await callRoute('/config', 'POST', { patch: { preset: 'cyan', speed: 1.5 } })
ok('POST /config 持久化并回显', () => {
  const data = JSON.parse(cfgPost.body)
  assert.equal(data.config.preset, 'cyan')
  assert.equal(data.config.speed, 1.5)
  const onDisk = JSON.parse(fs.readFileSync(path.join(TMP, 'dsh-supreme-command.json'), 'utf8'))
  assert.equal(onDisk.preset, 'cyan')
})

const cfgReset = await callRoute('/config', 'POST', { action: 'reset' })
ok('POST {action:"reset"} 恢复默认', () => {
  const data = JSON.parse(cfgReset.body)
  assert.equal(data.config.preset, DEFAULTS.preset)
  assert.equal(data.config.speed, DEFAULTS.speed)
})

/* 超大 body 必须明确 413，而不是把 {} 当成功 patch 静默吞掉 */
const tooBig = await (async () => {
  const route = routes.find((r) => r.path === '/dsh-command/config')
  const res = fakeRes()
  const req = fakeReq('POST', '/dsh-command/config')
  const promise = route.handler(req, res)
  req.emit('data', Buffer.alloc(200 * 1024, 97))
  return promise.then(() => res)
})()
ok('POST 超过 128KB 返回 413（不再静默 200）', () => {
  assert.equal(tooBig.statusCode, 413)
  assert.match(tooBig.body, /too large/)
})

/* ── 预览页路由 ───────────────────────────────────────────────────────── */
const previewRes = await callRoute('/preview')
ok('GET /preview 返回可独立播放的预览页', () => {
  assert.equal(previewRes.statusCode, 200)
  assert.match(String(previewRes.headers['Content-Type']), /text\/html/)
  assert.ok(previewRes.body.includes('__DSC_SPLASH_CONFIG__'))
  assert.ok(previewRes.body.includes('/dsh-command/splash.js'))
  assert.ok(previewRes.body.includes('"preview": true') || previewRes.body.includes('"preview":true'), '预览页必须带 preview:true（否则会写"已播过"标记）')
  assert.ok(previewRes.body.includes('"mode": "always"') || previewRes.body.includes('"mode":"always"'))
})

/* ── index.html 注入 ──────────────────────────────────────────────────── */
const SAMPLE = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>DSH</title></head><body><div id="root"></div></body></html>'
const injected = taps[0](SAMPLE)
ok('注入 theme.css 链接 + 变量 + critical CSS', () => {
  assert.ok(injected.includes('/dsh-command/theme.css'))
  assert.ok(injected.includes('id="dsh-command-vars"'))
  assert.ok(injected.includes('--dsc-accent'))
  assert.ok(injected.includes('id="dsh-command-critical"'))
})

ok('注入启动屏根节点、配置与运行时', () => {
  assert.ok(injected.includes('id="dsh-command-splash"'))
  assert.ok(injected.includes('window.__DSC_SPLASH_CONFIG__='))
  assert.ok(injected.includes('defer src="/dsh-command/splash.js"'))
  assert.ok(injected.includes('window.__DSC_CFG__='))
})

ok('注入里带装饰层容器与 550C 节点（开着才注入）', () => {
  assert.ok(injected.includes('id="dsh-command-deco"'))
  assert.ok(injected.includes('dsc-deco__wm'))
  assert.ok(injected.includes('dsc-deco__mark'))
  assert.ok(injected.includes('dsc-deco__model'))
})

ok('bootstrap 里含 session/daily 跳过与 10s 兜底', () => {
  assert.ok(injected.includes("sessionStorage.getItem('dsc:splash')"))
  assert.ok(injected.includes("localStorage.getItem('dsc:day')"))
  assert.ok(injected.includes('__DSC_RUNNING__'))
})

ok('跳过分支也布防兜底（DOMContentLoaded 再摘 + 二次 watchdog）', () => {
  /* 审计 P0：head 阶段 body 还没解析，skip 时直接摘 root 是空操作 → 必须等 DOM 就绪再摘 */
  assert.ok(injected.includes("addEventListener('DOMContentLoaded',clearRoot"), '缺 DOMContentLoaded 兜底摘除')
  assert.ok(injected.includes('setTimeout(clearRoot,10000)'), '缺 skip 路径的 10s 兜底')
})

ok('检测到其它启动屏插件时让位（不叠播）', () => {
  for (const marker of ['__DSH_STARTUP__', '__DSH_STARTUP_BOOT__', '__DSH_STARTUP_LOADED__']) {
    assert.ok(injected.includes(marker), '缺共存检测标记 ' + marker)
  }
})

ok('statusLines 数组形态也受 2000 字符上限约束', () => {
  const big = normalize({ statusLines: new Array(5000).fill('0123456789') })
  assert.ok(String(big.statusLines).length <= 2000, '数组绕过了上限: ' + String(big.statusLines).length)
})

/* ── 语音字段 ─────────────────────────────────────────────────────────── */
ok('语音默认值对齐参考插件（rate .88 / pitch .85 / lead 240）', () => {
  assert.equal(DEFAULTS.voice, true)
  assert.equal(DEFAULTS.voiceRate, 0.88)
  assert.equal(DEFAULTS.voicePitch, 0.85)
  assert.equal(DEFAULTS.voiceLead, 240)
  assert.equal(DEFAULTS.voiceSource, 'tts')
  assert.equal(DEFAULTS.voiceLang, 'zh')
})

ok('语音字段越界被夹取、非法枚举回默认', () => {
  assert.equal(normalize({ voiceRate: 9 }).voiceRate, 2)
  assert.equal(normalize({ voicePitch: -1 }).voicePitch, 0)
  assert.equal(normalize({ voiceLead: 99999 }).voiceLead, 1200)
  assert.equal(normalize({ voiceLang: 'klingon' }).voiceLang, 'zh')
  assert.equal(normalize({ voiceSource: 'asset' }).voiceSource, 'asset')
})

ok('语音台词进入注入配置（含中英两组与素材路由）', () => {
  const cfg = buildSplashConfig(normalize({ voiceLine2: '操作员 {operator} 验证通过。' }))
  assert.ok(Array.isArray(cfg.voiceLines.zh) && cfg.voiceLines.zh.length === 3)
  assert.ok(Array.isArray(cfg.voiceLines.en) && cfg.voiceLines.en.length === 3)
  assert.equal(cfg.voiceUrls.grant, '/dsh-command/voice/grant.mp3')
  assert.equal(cfg.voiceRate, 0.88)
})

/* ── 工牌字段 ─────────────────────────────────────────────────────────── */
ok('工牌默认就是图恒宇那张（正反面要素齐全、没有照片字段）', () => {
  assert.equal(DEFAULTS.badge, true)
  assert.equal(DEFAULTS.badgeName, '图恒宇')
  assert.ok(String(DEFAULTS.badgeId).indexOf('IQC') >= 0, '正面编号应带 IQC')
  assert.equal(DEFAULTS.badgeOrg, '北京航天中心')
  assert.equal(DEFAULTS.badgeLabShort, 'IQC')
  assert.ok(DEFAULTS.badgeLab.length > 0 && DEFAULTS.badgeRole.length > 0)
  assert.ok(!('badgePhoto' in DEFAULTS), '电影里的胸卡没有照片，配置也不该有照片字段')
})

ok('工牌配置进注入包（正反面字段齐全）', () => {
  const cfg = buildSplashConfig(normalize({ badgeName: '刘培强', badgeId: 'IDL.IQC-007' }))
  assert.equal(cfg.badge, true)
  assert.equal(cfg.badgeName, '刘培强')
  assert.equal(cfg.badgeId, 'IDL.IQC-007')
  assert.equal(cfg.badgeOrgEn, 'BEIJING SPACE CENTER')
  assert.equal(cfg.badgeLabShort, 'IQC')
  assert.equal(cfg.badgeNo, '222179')
})

/* 550C 主机型号标识：logo 白名单 + 两个开关 */
const selfBootRoute = routes.find((r) => r.kind === 'exact' && r.path === '/dsh-command/selfboot.js')
ok('selfboot 路由已注册（桌面端没有 Host 注入时靠它）', () => {
  assert.ok(selfBootRoute, '缺 selfboot 路由')
})
const selfBootRes = fakeRes()
await selfBootRoute.handler(fakeReq('GET', '/dsh-command/selfboot.js'), selfBootRes)
ok('selfboot 脚本包含主题/装饰/启动屏三件事', () => {
  const body = String(selfBootRes.body)
  assert.match(body, /theme\.css/)
  assert.match(body, /splash\.css/)
  assert.match(body, /splash\.js/)
  assert.match(body, /dsh-command-deco/)
  assert.match(body, /dsc:splash/)
})

const varsRoute = routes.find((r) => r.kind === 'exact' && r.path === '/dsh-command/vars.css')
ok('vars.css 路由下发主题变量', () => {
  assert.ok(varsRoute)
})

const modelRes = await (async () => {
  const route = routes.find((r) => r.kind === 'prefix' && r.path === '/dsh-command/logo')
  const res = fakeRes()
  await route.handler(fakeReq('GET', '/dsh-command/logo/550c.svg'), res)
  return res
})()
ok('logo/550c.svg 能下发（主机型号标识）', () => {
  assert.equal(modelRes.statusCode, 200)
  assert.ok(modelRes.body.includes('<svg'))
  assert.ok(modelRes.body.includes('currentColor'))
})

const modelMask = await (async () => {
  const route = routes.find((r) => r.kind === 'prefix' && r.path === '/dsh-command/logo')
  const res = fakeRes()
  await route.handler(fakeReq('GET', '/dsh-command/logo/550c.svg?mask=1'), res)
  return res
})()
ok('?mask=1 把 logo 刷成全白（给 CSS mask 用）', () => {
  assert.ok(modelMask.body.includes('#fff'))
  assert.ok(!modelMask.body.includes('currentColor'))
})

ok('主题装饰两个开关进默认值', () => {
  assert.equal(DEFAULTS.watermark, true)
  assert.equal(DEFAULTS.cornerLogo, true)
  assert.equal(DEFAULTS.modelLogo, true)
  assert.equal(DEFAULTS.showModel, true)
})

const voiceRoute = routes.find((r) => r.kind === 'prefix' && r.path === '/dsh-command/voice')
ok('voice 路由只认三个槽位', () => {
  assert.ok(voiceRoute, '缺 voice 路由')
})
const voiceMiss = fakeRes()
await voiceRoute.handler(fakeReq('GET', '/dsh-command/voice/../../etc/passwd'), voiceMiss)
ok('voice 路由拒绝未知槽位/穿越路径', () => {
  assert.equal(voiceMiss.statusCode, 404)
})

const healthVoice = await callRoute('/health')
ok('health 报告语音素材与 TTS 能力', () => {
  const data = JSON.parse(healthVoice.body)
  assert.ok(data.voiceAssets && typeof data.voiceAssets.title === 'boolean')
  assert.equal(data.tts, 'browser')
})

/* 展示字体路由：白名单 .ttf，不允许穿越 */
const fontRoute = routes.find((r) => r.kind === 'prefix' && r.path === '/dsh-command/font')
ok('font 路由已注册（优设标题黑）', () => {
  assert.ok(fontRoute, '缺 font 路由')
})
const fontOk = fakeRes()
await fontRoute.handler(fakeReq('GET', '/dsh-command/font/YouSheBiaoTiHei.ttf'), fontOk)
ok('font 路由能下发字体文件', () => {
  assert.equal(fontOk.statusCode, 200)
  assert.match(String(fontOk.headers['Content-Type']), /font\/ttf/)
  assert.ok(fontOk.body.length > 100000, '字体体积不对: ' + fontOk.body.length)
})
const fontBad = fakeRes()
await fontRoute.handler(fakeReq('GET', '/dsh-command/font/../../etc/passwd'), fontBad)
ok('font 路由拒绝穿越与非法扩展名', () => {
  assert.equal(fontBad.statusCode, 404)
})

const healthFont = await callRoute('/health')
ok('health 报告展示字体是否就位', () => {
  const data = JSON.parse(healthFont.body)
  assert.equal(data.fontAsset, true)
})

ok('注入是幂等的（重复 tap 不会插两遍）', () => {
  const again = taps[0](injected)
  assert.equal(again, injected)
})

ok('注入内容不会破坏 script 标签（块配对、JSON 已转义）', () => {
  const head = injected.slice(0, injected.indexOf('</head>'))
  const opens = (head.match(/<script(?:\s[^>]*)?>/g) || []).length
  const closes = (head.match(/<\/script>/g) || []).length
  assert.equal(opens, closes, 'script 开闭标签数量不一致')
  assert.ok(opens >= 1)
  /* 配置 JSON 里的 < 必须被转义，否则含 "</script" 的文案会截断脚本 */
  assert.ok(!/<\/script>[\s\S]*<\/script>/.test(head.slice(0, head.lastIndexOf('</script>'))))
})

/* ── 没有 webServer 时不能炸 ──────────────────────────────────────────── */
ok('无 webServer 的载体下 apply 不抛错', () => {
  assert.doesNotThrow(() => apply({
    get: () => undefined,
    effect: (fn) => fn(),
    logger: { warn() {} }
  }))
})

fs.rmSync(TMP, { recursive: true, force: true })
console.log('\nHost 自检：' + passed + ' 项通过' + (process.exitCode ? '（有失败）' : ''))
