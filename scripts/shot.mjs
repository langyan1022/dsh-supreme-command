/* 无头 Chrome 截图工具（团队共用）。
 *
 * 单张：
 *   node scripts/shot.mjs <url|file> <out.png> [width] [height] [budgetMs] [scale]
 * 批量：
 *   node scripts/shot.mjs --batch manifest.json
 *   manifest: [{ "url": "http://127.0.0.1:8791/preview/index.html", "out": "shots/a.png",
 *                "w": 1440, "h": 900, "budget": 2400, "scale": 1 }]
 *
 * budget = --virtual-time-budget：虚拟时间预算，用来把 CSS 动画快进到某一帧
 * （0 = 用真实加载时间，抓第一帧/静态态）。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
]
const CHROME = process.env.DSC_CHROME || CHROME_CANDIDATES.find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('no chrome/edge found; set DSC_CHROME')
  process.exit(2)
}

import os from 'node:os'

function profileDir(job) {
  const dir = path.join(os.tmpdir(), 'dsc-shot-' + Math.random().toString(36).slice(2, 10))
  fs.mkdirSync(dir, { recursive: true })
  setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* noop */ } }, 20000)
  return dir
}

function runOne(job) {
  const out = path.resolve(ROOT, job.out)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  try { fs.unlinkSync(out) } catch { /* 旧图先删，免得误判成功 */ }
  const w = job.w || 1440
  const h = job.h || 900
  const budget = job.budget === undefined ? 1200 : job.budget
  const scale = job.scale || 1
  let url = job.url
  if (!/^[a-z]+:/i.test(url)) url = 'file:///' + path.resolve(ROOT, url).replace(/\\/g, '/')
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    /* 让「虚拟时间」也驱动合成器：CSS 动画/过渡才会跟着 --virtual-time-budget 走，
       否则只有 setTimeout 前进、动画时钟停在真实时间里（截出来全是动画第一帧）。 */
    '--run-all-compositor-stages-before-draw',
    '--disable-new-content-rendering-timeout',
    '--force-device-scale-factor=' + scale,
    '--window-size=' + w + ',' + h,
    '--screenshot=' + out,
    '--virtual-time-budget=' + budget,
    '--allow-file-access-from-files',
    /* 每次用独立 profile：共用默认 profile 会和正在运行的 Chrome 抢单例锁，表现就是挂住不出图 */
    '--user-data-dir=' + profileDir(job),
    url
  ]
  return new Promise((resolve) => {
    const child = spawn(CHROME, args, { stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* noop */ } }, 45000)
    child.on('exit', () => {
      clearTimeout(timer)
      const ok = fs.existsSync(out) && fs.statSync(out).size > 512
      resolve({ out, ok, size: ok ? fs.statSync(out).size : 0 })
    })
    child.on('error', (err) => { clearTimeout(timer); resolve({ out, ok: false, size: 0, err: String(err) }) })
  })
}

const argv = process.argv.slice(2)
let jobs
if (argv[0] === '--batch') {
  jobs = JSON.parse(fs.readFileSync(path.resolve(ROOT, argv[1]), 'utf8'))
} else {
  const [url, out, w, h, budget, scale] = argv
  if (!url || !out) {
    console.error('usage: node scripts/shot.mjs <url|file> <out.png> [w] [h] [budgetMs] [scale]')
    console.error('   or: node scripts/shot.mjs --batch manifest.json')
    process.exit(2)
  }
  jobs = [{ url, out, w: Number(w) || 1440, h: Number(h) || 900, budget: budget === undefined ? 1200 : Number(budget), scale: Number(scale) || 1 }]
}

for (const job of jobs) {
  const r = await runOne(job)
  console.log((r.ok ? 'OK   ' : 'FAIL ') + r.out + (r.ok ? '  ' + r.size + 'B' : '  ' + (r.err || '')))
}
