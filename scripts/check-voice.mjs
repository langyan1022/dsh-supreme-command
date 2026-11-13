/* 语音接线自检：用假 speechSynthesis 记录 splash.js 的播报请求，
 * 验证「三句台词 / 语速 0.88 / 音调 0.85 / 神经网络女声优先 / 双语模式 / 占位符替换」。
 *
 * 用法: node scripts/check-voice.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const BASE = process.env.DSC_PREVIEW || 'http://127.0.0.1:8791'
const CHROME = process.env.DSC_CHROME || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('no chrome'); process.exit(2) }

function dump(url, budget = 4200) {
  return new Promise((resolve) => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--window-size=1200,800',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=' + budget, '--dump-dom', url
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let buf = ''
    child.stdout.on('data', (d) => { buf += d.toString('utf8') })
    child.on('exit', () => resolve(buf))
    setTimeout(() => { try { child.kill() } catch { /* noop */ } }, 30000)
  })
}

function logOf(html) {
  /* 假引擎把每次播报写进 <title>（比等 setTimeout 写 DOM 稳） */
  const m = html.match(/<title>VOICE (\[[\s\S]*?\])<\/title>/m)
  return m ? JSON.parse(m[1]) : null
}

let failed = 0
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  →  ' + detail))
  if (!cond) failed++
}

/* ── 中文模式 ─────────────────────────────────────────────────────────── */
const zhLog = logOf(await dump(BASE + '/_tool/voice-probe.html?lang=zh'))
check('中文模式：播了 3 句（标题 / 操作员 / 授权）', Array.isArray(zhLog) && zhLog.length === 3, JSON.stringify(zhLog))
if (Array.isArray(zhLog)) {
  check('台词文本正确（含 {operator} 替换为 丁兵兵）',
    zhLog[0].text.includes('智能量子计算机') && zhLog[1].text.includes('丁兵兵') && zhLog[2].text.includes('授权通过'),
    JSON.stringify(zhLog.map((x) => x.text)))
  check('参数与参考插件一致：rate 0.88 / pitch 0.85 / volume 0.9',
    zhLog.every((x) => x.rate === 0.88 && x.pitch === 0.85 && x.volume === 0.9),
    JSON.stringify(zhLog[0]))
  check('音色按分数挑中"神经网络女声"（Xiaoxiao Online Natural），不是 Desktop 拼接音',
    zhLog.every((x) => x.voice === 'Microsoft Xiaoxiao Online (Natural)'),
    JSON.stringify(zhLog.map((x) => x.voice)))
  check('语言标签是 zh-CN', zhLog.every((x) => x.lang === 'zh-CN'), JSON.stringify(zhLog.map((x) => x.lang)))
}

/* ── 双语模式 ─────────────────────────────────────────────────────────── */
const bothLog = logOf(await dump(BASE + '/_tool/voice-probe.html?lang=both'))
check('双语模式：3 句 × 2 语言 = 6 次播报', Array.isArray(bothLog) && bothLog.length === 6, JSON.stringify(bothLog && bothLog.length))
if (Array.isArray(bothLog) && bothLog.length === 6) {
  check('双语顺序是先中后英，且语种标签正确',
    bothLog[0].lang === 'zh-CN' && bothLog[1].lang === 'en-US' && bothLog[2].lang === 'zh-CN' && bothLog[3].lang === 'en-US',
    JSON.stringify(bothLog.map((x) => x.lang)))
  check('英文台词走英文音色（Zira）',
    bothLog[1].voice === 'Microsoft Zira Desktop',
    String(bothLog[1].voice))
}

console.log(failed ? '\n语音自检失败 ' + failed + ' 项' : '\n语音自检通过（9 项）')
process.exit(failed ? 1 : 0)
