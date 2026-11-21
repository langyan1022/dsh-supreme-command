/* 时间线功能自检：用无头浏览器在若干虚拟时间点抓 DOM 快照，
 * 检查启动屏的编排是否按预期推进（不依赖动画时钟，只验状态机）。
 *
 * 用法: node scripts/check-timeline.mjs [baseUrl]
 * 退出码 0 = 全部断言通过。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:8791/preview/index.html?chrome=0&film=0'
const CHROME = process.env.DSC_CHROME || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('no chrome'); process.exit(2) }

function dump(budget) {
  return new Promise((resolve) => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--window-size=1440,900',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=' + budget, '--dump-dom', BASE
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let buf = ''
    child.stdout.on('data', (d) => { buf += d.toString('utf8') })
    child.on('exit', () => resolve(buf))
  })
}

const checks = [
  { at: 1200, name: '开机：机壳/屏已点亮', test: (h) => /dsc-splash[^"]*is-power/.test(h) },
  { at: 1700, name: 'MOSS 式开屏出现（is-open）', test: (h) => /is-open\b/.test(h) },
  { at: 1700, name: '开屏 550W 标识已内联（dsc-550w-svg）', test: (h) => /dsc-550w-svg/.test(h) },
  { at: 2300, name: '未到时间不提前出标题', test: (h) => !/is-title/.test(h) },
  { at: 3300, name: '导轨点亮（is-rails）', test: (h) => /is-rails/.test(h) },
  { at: 3900, name: '标题砸下（is-title）', test: (h) => /is-title/.test(h) },
  { at: 4500, name: '副标出现（is-sub）', test: (h) => /is-sub/.test(h) },
  { at: 4800, name: '进度条与日志启动（is-meter）', test: (h) => /is-meter/.test(h) },
  { at: 5200, name: '日志至少 1 行', test: (h) => (h.match(/dsc-log__line/g) || []).length >= 1 },
  { at: 6200, name: '日志至少 2 行', test: (h) => (h.match(/dsc-log__line/g) || []).length >= 2 },
  { at: 3300, name: '右栏数据流有内容', test: (h) => (h.match(/dsc-data__line/g) || []).length >= 8 },
  { at: 5800, name: '进度百分比在上涨（非 000%）', test: (h) => { const m = h.match(/data-dsc="pct">(\d+)%/); return m && Number(m[1]) > 0 } },
  { at: 7800, name: '进度条点亮多数分段', test: (h) => (h.match(/dsc-meter__seg is-on/g) || []).length >= 12 },
  { at: 6400, name: '工牌上台（is-badge）', test: (h) => /is-badge/.test(h) },
  { at: 8400, name: '工牌核验通过（is-verified）', test: (h) => /is-verified/.test(h) },
  { at: 8800, name: '日志已打出全部 4 行', test: (h) => (h.match(/dsc-log__line/g) || []).length >= 4 },
  { at: 11000, name: '工牌退场后授权画面还在（is-grant）', test: (h) => /is-grant/.test(h) },
  { at: 12300, name: '授权画面仍在停留（未提前收尾）', test: (h) => /id="dsh-command-splash"/.test(h) },
  { at: 17800, name: '收尾：遮罩已被移除', test: (h) => !/id="dsh-command-splash"/.test(h) }
]

let failed = 0
for (const c of checks) {
  const html = await dump(c.at)
  const ok = (() => { try { return !!c.test(html) } catch (e) { return false } })()
  if (!ok) failed++
  console.log((ok ? 'PASS ' : 'FAIL ') + 't=' + String(c.at).padStart(4) + 'ms  ' + c.name)
}
console.log(failed === 0 ? '\n时间线自检通过' : '\n时间线自检失败 ' + failed + ' 项')
process.exit(failed === 0 ? 0 : 1)
