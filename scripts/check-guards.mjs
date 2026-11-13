/* 「绝不黑屏 / 不叠播 / 减少动态也有徽标」三条护栏的端到端验证（需要 8791 预览服务器）。
 *
 * 场景：
 *   A. 跳过路径（splashEnabled=false）+ splash.js 根本不存在 → 必须自动摘掉黑层
 *   B. 检测到另一个启动屏插件（window.__DSH_STARTUP__）→ 必须让位、不锁屏、不播
 *   C. prefers-reduced-motion: reduce → 必须直接到终态，且 BSC 徽标也在（不是空壳）
 *
 * 用法: node scripts/check-guards.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.DSC_PREVIEW || 'http://127.0.0.1:8791'
const CHROME = process.env.DSC_CHROME || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p))

if (!CHROME) { console.error('no chrome'); process.exit(2) }

/* 从真实注入结果里切一份"跳过路径"的页面：去掉 splash.js，配置改成 splashEnabled=false */
const injected = fs.readFileSync(path.join(ROOT, '_tool/injected-index.html'), 'utf8')
const skipHtml = injected
  .replace('"splashEnabled": true', '"splashEnabled": false')
  .replace('"splashEnabled":true', '"splashEnabled":false')
  .replace(/<script defer src="\/dsh-command\/splash\.js"><\/script>/, '')
fs.writeFileSync(path.join(ROOT, '_tool/guard-skip.html'), skipHtml, 'utf8')

/* 让位测试页：手动放一个"另一个启动屏插件"的痕迹，再加载我们的运行时 */
const yieldHtml = `<!doctype html><html lang="zh" data-dsh-command="on"><head><meta charset="utf-8">
<link rel="stylesheet" href="/lib/splash.css">
<link rel="stylesheet" href="/lib/logos/logos.css">
<style id="dsc-lock-css">html.dsc-lock,html.dsc-lock body{overflow:hidden!important}</style>
</head><body>
<div id="dsh-command-splash" class="dsc-splash dsc-splash--boot"></div>
<div id="dsh-startup-root" class="dsu-root"></div>
<script>window.__DSH_STARTUP__={enabled:true,mode:'session'};window.__DSH_STARTUP_BOOT__='index';</script>
<script>document.documentElement.classList.add('dsc-lock')</script>
<script>window.__DSC_SPLASH_CONFIG__=${JSON.stringify({
  enabled: true, mode: 'always', speed: 1, allowSkip: true,
  titleZh: '智能量子计算机', titleZh2: '重点实验室', subtitleEn: 'X', org: 'X', orgZh: 'X',
  clearLevel: 'X', operator: 'X', operatorId: '1', footer: 'X', statusLines: ['a'],
  showUeg: true, showBsc: true, logoColor: 'accent', sound: false, soundVolume: 0,
  version: 'test', logoUrls: {}
})};</script>
<script src="/lib/splash.js"></script>
</body></html>`
fs.writeFileSync(path.join(ROOT, '_tool/guard-yield.html'), yieldHtml, 'utf8')

function dump(url, budget, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--window-size=1440,900',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=' + budget, '--dump-dom', ...extraArgs, url
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let buf = ''
    child.stdout.on('data', (d) => { buf += d.toString('utf8') })
    child.on('exit', () => resolve(buf))
    setTimeout(() => { try { child.kill() } catch { /* noop */ } }, 30000)
  })
}

let failed = 0
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail && !cond ? '  →  ' + detail : ''))
  if (!cond) failed++
}

/* A. 跳过路径 + splash.js 缺失 */
const a = await dump(BASE + '/_tool/guard-skip.html', 2500)
check('A1 跳过路径：黑层被摘掉', !/id="dsh-command-splash"/.test(a), 'root 仍在（会永久黑屏）')
check('A2 跳过路径：滚动锁被解除', !/class="[^"]*dsc-lock/.test(a), 'dsc-lock 未清除')

/* B. 检测到其它启动屏插件 → 让位 */
const b = await dump(BASE + '/_tool/guard-yield.html', 2500)
check('B1 让位：我们不插自己的遮罩', !/id="dsh-command-splash"/.test(b), '我们的 root 还在（会与对方叠播）')
check('B2 让位：不留滚动锁', !/class="[^"]*dsc-lock/.test(b), 'dsc-lock 未清除')
check('B3 让位：对方的根节点原样保留', /id="dsh-startup-root"/.test(b), '不该动别人的节点')

/* C. 减少动态：直接终态 + 徽标仍在 */
/* reduced 模式 1.6s 就收尾了，所以要在收尾前抓（1200ms）：既能看到终态类，也能看到徽标 */
const c = await dump(BASE + '/preview/index.html?chrome=0', 1200, ['--force-prefers-reduced-motion'])
check('C1 减少动态：终态类已挂上（is-rails/is-title/is-grant）', /is-rails/.test(c) && /is-title/.test(c) && /is-grant/.test(c), '终态类缺失')
check('C2 减少动态：BSC 徽标已注入（不是空壳）', /class="dsc-bsc/.test(c), '徽标没注入（竞态又回来了）')
check('C3 减少动态：UEG 印章/水印已注入', (c.match(/dsc-ueg/g) || []).length >= 2, 'UEG 出现次数不足')

console.log(failed ? '\n护栏自检失败 ' + failed + ' 项' : '\n护栏自检通过（8 项）')
process.exit(failed ? 1 : 0)
