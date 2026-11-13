/* 极简静态服务器：给预览页 / 截图用（ES module 需要 http，file:// 不行）。
 * 用法: node scripts/serve.mjs [port] [root]
 * 默认: 8791 + 仓库根目录
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.argv[2] || 8791)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8'
}


/* ── Host 路由仿真 ─────────────────────────────────────────────────────────
 * 预览服务器没有 Host 半侧，但 /dsh-command/* 是主题与启动屏的命门：
 * 用插件导出的同一批函数把路由补上，本地就能验证
 *   · Web 模式：Host 注入（buildPreviewHtml / tapIndex 等价物）
 *   · 桌面端：客户端自举（buildSelfBootJs → /dsh-command/selfboot.js）
 * 真机上这些路由由 Host 半侧提供，仿真只用于开发与截图。
 */
const host = await import('../lib/index.js')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CFG_FILE = path.join(DSH_HOME, 'dsh-supreme-command.json')

function hostConfig() {
  let disk = {}
  try { disk = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')) } catch (err) { disk = {} }
  return host.normalize({ ...host.DEFAULTS, ...disk })
}

const logoCache = {}
async function logoSvg(name) {
  if (!logoCache[name]) logoCache[name] = await import('../lib/logos/' + (name === '550c' ? '550c' : name) + '.js')
  const m = logoCache[name]
  return name === 'ueg' ? m.UEG_SVG : (name === 'bsc' ? m.BSC_SVG : m.MODEL_SVG)
}

async function serveHostRoutes(pathname, query, res) {
  const cfg = hostConfig()
  const send = (type, body) => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    res.end(body)
  }
  const sub = pathname.slice('/dsh-command/'.length)
  if (sub === 'health') { send('application/json', JSON.stringify({ ok: true, version: 'dev', presets: Object.keys(host.PRESETS), tts: 'browser' })); return true }
  if (sub === 'theme.css') { send('text/css; charset=utf-8', fs.readFileSync(path.join(ROOT, 'lib/theme.css'), 'utf8')); return true }
  if (sub === 'splash.css') {
    send('text/css; charset=utf-8',
      fs.readFileSync(path.join(ROOT, 'lib/splash.css'), 'utf8') + '\n' +
      fs.readFileSync(path.join(ROOT, 'lib/logos/logos.css'), 'utf8'))
    return true
  }
  if (sub === 'splash.js') { send('application/javascript; charset=utf-8', fs.readFileSync(path.join(ROOT, 'lib/splash.js'), 'utf8')); return true }
  if (sub === 'selfboot.js') { send('application/javascript; charset=utf-8', host.buildSelfBootJs(cfg)); return true }
  if (sub === 'vars.css') { send('text/css; charset=utf-8', host.buildVarsCss(cfg)); return true }
  if (sub === 'preview') { send('text/html; charset=utf-8', host.buildPreviewHtml(cfg)); return true }
  if (sub === 'config') {
    send('application/json; charset=utf-8', JSON.stringify({
      ok: true, version: 'dev', config: cfg, defaults: host.DEFAULTS, presets: host.PRESETS, file: CFG_FILE
    }))
    return true
  }
  const logo = sub.match(/^logo\/([a-z0-9]+)\.svg$/)
  if (logo) {
    const svg = await logoSvg(logo[1])
    const masked = /(^|&)mask=1(?:&|$)/.test(query || '')
      ? svg.replace(/var\(--dsc-logo[^)]*\)/g, '#fff').replace(/currentColor/g, '#fff')
      : svg
    send('image/svg+xml; charset=utf-8', masked)
    return true
  }
  const voice = sub.match(/^voice\/([a-z]+)\.mp3$/)
  if (voice) {
    const f = path.join(ROOT, 'lib/assets/voice/' + voice[1] + '.mp3')
    if (fs.existsSync(f)) { send('audio/mpeg', fs.readFileSync(f)); return true }
    res.writeHead(404); res.end(); return true
  }
  return false
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || '/'
  const queryRaw = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : ''
  const url = decodeURIComponent(rawUrl.split('?')[0])
  if (url.startsWith('/dsh-command/')) {
    let handled = false
    try {
      handled = await serveHostRoutes(url, queryRaw, res)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('host emulation error: ' + String((err && err.stack) || err))
      return
    }
    if (handled) return
  }
  let rel = url === '/' ? '/preview/index.html' : url
  const file = path.join(ROOT, rel)
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found: ' + rel); return }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': String(st.size)
    })
    fs.createReadStream(file).pipe(res)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('serving ' + ROOT + ' at http://127.0.0.1:' + PORT + '/')
})
