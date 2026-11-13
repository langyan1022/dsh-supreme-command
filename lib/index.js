/* ============================================================================
 * dsh-supreme-command — Host 半侧
 * ----------------------------------------------------------------------------
 * 一个插件同时供两件事：
 *   1) 主题：把 DSH 的 --dsw-* 语义 token 换成「流浪地球」HUD 色板（lib/theme.css），
 *      由 html[data-dsh-command="on"] 开关，属性在首帧前就挂上，不会闪一下原生配色。
 *   2) 启动屏：在黑幕上播一段控制台开机序列（lib/splash.js + lib/splash.css），
 *      带两个 SVG 徽标（UEG 静态 / BSC 橄榄枝动画），颜色跟随主题。
 *
 * 职责：
 *   - index.html 注入：critical CSS、主题属性、变量、样式/脚本引用、启动屏根节点
 *   - 路由：/dsh-command/{theme.css,splash.css,splash.js,config,logo/*,health}
 *   - 配置持久化：$DSH_HOME/dsh-supreme-command.json（设置面板经 /config 读写）
 *
 * 设计取舍（与 dsh-startup-screen 一致，已在其上验证）：
 *   - 配置不走 settings 命名空间，自带 JSON + 自带设置面板，不受 dsh-settings 版本漂移影响。
 *   - 静态文件按 mtime 缓存，改完刷新页面即生效。
 *   - 没有可注册路由的载体时 Host 半侧不炸（只记一条 warn）：这种载体上启动屏与主题都不生效，
 *     设置面板仍可用。启动屏只能靠 tapIndex 注入，所以它**依赖 HTTP 载体**（web profile / 桌面端内建 webServer）。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRESETS, CUSTOM_ID, resolvePalette } from './palettes.js'
import { renderSelfBoot } from './selfboot.js'
import { CENTER_JS } from './center.js'
import { scheduleDesktopMaximize } from './window.js'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-supreme-command.json')

const NS = 'dsh-supreme-command'
const ROUTE = '/dsh-command'
const ROOT_ID = 'dsh-command-splash'
const HTML_ATTR = 'data-dsh-command'
/** 语音素材槽位白名单（lib/assets/voice/<槽位>.mp3） */
const VOICE_SLOTS = ['title', 'operator', 'grant']

/** 插件版本：读自己的 package.json，读不到退回 0.0.0（设置页不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    return String(pkg.version || '').trim() || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/* ── 配置 ──────────────────────────────────────────────────────────────── */

const DEFAULT_STATUS_LINES = [
  '建立安全信道 … OK',
  '校验操作员生物签名 … OK',
  '解密绝密指令包 … OK',
  '载入 HARNESS 运行时 … OK'
].join('\n')

/** 默认配置：字段必须与 docs/CONFIG.md §2 完全一致。 */
const DEFAULTS = {
  /* 开关与模式 */
  enabled: true,
  splashEnabled: true,
  mode: 'session',              // always | session | daily
  speed: 1,
  allowSkip: true,
  /* 配色 */
  preset: 'command-red',
  accent: '#ff3b30',
  accent2: '#ff8a5c',
  bgBase: '#080305',
  textPrimary: '#f3e7e4',
  themeMode: 'force-dark',      // force-dark | auto
  /* 质感 */
  glow: 1,
  scanlines: 0.5,
  grain: 0.35,
  hudFrames: true,
  vignette: 0.6,
  /* 主题装饰（跟启动屏同一套语言：模糊大字水印 + 角落机构徽标） */
  watermark: true,
  cornerLogo: true,
  modelLogo: true,      // 主题左上角的 550C 主机型号标识
  showModel: true,      // 启动屏上的 550C 主机型号标识
  /* 启动屏文案 */
  titleZh: '智能量子计算机',
  titleZh2: '重点实验室',
  subtitleEn: 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER',
  org: 'DEEPSEEK HARNESS',
  orgZh: '深度求索',
  clearLevel: '绝密 / TOP SECRET',
  operator: '操作员',
  operatorId: '0000',
  footer: 'POWERED BY DEEPSEEK',
  statusLines: DEFAULT_STATUS_LINES,
  /* 语音播报（音色/节奏参照 dsh-startup-screen：慢速 + 低音调 + 女声优先） */
  voice: true,
  voiceLang: 'zh',              // zh | en | both
  voiceName: '',                // '' = 自动挑（神经网络女声优先）
  voiceRate: 0.88,              // 电影旁白档：比朗读慢
  voicePitch: 0.85,             // 压低音调，深沉的 AI 女声
  voiceVolume: 0.9,
  voiceCue: true,               // 念之前先来一声轻提示
  voiceLead: 240,               // 提示音之后留白再开口（ms）
  voiceSource: 'tts',           // tts | asset（asset：优先用 lib/assets/voice/*.mp3）
  voiceLine1: '智能量子计算机重点实验室，绝密。',
  voiceLine2: '操作员 {operator}，北京航天中心，权限验证通过。',
  voiceLine3: '授权通过，正在进入系统。',
  voiceLine1En: 'Key Laboratory of Intelligent Quantum Computer. Top secret.',
  voiceLine2En: 'Operator {operator}. Beijing Space Center. Clearance verified.',
  voiceLine3En: 'Authorization granted. Entering system.',
  /* 工牌准入（《流浪地球2》北京航天中心 IQC 实验室胸卡：正反两面、无照片） */
  badge: true,
  badgeName: '图恒宇',
  badgeId: 'IDL.IQC-001',     // 正面色带上的编号
  badgeNo: '222179',          // 背面第二行数字
  badgePinyin: 'TU HENGYU',   // 背面英文名
  badgeOrg: '北京航天中心',
  badgeOrgEn: 'BEIJING SPACE CENTER',
  badgeLab: '智能量子计算机重点实验室',
  badgeLabEn: 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER',
  badgeLabShort: 'IQC',
  badgeRole: '研究员',
  badgeClearance: 'L1',
  /* 工牌核验通过后停留多久再退场（毫秒）；调大就是"多看一会儿" */
  badgeHold: 2400,
  /* 桌面端启动时把主窗口最大化（不改 DSH 本体，只发一次窗口消息） */
  autoFullscreen: true,
  /* 素材与声音 */
  showUeg: true,
  showBsc: true,
  logoColor: 'accent',          // accent | accent2 | text | custom
  logoCustom: '#ff3b30',
  sound: true,
  soundVolume: 0.4
}

const BOOL_KEYS = ['enabled', 'splashEnabled', 'allowSkip', 'hudFrames', 'watermark', 'cornerLogo', 'modelLogo', 'showModel', 'autoFullscreen', 'badge', 'showUeg', 'showBsc', 'sound', 'voice', 'voiceCue']
const COLOR_KEYS = ['accent', 'accent2', 'bgBase', 'textPrimary', 'logoCustom']
const TEXT_KEYS = [
  'titleZh', 'titleZh2', 'subtitleEn', 'org', 'orgZh',
  'clearLevel', 'operator', 'operatorId', 'footer',
  'voiceName',
  'voiceLine1', 'voiceLine2', 'voiceLine3',
  'voiceLine1En', 'voiceLine2En', 'voiceLine3En',
  'badgeName', 'badgeId', 'badgeNo', 'badgePinyin', 'badgeOrg', 'badgeOrgEn',
  'badgeLab', 'badgeLabEn', 'badgeLabShort', 'badgeRole', 'badgeClearance'
]
const TEXTAREA_KEYS = ['statusLines']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  preset: Object.keys(PRESETS).concat([CUSTOM_ID]),
  themeMode: ['force-dark', 'auto'],
  logoColor: ['accent', 'accent2', 'text', 'custom'],
  voiceLang: ['zh', 'en', 'both'],
  voiceSource: ['tts', 'asset']
}
const RANGES = {
  speed: [0.5, 2],
  glow: [0, 2],
  scanlines: [0, 1],
  grain: [0, 1],
  vignette: [0, 1],
  soundVolume: [0, 1],
  voiceRate: [0.5, 2],
  voicePitch: [0, 2],
  voiceVolume: [0, 1],
  voiceLead: [0, 1200],
  badgeHold: [0, 8000]
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/


function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  const provided = new Set(
    Object.keys(src).filter((k) => src[k] !== undefined && src[k] !== null)
  )
  for (const key of Object.keys(DEFAULTS)) {
    if (!provided.has(key)) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (RANGES[key]) {
      const [lo, hi] = RANGES[key]
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      /* 空字符串是合法值：表示"跟预设走" */
      out[key] = s === '' ? '' : (HEX_RE.test(s) ? s : DEFAULTS[key])
    } else if (TEXTAREA_KEYS.includes(key)) {
      const joined = Array.isArray(value) ? value.join('\n') : String(value)
      /* 数组形态也要吃同一个上限，否则 5000 行能绕过去 */
      out[key] = joined.length > 2000 ? joined.slice(0, 2000) : joined
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  /* 切预设：只给了 preset、没同时给颜色时，颜色跟随预设。
     否则「点色卡」会变成「只换个名字、界面还是旧色」。 */
  if (provided.has('preset') && PRESETS[out.preset]) {
    const p = PRESETS[out.preset]
    if (!provided.has('accent')) out.accent = p.accent
    if (!provided.has('accent2')) out.accent2 = p.accent2
    if (!provided.has('bgBase') || !String(out.bgBase).trim()) out.bgBase = p.bg
    if (!provided.has('textPrimary') || !String(out.textPrimary).trim()) out.textPrimary = p.text
  }
  /* 文案兜底：空串会让启动屏排版塌掉 */
  for (const key of TEXT_KEYS) {
    if (!String(out[key]).trim()) out[key] = DEFAULTS[key]
  }
  if (!String(out.statusLines).trim()) out.statusLines = DEFAULT_STATUS_LINES
  /* 用户自己动了 accent 却没换预设 → 落到 custom，避免"预设说是红但其实不是" */
  if (out.preset !== CUSTOM_ID && PRESETS[out.preset]) {
    const p = PRESETS[out.preset]
    const sameAccent = String(out.accent).toLowerCase() === p.accent.toLowerCase()
    const sameAccent2 = String(out.accent2).toLowerCase() === p.accent2.toLowerCase()
    if (!sameAccent || !sameAccent2) out.preset = CUSTOM_ID
  }
  return out
}

function readConfig() {
  try {
    return normalize(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/* ── 由配置算出注入用的变量与启动屏配置 ──────────────────────────────── */

/** Logo 颜色角色解析（面板只给角色，具体色值给 CSS 变量）。 */
function logoColorOf(cfg) {
  const pal = resolvePalette(cfg)
  if (cfg.logoColor === 'custom' && HEX_RE.test(String(cfg.logoCustom || ''))) {
    return cfg.logoCustom
  }
  if (cfg.logoColor === 'accent2') return pal.accent2
  if (cfg.logoColor === 'text') return pal.text
  return pal.accent
}

/** 注入 `:root{--dsc-*}` 的 CSS 文本。所有派生值交给 theme.css 用 color-mix 算。
 *
 *  themeMode:
 *    force-dark（默认）→ 不动 color-scheme，theme.css 里已经写死 dark：
 *      原生滚动条 / 表单控件 / 自动填充全部走暗色，HUD 里不露白件。
 *    auto → 这里追加一条 color-scheme:auto（同特异性、更晚声明，压过 theme.css），
 *      原生控件交还给宿主/系统偏好；色板本身仍然是 HUD 色（token 覆盖不区分明暗）。
 */
function buildVarsCss(cfg) {
  const pal = resolvePalette(cfg)
  const num = (v) => String(Math.round(Number(v) * 1000) / 1000)
  const vars = ':root{' +
    '--dsc-accent:' + pal.accent + ';' +
    '--dsc-accent-2:' + pal.accent2 + ';' +
    '--dsc-bg:' + pal.bg + ';' +
    '--dsc-text:' + pal.text + ';' +
    '--dsc-logo:' + logoColorOf(cfg) + ';' +
    '--dsc-glow:' + num(cfg.glow) + ';' +
    '--dsc-scanlines:' + num(cfg.scanlines) + ';' +
    '--dsc-grain:' + num(cfg.grain) + ';' +
    '--dsc-vignette:' + num(cfg.vignette) + ';' +
    '--dsc-hud-frames:' + (cfg.hudFrames ? '1' : '0') + ';' +
    '}'
  const scheme = cfg.themeMode === 'auto'
    ? 'html[' + HTML_ATTR + '="on"]{color-scheme:auto}'
    : ''
  return vars + scheme
}

/** 浏览器侧启动屏要用的配置（不含主题字段，减少注入体积）。 */
function buildSplashConfig(cfg, overrides) {
  const base = {
    enabled: cfg.splashEnabled,
    mode: cfg.mode,
    speed: cfg.speed,
    allowSkip: cfg.allowSkip,
    titleZh: cfg.titleZh,
    titleZh2: cfg.titleZh2,
    subtitleEn: cfg.subtitleEn,
    org: cfg.org,
    orgZh: cfg.orgZh,
    clearLevel: cfg.clearLevel,
    operator: cfg.operator,
    operatorId: cfg.operatorId,
    footer: cfg.footer,
    statusLines: String(cfg.statusLines).split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    /* 工牌准入（正面 IQC + 条码，背面姓名/编号/职务；无照片） */
    badge: cfg.badge,
    badgeName: cfg.badgeName,
    badgeId: cfg.badgeId,
    badgeNo: cfg.badgeNo,
    badgePinyin: cfg.badgePinyin,
    badgeOrg: cfg.badgeOrg,
    badgeOrgEn: cfg.badgeOrgEn,
    badgeLab: cfg.badgeLab,
    badgeLabEn: cfg.badgeLabEn,
    badgeLabShort: cfg.badgeLabShort,
    badgeRole: cfg.badgeRole,
    badgeClearance: cfg.badgeClearance,
    badgeHold: cfg.badgeHold,
    showUeg: cfg.showUeg,
    showBsc: cfg.showBsc,
    logoColor: logoColorOf(cfg),
    sound: cfg.sound,
    soundVolume: cfg.soundVolume,
    /* 语音：台词里的 {operator} 之类占位符在浏览器侧替换 */
    voice: cfg.voice,
    voiceLang: cfg.voiceLang,
    voiceName: cfg.voiceName,
    voiceRate: cfg.voiceRate,
    voicePitch: cfg.voicePitch,
    voiceVolume: cfg.voiceVolume,
    voiceCue: cfg.voiceCue,
    voiceLead: cfg.voiceLead,
    voiceSource: cfg.voiceSource,
    voiceLines: {
      zh: [cfg.voiceLine1, cfg.voiceLine2, cfg.voiceLine3],
      en: [cfg.voiceLine1En, cfg.voiceLine2En, cfg.voiceLine3En]
    },
    /* 素材兜底（voiceSource=asset 时优先；拿不到自动回落 TTS） */
    voiceUrls: {
      title: ROUTE + '/voice/title.mp3',
      operator: ROUTE + '/voice/operator.mp3',
      grant: ROUTE + '/voice/grant.mp3'
    },
    accent: resolvePalette(cfg).accent,
    accent2: resolvePalette(cfg).accent2,
    version: PLUGIN_VERSION,
    showModel: cfg.showModel,
    logoUrls: { ueg: ROUTE + '/logo/ueg.svg', bsc: ROUTE + '/logo/bsc.svg', model: ROUTE + '/logo/550c.svg' }
  }
  /* preview=true：预览页永不写 session/daily 标记，别让它把正式启动屏"播过" */
  return Object.assign(base, overrides || {})
}

/* ── 静态文件读取（按 mtime 缓存） ────────────────────────────────────── */

function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readers = {
  theme: makeReader('lib/theme.css'),
  splash: makeReader('lib/splash.css'),
  logosCss: makeReader('lib/logos/logos.css'),
  splashJs: makeReader('lib/splash.js')
}

/** 启动屏样式 = splash.css + logos.css（一个请求，两条文件各自还能单独开发）。 */
function readSplashCss() {
  return readers.splash() + '\n' + readers.logosCss()
}

/* Logo 标记是 ES module 导出的字符串：动态 import + 缓存，文件还没写时不炸插件。 */
const logoModules = new Map()
async function readLogo(name) {
  const key = name === '550c' ? '550c' : (name === 'ueg' ? 'ueg' : 'bsc')
  if (!logoModules.has(key)) {
    logoModules.set(key, (async () => {
      try {
        const url = new URL('./logos/' + (key === '550c' ? '550c' : key) + '.js', import.meta.url)
        const mod = await import(url.href)
        const svg = key === 'ueg' ? mod.UEG_SVG : (key === '550c' ? mod.MODEL_SVG : mod.BSC_SVG)
        return typeof svg === 'string' ? svg : ''
      } catch (err) {
        return ''
      }
    })())
  }
  return logoModules.get(key)
}

/* ── 首屏注入的 CSS / JS 字符串 ──────────────────────────────────────── */

/**
 * 关键 CSS：在应用脚本跑起来之前先把窗口压成黑，避免闪出白底界面。
 * 同时把主题开关属性需要的兜底写在这里（属性本身由 bootstrap 脚本挂）。
 */
const CRITICAL_CSS = [
  'html.dsc-lock,html.dsc-lock body{overflow:hidden!important}',
  'html.dsc-lock body{background-color:#000!important}',
  ':root{--dsh-boot-bg:#000}',
  'html[' + HTML_ATTR + '="on"]{color-scheme:dark}',
  '#' + ROOT_ID + '{position:fixed;inset:0;z-index:2147483000;background:#000}',
  /* 主题在样式表加载前的最底色：避免首帧露出宿主白底 */
  'html[' + HTML_ATTR + '="on"] body{background-color:var(--dsc-bg,#080305)}'
].join('')

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, '')
}

/** 其它「启动屏插件」的痕迹：检测到就让位，避免两段全屏动画叠播（z-index 同为 2147483000）。 */
const OTHER_SPLASH_MARKERS = ['__DSH_STARTUP__', '__DSH_STARTUP_BOOT__', '__DSH_STARTUP_LOADED__']

/**
 * 首屏引导脚本（经典同步脚本，在 head 里执行 → 早于应用 module 脚本）。
 *
 * 三件事：① 首帧前挂主题属性；② 决定这次要不要播启动屏；③ 无条件布防「绝不黑屏」兜底。
 *
 * 关键点（审计后改的）：
 *   - 跳过分支**也要**布防：此刻 <body> 还没解析，直接摘 #root 是空操作；等 DOMContentLoaded
 *     再摘一次，即使 splash.js 404/被 CSP 拦，也不会留下一个永久黑层。
 *   - 与其它启动屏插件共存：head 阶段对方脚本可能还没执行，所以这里先查一次，
 *     splash.js 在 DOMContentLoaded 时（所有 head 脚本都跑完了）再查一次。
 */
const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSC_CFG__||{};
var html=document.documentElement;
var ROOT='${ROOT_ID}';
if(c.enabled!==false)html.setAttribute('${HTML_ATTR}','on');
function clearRoot(){try{
  var r=document.getElementById(ROOT);if(r&&r.parentNode)r.parentNode.removeChild(r);
  html.classList.remove('dsc-lock');
  if(document.body)document.body.style.overflow='';
}catch(e){}}
function armWhenReady(){try{
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clearRoot,{once:true});
  else clearRoot();
}catch(e){}}
var skip=c.splashEnabled===false;
try{
  if(!skip&&c.mode==='session'&&sessionStorage.getItem('dsc:splash')==='1')skip=true;
  if(!skip&&c.mode==='daily'&&localStorage.getItem('dsc:day')===new Date().toISOString().slice(0,10))skip=true;
}catch(e){}
try{
  if(!skip){
    var others=${JSON.stringify(OTHER_SPLASH_MARKERS)};
    for(var i=0;i<others.length;i++){if(window[others[i]]){skip=true;break;}}
  }
}catch(e){}
if(skip){window.__DSC_SKIP__=true;armWhenReady();setTimeout(clearRoot,10000);return;}
html.classList.add('dsc-lock');
/* 兜底：splash.js 没跑起来（404/被拦/语法错）时 10 秒后无条件放行，绝不锁黑屏。
   判据是「时间线有没有开始跑」，不是类名——按类名判会在 run() 前就被摘掉，等于永不生效。 */
setTimeout(function(){try{
  if(window.__DSC_RUNNING__===true)return;
  clearRoot();
  window.__DSC_FAILED__=true;
}catch(e){}},10000);
}catch(e){}})()`

/* ── 独立预览页（设置面板「打开预览」指向它） ─────────────────────────── */

/**
 * 直接在浏览器里单独播一遍启动屏：用**和正式注入同一套**路由与配置，
 * 所以它同时是一个"真机集成页"。
 * 关键：`preview: true` 让运行时永不写 session/daily 标记 —— 预览不应把正式启动屏"播过"。
 */
/**
 * 桌面端自举：把注入做成一段脚本（见 lib/selfboot.js 的说明）。
 * Web 模式不受影响（页面已有 Host 注入，客户端会跳过）。
 */
function buildSelfBootJs(cfg) {
  const deco =
    cfg.enabled === false || (!cfg.watermark && !cfg.cornerLogo && !cfg.modelLogo)
      ? ''
      : '<div id="dsh-command-deco" class="dsc-deco" aria-hidden="true">' +
        (cfg.watermark ? '<div class="dsc-deco__wm"></div>' : '') +
        (cfg.cornerLogo ? '<div class="dsc-deco__mark"></div>' : '') +
        (cfg.modelLogo ? '<div class="dsc-deco__model"></div>' : '') +
        '</div>'
  return renderSelfBoot({
    enabled: cfg.enabled !== false,
    route: ROUTE,
    rootId: ROOT_ID,
    htmlAttr: HTML_ATTR,
    markersJson: JSON.stringify(OTHER_SPLASH_MARKERS),
    decoHtmlJson: JSON.stringify(deco),
    varsJson: JSON.stringify(buildVarsCss(cfg)),
    criticalJson: JSON.stringify(CRITICAL_CSS),
    gateJson: JSON.stringify({ splashEnabled: cfg.splashEnabled, mode: cfg.mode }),
    splashJson: safeJson(buildSplashConfig(cfg)),
    centerCode: CENTER_JS
  })
}

function buildPreviewHtml(cfg) {
  const splashCfg = buildSplashConfig(cfg, { mode: 'always', preview: true })
  return [
    '<!doctype html><html lang="zh-CN" ' + HTML_ATTR + '="on"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>启动屏预览 · ' + NS + '</title>',
    '<link rel="stylesheet" href="' + ROUTE + '/theme.css">',
    '<style id="dsh-command-vars">' + buildVarsCss(cfg) + '</style>',
    '<link rel="stylesheet" href="' + ROUTE + '/splash.css">',
    '<style>',
    'html,body{margin:0;height:100%;background:#050203;color:#e9dfdd;',
    'font-family:"PingFang SC","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif}',
    '.dsc-pv{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center}',
    '.dsc-pv h1{font:600 14px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.34em;margin:0;color:var(--dsc-accent,#ff3b30)}',
    '.dsc-pv p{margin:0;font-size:12.5px;letter-spacing:.08em;color:#a3918e}',
    '.dsc-pv button{font:inherit;font-size:12.5px;letter-spacing:.18em;padding:9px 22px;border-radius:6px;cursor:pointer;',
    'border:1px solid color-mix(in srgb,var(--dsc-accent,#ff3b30) 45%,transparent);',
    'background:color-mix(in srgb,var(--dsc-accent,#ff3b30) 12%,transparent);color:#fff}',
    '.dsc-pv button:hover{border-color:var(--dsc-accent,#ff3b30)}',
    '.dsc-pv__hint{font-size:11px;letter-spacing:.08em;color:#6f605e}',
    '</style></head><body>',
    '<div id="' + ROOT_ID + '" class="dsc-splash dsc-splash--boot" role="presentation" aria-hidden="true"></div>',
    '<div class="dsc-pv">',
    '<h1>PREVIEW · 启动屏</h1>',
    '<p>独立预览页，不会影响正式启动屏，也不写"已播过"标记。</p>',
    '<button id="dsc-pv-replay" type="button">重播</button>',
    '<div class="dsc-pv__hint">Esc / 点击画面可跳过 · 关掉本标签页即可</div>',
    '</div>',
    '<script>window.__DSC_SPLASH_CONFIG__=' + safeJson(splashCfg) + ';</script>',
    '<script src="' + ROUTE + '/splash.js"></script>',
    '<script>(function(){var b=document.getElementById("dsc-pv-replay");',
    'if(b)b.addEventListener("click",function(){try{window.__DSC_SPLASH__.replay()}catch(e){}});})()</script>',
    '</body></html>'
  ].join('')
}

/* ── 路由与注入 ──────────────────────────────────────────────────────── */

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /* 桌面端可能用 file:// + IPC 下发前端：没有 webServer 就不注册任何东西，
     plugin 仍算 APPLIED，只是启动屏/主题都不生效（本插件的注入只走 tapIndex）。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入：该载体上启动屏与主题不会生效，设置面板仍可用。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendText(res, type, text, code = 200) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(code, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function sendJson(res, code, payload) {
    sendText(res, 'application/json; charset=utf-8', JSON.stringify(payload), code)
  }

  function readBody(req, limit = 128 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      let overflow = false
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          /* 超限就明确收尾：调用方据此回 413，而不是把 {} 当成功 patch 静默吞掉 */
          overflow = true
          try { req.destroy() } catch (err) { /* noop */ }
          resolve({ text: '', overflow: true })
          return
        }
        chunks.push(c)
      })
      req.on('end', () => { if (!overflow) resolve({ text: Buffer.concat(chunks).toString('utf8'), overflow: false }) })
      req.on('error', () => { if (!overflow) resolve({ text: '', overflow: false }) })
    })
  }

  const css = 'text/css; charset=utf-8'
  const js = 'application/javascript; charset=utf-8'

  /* 客户端自举：桌面端（dsh-app://）没有 Host 注入时由它注入主题与启动屏 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/selfboot.js',
    handler: (req, res) => sendText(res, js, buildSelfBootJs(readConfig()))
  }))

  /* 主题变量表（自举与预览共用同一份计算） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/vars.css',
    handler: (req, res) => sendText(res, css, buildVarsCss(readConfig()))
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/theme.css',
    handler: (req, res) => sendText(res, css, readers.theme())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/splash.css',
    handler: (req, res) => sendText(res, css, readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/splash.js',
    handler: (req, res) => sendText(res, js, readers.splashJs())
  }))

  /* Logo：白名单两个名字，不带子路径，杜绝目录穿越。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE + '/logo',
    handler: async (req, res) => {
      const tail = String(req.url || '').split('?')[0].replace(/^.*\/logo\/?/, '')
      const name = tail.replace(/\.svg$/i, '')
      if (name !== 'ueg' && name !== 'bsc' && name !== '550c') { res.writeHead(404); res.end(); return }
      const svg = await readLogo(name)
      if (!svg) { res.writeHead(404); res.end(); return }
      /* ?mask=1 → 全白填充：CSS 用 mask-image 取 alpha，再用 background-color 上主题色 */
      const maskQuery = /[?&]mask=1\b/.test(String(req.url || ''))
      const body = maskQuery
        ? svg.replace(/var\(--dsc-logo[^)]*\)/g, '#fff').replace(/currentColor/g, '#fff')
        : svg
      sendText(res, 'image/svg+xml; charset=utf-8', body)
    }
  }))

  /* 语音素材（可选）：只认 title/operator/grant 三个槽位，文件名白名单 + 无子路径。
     用户可以把参考插件的真声素材（或自己的录音）放进 lib/assets/voice/<槽位>.mp3，
     把 voiceSource 设成 asset 就会优先用素材，拿不到自动回落 TTS。 */
  /* 展示字体（优设标题黑，免费商用）：启动屏标题与工牌大字用。
     白名单一个 .ttf，无子路径 —— 和 logo/voice 路由同一套防穿越写法。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE + '/font',
    handler: (req, res) => {
      const tail = String(req.url || '').split('?')[0].replace(/^.*\/font\/?/, '')
      if (!/^[A-Za-z0-9_.-]+\.ttf$/i.test(tail) || tail.includes('..')) { res.writeHead(404); res.end(); return }
      let bytes
      try { bytes = fs.readFileSync(path.join(PACKAGE_ROOT, 'lib', 'assets', 'fonts', tail)) } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE + '/voice',
    handler: (req, res) => {
      const tail = String(req.url || '').split('?')[0].replace(/^.*\/voice\/?/, '')
      const name = tail.replace(/\.mp3$/i, '')
      if (!VOICE_SLOTS.includes(name)) { res.writeHead(404); res.end(); return }
      const file = path.join(PACKAGE_ROOT, 'lib', 'assets', 'voice', name + '.mp3')
      let bytes
      try { bytes = fs.readFileSync(file) } catch (err) { res.writeHead(404); res.end(); return }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/preview',
    handler: (req, res) => sendText(res, 'text/html; charset=utf-8', buildPreviewHtml(readConfig()))
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/health',
    handler: (req, res) => {
      const voiceAssets = {}
      for (const slot of VOICE_SLOTS) {
        voiceAssets[slot] = fs.existsSync(path.join(PACKAGE_ROOT, 'lib', 'assets', 'voice', slot + '.mp3'))
      }
      sendJson(res, 200, {
        ok: true,
        version: PLUGIN_VERSION,
        config: CONFIG_FILE,
        files: {
          theme: !!readers.theme(),
          splash: !!readers.splash(),
          splashJs: !!readers.splashJs(),
          logosCss: !!readers.logosCss()
        },
        voiceAssets,
        fontAsset: fs.existsSync(path.join(PACKAGE_ROOT, 'lib', 'assets', 'fonts', 'YouSheBiaoTiHei.ttf')),
        tts: 'browser'
      })
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      const envelope = (cfg) => ({
        ok: true,
        version: PLUGIN_VERSION,
        config: cfg,
        defaults: DEFAULTS,
        presets: PRESETS,
        file: CONFIG_FILE
      })
      if (method === 'GET') {
        sendJson(res, 200, envelope(readConfig()))
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const { text, overflow } = await readBody(req)
      if (overflow) {
        sendJson(res, 413, { ok: false, error: 'payload too large' })
        return
      }
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          sendJson(res, 200, envelope(writeConfig(DEFAULTS)))
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const merged = { ...current, ...patch }
        /* 只改 preset 时颜色要跟着预设走。normalize 收到的是"当前+补丁"的合并对象，
           分不出哪些字段是用户显式给的新值，所以在这里把这条语义补上。 */
        if (patch && PRESETS[patch.preset]) {
          const p = PRESETS[patch.preset]
          if (!('accent' in patch)) merged.accent = p.accent
          if (!('accent2' in patch)) merged.accent2 = p.accent2
          if (!('bgBase' in patch)) merged.bgBase = p.bg
          if (!('textPrimary' in patch)) merged.textPrimary = p.text
        }
        sendJson(res, 200, envelope(writeConfig(merged)))
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (!html || html.includes(ROUTE + '/splash.js')) return html
    const cfg = readConfig()
    const vars = buildVarsCss(cfg)
    const splashCfg = buildSplashConfig(cfg)

    const head =
      '<link rel="stylesheet" href="' + ROUTE + '/theme.css">' +
      '<style id="dsh-command-vars">' + vars + '</style>' +
      '<style id="dsh-command-critical">' + CRITICAL_CSS + '</style>' +
      '<link rel="stylesheet" href="' + ROUTE + '/splash.css">' +
      '<script>' +
        'window.__DSC_CFG__=' + safeJson({ enabled: cfg.enabled, splashEnabled: cfg.splashEnabled, mode: cfg.mode }) + ';' +
        BOOTSTRAP_JS +
      '</script>' +
      '<script>' + CENTER_JS + '</script>'

    const deco = cfg.enabled === false || (!cfg.watermark && !cfg.cornerLogo && !cfg.modelLogo)
      ? ''
      : '<div id="dsh-command-deco" class="dsc-deco" aria-hidden="true">' +
          (cfg.watermark ? '<div class="dsc-deco__wm"></div>' : '') +
          (cfg.cornerLogo ? '<div class="dsc-deco__mark"></div>' : '') +
          (cfg.modelLogo ? '<div class="dsc-deco__model"></div>' : '') +
        '</div>'

    const body =
      deco +
      '<div id="' + ROOT_ID + '" class="dsc-splash dsc-splash--boot" role="presentation" aria-hidden="true"></div>' +
      '<script>window.__DSC_SPLASH_CONFIG__=' + safeJson(splashCfg) + ';</script>' +
      '<script defer src="' + ROUTE + '/splash.js"></script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

const name = NS
const inject = ['webServer', 'connection']

/* 导出形状对齐 DSH 内部插件：只给具名 name / inject / apply。
   刻意不导出 default：cordis-plugin-loader 的 unwrapExports 是 exports.default ?? exports，
   两边都写反而多一个"改一处忘一处"的坑。也不导出 Config（Cordis 约定它是 schemastery）。 */
export { apply, inject, name, DEFAULTS, normalize, PRESETS, buildVarsCss, buildSplashConfig, buildSelfBootJs, buildPreviewHtml }
