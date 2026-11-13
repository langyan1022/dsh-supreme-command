/* 设置面板（浏览器半侧）自检：协议形状、契约字段、不硬编码色板、不注入全局样式。
 *
 * 用法: node test/smoke-client.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(ROOT, 'lib/client.js'), 'utf8')
const hostSrc = fs.readFileSync(path.join(ROOT, 'lib/index.js'), 'utf8')

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

/* ── 加载协议 ─────────────────────────────────────────────────────────── */
ok('走 window.__ModuleLoader__.load 且 id 与包名一致', () => {
  assert.ok(src.includes('__ModuleLoader__.load'))
  const m = src.match(/id:\s*'([^']+)'/)
  assert.ok(m, '找不到 id')
  assert.equal(m[1], 'dsh-supreme-command')
})

ok('只注入 slots，并注册 settings.section', () => {
  assert.match(src, /inject\s*=\s*\[\s*'slots'\s*\]/)
  assert.ok(src.includes("ctx.slots.inject('settings.section'"))
  assert.ok(src.includes("name: 'settings.section'"))
})

ok('设置分区 id / 排序 / 名称符合契约', () => {
  assert.ok(src.includes("id: 'supreme-command'"))
  assert.match(src, /order:\s*27/)
  assert.ok(src.includes('流浪地球主题'))
})

ok('导出 apply / inject', () => {
  assert.match(src, /exports\.apply\s*=/)
  assert.match(src, /exports\.inject\s*=/)
})

ok('不写 ESM import/export 语句（浏览器侧只允许 require）', () => {
  assert.ok(!/^\s*import\s/m.test(src), '出现 import')
  assert.ok(!/^\s*export\s/m.test(src), '出现 export')
})

ok('不碰 document.documentElement 之外的全局（不 setAttribute 到 html）', () => {
  /* 面板只负责配置，不负责应用主题：主题属性归 Host / bootstrap */
  assert.ok(!/documentElement\.setAttribute\(\s*'data-dsh-command'/.test(src), '面板不应自己改主题开关属性')
})

/* ── 数据接口 ─────────────────────────────────────────────────────────── */
ok('只碰已注册路由：config / preview / selfboot.js（桌面端自举）', () => {
  const paths = [...new Set([...src.matchAll(/'(\/dsh-[^']+)'/g)].map((m) => m[1]))]
  const allowed = ['/dsh-command/config', '/dsh-command/preview', '/dsh-command/selfboot.js']
  for (const p of paths) {
    assert.ok(allowed.includes(p), '面板访问了未定义的接口: ' + p)
  }
  assert.ok(paths.includes('/dsh-command/config'), '缺配置接口')
  assert.ok(paths.includes('/dsh-command/preview'), '缺独立预览入口')
  assert.ok(paths.includes('/dsh-command/selfboot.js'), '缺桌面端自举脚本')
})

ok('桌面端自举：没有 Host 注入时才挂 selfboot.js，不会重复注入', () => {
  assert.ok(/function hostInjected\(\)/.test(src), '缺 Host 注入判定')
  assert.ok(/window\.__DSC_CFG__/.test(src), '判据要包含 Host 注入标记')
  assert.ok(/_SELFBOOT\b|SELFBOOT_FLAG/.test(src), '缺自举去重标记')
  assert.ok(/script\[src\$="\/dsh-command\/selfboot\.js"\]/.test(src), '缺重复挂载保护')
})

ok('保存走 { patch: {...} }，重置走 { action: "reset" }', () => {
  assert.ok(/patch:/.test(src))
  assert.ok(/action:\s*'reset'/.test(src))
})

ok('预设色板来自接口响应，不硬编码在面板里', () => {
  const palettes = ['#ff3b30', '#ff8a5c', '#ffb020', '#22d3ee', '#35e07a', '#a855f7']
  for (const hex of palettes) {
    assert.ok(!src.toLowerCase().includes(hex), '面板里硬编码了预设色 ' + hex)
  }
  assert.ok(/presets/.test(src), '没有读取 presets')
})

/* ── 覆盖全部配置字段 ─────────────────────────────────────────────────── */
const hostKeys = (() => {
  const block = hostSrc.slice(hostSrc.indexOf('const DEFAULTS = {'), hostSrc.indexOf('const BOOL_KEYS'))
  return [...block.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1])
})()
ok('Host DEFAULTS 里每个字段面板都能编辑', () => {
  const missing = hostKeys.filter((key) => !new RegExp('\\b' + key + '\\b').test(src))
  assert.deepEqual(missing, [], '面板缺字段: ' + missing.join(','))
})

/* ── 样式隔离与可读性 ─────────────────────────────────────────────────── */
ok('样式类名全部 __ss_ 前缀', () => {
  const classes = [...new Set([...src.matchAll(/className:\s*'([^']+)'/g)].flatMap((m) => m[1].split(/\s+/)))]
  const bad = classes.filter((c) => c && !c.startsWith('__ss'))
  assert.deepEqual(bad, [], '未隔离类名: ' + bad.slice(0, 5).join(','))
})

ok('样式只注入一次（带 data-plugin-css 标记）', () => {
  assert.ok(src.includes('data-plugin-css'))
  assert.ok(src.includes('querySelector'))
})

ok('配色使用 DSH 的 --dsw-alias-* 变量', () => {
  const vars = [...new Set([...src.matchAll(/--dsw-alias-[a-z0-9-]+/g)].map((m) => m[0]))]
  assert.ok(vars.length >= 5, '用的 dsw 变量太少: ' + vars.join(','))
})

ok('有降级界面（错误可见，不白屏）', () => {
  assert.ok(/error|失败|重试/.test(src))
})

ok('不含 </script> 字面量', () => assert.ok(!src.includes('</script>')))

ok('体积合理（< 160KB）', () => {
  const size = Buffer.byteLength(src)
  assert.ok(size < 160 * 1024, 'client.js 太大: ' + size)
})

console.log('\n设置面板自检：' + passed + ' 项通过' + (process.exitCode ? '（有失败）' : ''))
