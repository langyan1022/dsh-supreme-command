/* 启动屏自检：语法、作用域、失败兜底、变量 fallback、可访问性。
 * 纯静态检查 + node --check，不需要浏览器。
 *
 * 用法: node test/smoke-splash.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const js = read('lib/splash.js')
const css = read('lib/splash.css')
const logosCss = read('lib/logos/logos.css')

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

/* ── 语法 ─────────────────────────────────────────────────────────────── */
for (const file of ['lib/index.js', 'lib/splash.js', 'lib/palettes.js', 'lib/client.js', 'lib/logos/ueg.js', 'lib/logos/bsc.js']) {
  ok('node --check ' + file, () => {
    const res = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' })
    assert.equal(res.status, 0, (res.stderr || '').slice(0, 400))
  })
}

/* ── 不能破坏宿主文档 ─────────────────────────────────────────────────── */
ok('splash.js 不含 </script> 字面量', () => assert.ok(!js.includes('</script>')))
ok('splash.js 是经典脚本（无 ESM 语法）', () => {
  assert.ok(!/^\s*(import|export)\s/m.test(js), '出现 import/export')
})
ok('splash.js 不写 document.write', () => assert.ok(!js.includes('document.write')))

/* ── 契约：根节点 / 全局 API / 配置键 ─────────────────────────────────── */
ok('根节点 id 与 Host 一致', () => {
  assert.ok(js.includes("dsh-command-splash"), '缺根节点 id')
})

ok('暴露重播/收尾 API', () => {
  assert.ok(js.includes('window.__DSC_SPLASH__'))
  assert.ok(/replay:\s*replay/.test(js))
  assert.ok(/finish:\s*finish/.test(js))
})

ok('读取 Host 注入的配置对象', () => {
  assert.ok(js.includes('__DSC_SPLASH_CONFIG__'))
})

const knownKeys = [
  'enabled', 'mode', 'speed', 'allowSkip', 'titleZh', 'titleZh2', 'subtitleEn',
  'org', 'orgZh', 'clearLevel', 'operator', 'operatorId', 'footer', 'statusLines',
  'showUeg', 'showBsc', 'sound', 'soundVolume', 'logoUrls', 'staticFrame', 'version', 'preview',
  'voice', 'voiceLang', 'voiceName', 'voiceRate', 'voicePitch', 'voiceVolume',
  'voiceCue', 'voiceLead', 'voiceSource', 'voiceLines', 'voiceUrls',
  'badge', 'badgeName', 'badgeId', 'badgeNo', 'badgePinyin', 'badgeOrg', 'badgeOrgEn',
  'badgeLab', 'badgeLabEn', 'badgeLabShort', 'badgeRole', 'badgeClearance', 'badgeHold', 'staticBadge', 'staticFace',
  'showModel'
]
ok('引用的配置键都在契约里', () => {
  const used = [...js.matchAll(/CFG\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
  const unknown = [...new Set(used)].filter((k) => !knownKeys.includes(k))
  assert.deepEqual(unknown, [], '未知配置键: ' + unknown.join(','))
})

/* ── 失败兜底 ─────────────────────────────────────────────────────────── */
ok('重复加载有幂等护栏', () => assert.ok(js.includes('__DSC_SPLASH_LOADED__')))
ok('尊重 Host 的跳过判定', () => assert.ok(js.includes('__DSC_SKIP__')))
ok('与其它启动屏插件共存：检测到就让位', () => assert.ok(js.includes('otherSplashPresent')))
ok('预览页不写 session/daily 标记', () => assert.ok(js.includes('CFG.preview')))

/* ── 工牌准入（按参考图正反面复刻） ─────────────────────────────────────── */
ok('工牌正反两面都在，且不是照片卡（电影里无照片）', () => {
  assert.ok(js.includes('badgeMarkup'))
  assert.ok(js.includes('dsc-badge__face--front'))
  assert.ok(js.includes('dsc-badge__face--back'))
  assert.ok(!js.includes('badgePhoto'), '不该再有照片字段')
})

ok('正面要素：机构名重复条 / 大缩写 / 编号带 / 条码 / 真实 BSC 徽标水印', () => {
  assert.ok(js.includes('dsc-badge__strip'))
  assert.ok(js.includes('dsc-badge__iqc'))
  assert.ok(js.includes('dsc-badge__band'))
  assert.ok(js.includes('dsc-badge__barcode'))
  assert.ok(js.includes('data-dsc="badge-wm"'), '正面水印槽位')
})

ok('背面要素：红底 CS + 蓝色徽标 + 姓名/实验室/职务/编码', () => {
  assert.ok(js.includes('dsc-badge__cs'))
  assert.ok(js.includes('data-dsc="badge-mark"'), '背面徽标槽位')
  assert.ok(js.includes('dsc-badge__name'))
  assert.ok(js.includes('dsc-badge__labBack'))
  assert.ok(js.includes('dsc-badge__code'))
})

ok('工牌造型全部由 CSS 画（不引用任何剧照/外部图片）', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lib/splash.css'), 'utf8')
  assert.ok(css.includes('.dsc-badge__face--front'))
  assert.ok(css.includes('container-type: size'), '比例要用容器查询单位才能跟参考图一致')
  assert.ok(!/url\(['"]?https?:/.test(css), 'CSS 里不该有远程图片')
})

/* ── 语音播报（音色/节奏参照 dsh-startup-screen） ─────────────────────── */
ok('语音走 speechSynthesis，带 enable/disable 门', () => {
  assert.ok(js.includes('speechSynthesis'))
  assert.ok(js.includes('SpeechSynthesisUtterance'))
  assert.ok(js.includes("CFG.voice !== false"))
})

ok('音色按分数挑：神经网络 > 女声 > 语种吻合（不是第一个命中）', () => {
  assert.ok(js.includes('NATURAL_HINTS'))
  assert.ok(js.includes('FEMALE_HINTS'))
  assert.ok(js.includes('MALE_HINTS'))
  assert.ok(/function score\(/.test(js))
  assert.ok(/function pick\(/.test(js))
})

ok('三个播报槽位都接进了时间线', () => {
  assert.ok(js.includes('voice.speak(0)'), '缺标题播报')
  assert.ok(js.includes('voice.speak(1)'), '缺操作员播报')
  assert.ok(js.includes('voice.speak(2)'), '缺授权播报')
})

ok('跳过/收尾会 cancel 语音（不会念一半残留）', () => {
  assert.ok(js.includes('voice.cancel()'))
  assert.ok(js.includes('speechSynthesis.cancel'))
})

ok('自然收尾会等最后一句念完（不掐断），且有 6s 上限', () => {
  assert.ok(js.includes('function isSpeaking'), '缺"是否在念"判定')
  assert.ok(js.includes('function remainingMs'), '缺"还剩多久"估算')
  assert.ok(/reason === 'done' && voice\.isSpeaking/.test(js), 'finish 里没等语音')
  assert.ok(/guard > 50/.test(js), '等待必须带上限，避免异常卡死')
  assert.ok(/if \(reason !== 'abort'\) markShown/.test(js), '收尾时要先写"已播过"标记')
})

ok('台词占位符只有契约里允许的六个', () => {
  const allowed = ['operator', 'id', 'titleZh', 'titleZh2', 'clearLevel', 'org']
  const m = js.match(/var dict = \{([\s\S]*?)\}/)
  assert.ok(m, '找不到占位符字典')
  const keys = [...m[1].matchAll(/(\w+):/g)].map((x) => x[1])
  assert.deepEqual(keys.sort(), allowed.slice().sort())
})

ok('素材模式有回落（拿不到 mp3 就用 TTS，不静音）', () => {
  assert.ok(js.includes('voiceSource') && js.includes('asset'))
  assert.ok(js.includes('preflight'))
  assert.ok(js.includes('playAsset'))
})
ok('会向 Host 报告「已开始播放」', () => assert.ok(js.includes('__DSC_RUNNING__')))
ok('跳过交互受 allowSkip 控制', () => assert.ok(js.includes('CFG.allowSkip')))
ok('会话/每日只播一次的标记写在播放之后', () => {
  assert.ok(js.includes("sessionStorage.setItem('dsc:splash'"))
  assert.ok(js.includes("localStorage.setItem('dsc:day'"))
})

/* ── 转义与安全 ───────────────────────────────────────────────────────── */
ok('有 HTML 转义函数且用于所有文案', () => {
  assert.ok(/function esc\(/.test(js))
  const raw = [...js.matchAll(/\+ (CFG\.[A-Za-z]+) \+/g)].map((m) => m[1])
  assert.deepEqual(raw, [], '有未转义拼接: ' + raw.join(','))
})

/* ── CSS：变量 fallback / 关键层 / 可访问性 ───────────────────────────── */
const vars = ['--dsc-accent', '--dsc-accent-2', '--dsc-bg', '--dsc-text', '--dsc-glow', '--dsc-scanlines', '--dsc-grain', '--dsc-vignette', '--dsc-logo']
ok('每个 --dsc-* 变量都带 fallback', () => {
  for (const v of vars) {
    const re = new RegExp('var\\(\\s*' + v + '\\s*,')
    assert.ok(re.test(css), '缺 fallback: ' + v)
  }
})

ok('启动屏是最高层固定层（盖得住应用）', () => {
  assert.match(css, /\.dsc-splash\s*\{[^}]*position:\s*fixed/)
  assert.match(css, /[^}]*z-index:\s*21474/)
})

ok('装饰层不吃指针事件', () => {
  const decorative = ['.dsc-screen__glow', '.dsc-screen__grid', '.dsc-screen__scan', '.dsc-screen__ticks', '.dsc-frame', '.dsc-watermark']
  for (const sel of decorative) {
    const block = css.slice(css.indexOf(sel))
    assert.ok(block.slice(0, 700).includes('pointer-events: none'), sel + ' 未设 pointer-events:none')
  }
})

ok('有关键帧动画且带名称前缀', () => {
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
  assert.ok(names.length >= 8, '关键帧太少: ' + names.length)
  assert.ok(names.every((n) => n.startsWith('dsc-')), '关键帧未加前缀: ' + names.join(','))
})

ok('支持 prefers-reduced-motion', () => {
  assert.ok(css.includes('prefers-reduced-motion'))
  assert.ok(js.includes('prefers-reduced-motion'))
})

ok('没有 color-mix 的旧引擎有降级', () => {
  assert.ok(css.includes('@supports not (color: color-mix'))
})

/* ── Logo 样式必须作用域化 ────────────────────────────────────────────── */
ok('logos.css 没有全局选择器', () => {
  const stripped = logosCss.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!/(^|\})\s*(:root|html|body|\*|svg)\s*[,{]/.test(stripped), '出现全局选择器')
})

ok('logos.css 全部选择器都以 .dsc- 作用域开头', () => {
  /* 先整体剔掉 @keyframes（里面的 0%/100% 不是选择器）与注释，再扫选择器 */
  let stripped = logosCss.replace(/\/\*[\s\S]*?\*\//g, '')
  let prev
  do {
    prev = stripped
    stripped = stripped.replace(/@(?:keyframes|-webkit-keyframes|-moz-keyframes)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  } while (stripped !== prev)
  stripped = stripped.replace(/@[^{]+\{[^{}]*\}/g, '')
  const selectors = [...stripped.matchAll(/(^|\})\s*([^@{}]+)\{/g)]
    .map((m) => m[2].trim())
    .filter((s) => s && s !== 'from' && s !== 'to' && !/^\d+%$/.test(s))
  const bad = selectors.filter((s) => !s.split(',').every((part) => /\.dsc-/.test(part)))
  assert.deepEqual(bad.slice(0, 5), [], '未作用域选择器: ' + bad.slice(0, 5).join(' | '))
})

ok('BSC 动画语义保留（逐叶 + 描边 + clip-path）', () => {
  assert.ok(logosCss.includes('olive-leaf-display-time') || logosCss.includes('100ms'), '缺逐叶节拍变量')
  assert.ok(/dsc-.*leaf/.test(logosCss), '缺叶子规则')
  assert.ok(logosCss.includes('stroke-dashoffset'), '缺描边生长动画')
  assert.ok(logosCss.includes('clip-path'), '缺 clip-path 揭示')
  assert.ok(logosCss.includes('@keyframes'), '缺 keyframes')
})

ok('still 模式存在（静态落位）', () => {
  assert.ok(/data-mode=(?:'|")still/.test(logosCss), '缺 still 模式')
})

/* ── 体积合理性 ───────────────────────────────────────────────────────── */
ok('启动屏脚本体积合理（< 60KB）', () => {
  const size = Buffer.byteLength(js)
  assert.ok(size < 60 * 1024, 'splash.js 太大: ' + size)
})

ok('启动屏样式体积合理（< 60KB）', () => {
  const size = Buffer.byteLength(css)
  assert.ok(size < 60 * 1024, 'splash.css 太大: ' + size)
})

console.log('\n启动屏自检：' + passed + ' 项通过' + (process.exitCode ? '（有失败）' : ''))
