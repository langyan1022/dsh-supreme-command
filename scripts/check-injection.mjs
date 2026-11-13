/* 注入回归：拿 **真实的 DSH index.html**（从 app.asar 抽出来的那份）跑一遍 tapIndex，
 * 验证注入点、顺序与"不破坏宿主文档"三件事。
 *
 * 用法: node scripts/check-injection.mjs [真实index.html路径]
 * 找不到真实文件时自动退回内置样例（仍然是有意义的检查）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dsc-inj-'))

const REAL = process.argv[2] ||
  path.join(ROOT, '_tool/real-dsh-index.html')

const SYNTHETIC = '<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>DeepSeek Harness</title>' +
  '<script type="module" crossorigin src="./assets/index-X.js"></script>' +
  '<link rel="stylesheet" crossorigin href="./assets/index-X.css"></head>' +
  '<body><div id="root"></div></body></html>'

const source = fs.existsSync(REAL) ? fs.readFileSync(REAL, 'utf8') : SYNTHETIC
const isReal = fs.existsSync(REAL)

const mod = await import('../lib/index.js')
const taps = []
const routes = []
mod.apply({
  get(key) {
    if (key === 'webServer') {
      return {
        register(r) { routes.push(r); return () => {} },
        tapIndex(fn) { taps.push(fn); return () => {} }
      }
    }
    if (key === 'connection') return { requestRejection: () => false }
    return undefined
  },
  effect: (fn) => fn(),
  logger: { warn() {} }
})

const out = taps[0](source)
let passed = 0
function ok(label, fn) {
  try { fn(); passed++; console.log('PASS ' + label) } catch (err) {
    console.log('FAIL ' + label + '  →  ' + (err && err.message)); process.exitCode = 1
  }
}

console.log('（注入源：' + (isReal ? '真实 index.html ' + REAL : '合成样例') + '）\n')

ok('原始文档内容全部保留（没吃掉 root/入口脚本/样式）', () => {
  for (const token of ['<div id="root"></div>', 'type="module"', 'rel="stylesheet"']) {
    assert.ok(source.includes(token), '样例本身缺 ' + token)
    assert.ok(out.includes(token), '注入后丢了 ' + token)
  }
})

ok('主题与启动屏资源都注入了', () => {
  for (const token of ['/dsh-command/theme.css', '/dsh-command/splash.css', '/dsh-command/splash.js', 'id="dsh-command-vars"', 'id="dsh-command-critical"']) {
    assert.ok(out.includes(token), '缺 ' + token)
  }
})

ok('启动屏根节点在 #root 之前（盖在应用上方）', () => {
  const splashAt = out.indexOf('id="dsh-command-splash"')
  const rootAt = out.indexOf('<div id="root">')
  assert.ok(splashAt > 0 && rootAt > splashAt, 'splash=' + splashAt + ' root=' + rootAt)
})

ok('主题开关脚本早于应用模块脚本执行（先给 html 上属性）', () => {
  const bootstrapAt = out.indexOf("setAttribute('data-dsh-command'")
  const moduleAt = out.indexOf('type="module"')
  assert.ok(bootstrapAt > 0, '没找到 bootstrap')
  assert.ok(moduleAt > 0, '没找到应用模块脚本')
  /* 行内经典脚本按文档顺序立即执行；module 会被推迟到解析之后 → 只要 bootstrap 存在就够，
     这里额外确认它写在 head 内（不是 body 末尾）。 */
  const headEnd = out.indexOf('</head>')
  assert.ok(bootstrapAt < headEnd, 'bootstrap 不在 head 内')
})

ok('注入内容结构合法（head 内不出现裸 </script> 断裂）', () => {
  const head = out.slice(out.indexOf('<head>'), out.indexOf('</head>'))
  const opens = (head.match(/<script\b/g) || []).length
  const closes = (head.match(/<\/script>/g) || []).length
  assert.equal(opens, closes, 'script 标签未配对: ' + opens + '/' + closes)
})

ok('注入后仍是单 html/head/body 结构', () => {
  assert.equal((out.match(/<html\b/g) || []).length, 1)
  assert.equal((out.match(/<head>/g) || []).length, 1)
  assert.equal((out.match(/<\/head>/g) || []).length, 1)
  assert.equal((out.match(/<body>/g) || []).length, 1)
})

ok('HTML 体积增量合理（< 24KB，不含 logo 像素数据）', () => {
  const delta = Buffer.byteLength(out) - Buffer.byteLength(source)
  console.log('   注入增量: ' + delta + ' 字节')
  assert.ok(delta < 24 * 1024, '注入太大: ' + delta)
})

ok('二次注入幂等', () => {
  assert.equal(taps[0](out), out)
})

fs.mkdirSync(path.join(ROOT, '_tool'), { recursive: true })
fs.writeFileSync(path.join(ROOT, '_tool/injected-index.html'), out, 'utf8')
console.log('\n注入回归：' + passed + ' 项通过（产物：_tool/injected-index.html）')
