#!/usr/bin/env node
/* dsh-supreme-command 安装/卸载脚本
 *
 * 为什么是"目录联接 + profile patch 层"：见 docs/INSTALL.md。简单说 ——
 * DSH 的 Loader 只认 profile 能解析到的包；把插件接到 profile 的 node_modules
 * 并联接一个 insert 条目，就是本项目（以及 dsh-startup-screen）验证过的本地装法。
 *
 * 用法:
 *   node scripts/install.mjs                 # 安装到 desktop profile
 *   node scripts/install.mjs --profile web   # 装到 web profile
 *   node scripts/install.mjs --uninstall     # 卸载
 *   node scripts/install.mjs --dry-run       # 只打印将要做什么
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const PKG_NAME = PKG.name

const argv = process.argv.slice(2)
const flag = (name) => argv.includes('--' + name)
const value = (name, fallback) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const DRY = flag('dry-run')
const UNINSTALL = flag('uninstall')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

function pickProfile(explicit) {
  if (explicit) return explicit
  const dir = path.join(DSH_HOME, 'profiles')
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()) : []
  if (names.includes('desktop')) return 'desktop'
  if (names.includes('web')) return 'web'
  return names[0] || 'desktop'
}

const PROFILE = pickProfile(value('profile', ''))
const PROFILE_DIR = path.join(DSH_HOME, 'profiles', PROFILE)
const PATCH_FILE = path.join(PROFILE_DIR, 'cordis.patch.yml')
const LINK_PATH = path.join(PROFILE_DIR, 'node_modules', PKG_NAME)

const BEGIN = '# >>> ' + PKG_NAME + '（由 scripts/install.mjs 维护，删插件时整段删掉） >>>'
const END = '# <<< ' + PKG_NAME + ' <<<'
/** 卸载时用它把这几个被 --replace-startup 停用的 bundle 加回去。 */
function blockOf(replaced) {
  return [
    BEGIN,
    '# replaced-bundles: ' + (replaced && replaced.length ? replaced.join(', ') : ''),
    '- insert:',
    '    - id: supreme-command',
    '      name: ' + PKG_NAME,
    END
  ].join('\n')
}

function log(msg) { console.log((DRY ? '[dry-run] ' : '') + msg) }
function fail(msg) { console.error('✖ ' + msg); process.exit(1) }

if (!fs.existsSync(PROFILE_DIR)) {
  fail('找不到 profile 目录：' + PROFILE_DIR + '\n  用 --profile <名字> 指定（desktop / web）')
}

/* ── 与其它启动屏插件的互斥提醒 ─────────────────────────────────────────── */

/** 已知的其它"全屏启动动画"插件：两个一起启用会叠播（同为 z-index 2147483000）。 */
const OTHER_STARTUP_PKGS = ['dsh-startup-screen', 'dsh-startup-splash', 'dsh-splash-screen', 'dsh-boot-screen']

function detectOtherStartup() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, 'package.json'), 'utf8'))
    const deps = Object.keys(pkg.dependencies || {})
    const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
    return OTHER_STARTUP_PKGS.filter((n) => n !== PKG_NAME && (deps.includes(n) || bundles.includes(n)))
  } catch (err) {
    return []
  }
}

/* ── 卸载 ─────────────────────────────────────────────────────────────── */
if (UNINSTALL) {
  let changed = 0

  let replaced = []
  if (fs.existsSync(PATCH_FILE)) {
    const text = fs.readFileSync(PATCH_FILE, 'utf8')
    const mm = text.match(/# replaced-bundles: ?([^\n]*)/)
    if (mm && mm[1].trim()) replaced = mm[1].split(',').map((x) => x.trim()).filter(Boolean)
    if (text.includes(BEGIN)) {
      const next = text.replace(new RegExp('\\n?' + escapeRe(BEGIN) + '[\\s\\S]*?' + escapeRe(END) + '\\n?', 'g'), '\n')
      if (!DRY) {
        fs.writeFileSync(PATCH_FILE + '.bak-' + Date.now(), text, 'utf8')
        fs.writeFileSync(PATCH_FILE, next.replace(/\n{3,}/g, '\n\n'), 'utf8')
      }
      log('已从 cordis.patch.yml 移除插件条目（原文件已备份）')
      changed++
    } else {
      log('cordis.patch.yml 里没有本插件的托管块，跳过')
    }
  }

  /* 把 --replace-startup 停用的 bundle 加回去（只动 bundles，不碰依赖） */
  if (replaced.length && fs.existsSync(path.join(PROFILE_DIR, 'package.json'))) {
    try {
      const pkgPath = path.join(PROFILE_DIR, 'package.json')
      const raw = fs.readFileSync(pkgPath, 'utf8')
      const pkg = JSON.parse(raw)
      const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
      const addBack = replaced.filter((n) => !bundles.includes(n))
      if (addBack.length) {
        pkg.dsh.profile.bundles = bundles.concat(addBack)
        if (!DRY) {
          fs.writeFileSync(pkgPath + '.bak-' + Date.now(), raw, 'utf8')
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')
        }
        log('已把被停用的 bundle 加回去：' + addBack.join(', '))
        changed++
      }
    } catch (err) {
      console.warn('⚠ 恢复 bundle 列表失败：' + (err && err.message))
    }
  }

  if (fs.existsSync(LINK_PATH) || isLink(LINK_PATH)) {
    if (!DRY) removeLink(LINK_PATH)
    log('已移除 node_modules 联接：' + LINK_PATH)
    changed++
  } else {
    log('没有找到联接，跳过：' + LINK_PATH)
  }

  log(changed ? '卸载完成，重启 DSH 生效。' : '没有需要卸载的内容。')
  process.exit(0)
}

/* ── 安装 ─────────────────────────────────────────────────────────────── */
if (!fs.existsSync(path.join(PROFILE_DIR, 'node_modules'))) {
  fail('profile 里没有 node_modules，先把 DSH 跑起来一次再装：' + PROFILE_DIR)
}

/* 1) 目录联接 */
if (fs.existsSync(LINK_PATH) || isLink(LINK_PATH)) {
  log('联接已存在：' + LINK_PATH)
} else if (DRY) {
  log('将创建联接 ' + LINK_PATH + ' → ' + PACKAGE_ROOT)
} else {
  try {
    fs.symlinkSync(PACKAGE_ROOT, LINK_PATH, 'junction')
    log('已创建联接 ' + LINK_PATH + ' → ' + PACKAGE_ROOT)
  } catch (err) {
    fail('创建联接失败：' + (err && err.message) + '\n  可手动执行：mklink /J "' + LINK_PATH + '" "' + PACKAGE_ROOT + '"')
  }
}

/* 2) 先看有没有别的启动屏插件：--replace-startup 会把它的 bundle 从层栈里摘掉
      （只改 dsh.profile.bundles，依赖和它的配置都留着，卸载时按托管块里的
       replaced-bundles 记录自动加回去）。 */
const others = detectOtherStartup()
const replacedBundles = []
if (others.length) {
  if (flag('replace-startup')) {
    const pkgPath = path.join(PROFILE_DIR, 'package.json')
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8')
      const pkg = JSON.parse(raw)
      const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
      const removed = others.filter((n) => bundles.includes(n))
      if (removed.length) {
        pkg.dsh.profile.bundles = bundles.filter((n) => !removed.includes(n))
        for (const n of removed) replacedBundles.push(n)
        if (!DRY) {
          fs.writeFileSync(pkgPath + '.bak-' + Date.now(), raw, 'utf8')
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')
        }
        console.warn('\n✔ 已从 dsh.profile.bundles 停用其它启动屏插件：' + removed.join(', '))
        console.warn('  （没卸载、没删配置；卸载本插件时会自动加回去）')
      } else {
        console.warn('\n⚠ ' + others.join(', ') + ' 不在 bundles 里，但依赖还在；如果它仍然生效，手动停用一下。')
      }
    } catch (err) {
      console.warn('\n⚠ 停用其它启动屏插件失败：' + (err && err.message))
    }
  } else {
    console.warn('\n⚠ 检测到这个 profile 里还有别的启动屏插件：' + others.join(', '))
    console.warn('  两个启动屏插件同时启用会叠播（本插件会自动让位、不播放）。')
    console.warn('  想让本插件接管启动屏，重跑一次加参数：')
    console.warn('    node scripts/install.mjs --replace-startup')
    console.warn('  界面主题不受影响，装了就能用。\n')
  }
}

/* 3) profile patch 层加一条 insert（幂等） */
if (!fs.existsSync(PATCH_FILE)) {
  if (!DRY) fs.writeFileSync(PATCH_FILE, '# Your patch layer for this dsh profile\n', 'utf8')
  log('新建 cordis.patch.yml')
}
const patchText = fs.readFileSync(PATCH_FILE, 'utf8')

if (patchText.includes(BEGIN)) {
  log('cordis.patch.yml 里已有托管块，跳过（幂等）')
} else {
  /* 重复注册会 apply 两遍、路由重复注册报错 —— 先查有没有手写的同名条目 */
  const dup = /^\s*-\s*insert:/m.test(patchText) && patchText.includes('name: ' + PKG_NAME)
  if (dup) {
    fail('cordis.patch.yml 里已经有引用了 ' + PKG_NAME + ' 的条目，请先删掉再装，否则会注册两遍')
  }
  const next = patchText.replace(/\s*$/, '') + '\n\n' + blockOf(replacedBundles) + '\n'
  if (!DRY) {
    fs.writeFileSync(PATCH_FILE + '.bak-' + Date.now(), patchText, 'utf8')
    fs.writeFileSync(PATCH_FILE, next, 'utf8')
  }
  log('已把插件插入 cordis.patch.yml（原文件已备份）')
}

/* 3) 自检：包能被 Node 解析到 */
if (!DRY) {
  try {
    const resolved = fs.realpathSync(LINK_PATH)
    if (resolved.toLowerCase() !== PACKAGE_ROOT.toLowerCase()) {
      console.warn('⚠ 联接指向了别处：' + resolved)
    }
    const clientPath = path.join(LINK_PATH, 'lib', 'client.js')
    if (!fs.existsSync(clientPath)) console.warn('⚠ 缺 lib/client.js，设置面板不会出现')
  } catch (err) {
    console.warn('⚠ 自检没通过：' + (err && err.message))
  }
}

console.log('\n' + (DRY ? '（dry-run，未改动任何文件）' : '✔ 安装完成') + '\n' +
  '  profile : ' + PROFILE + '\n' +
  '  patch   : ' + PATCH_FILE + '\n' +
  '  联接    : ' + LINK_PATH + '\n' +
  '\n下一步：\n' +
  '  1. 重启 DSH（完全退出再打开；Web 版关掉 dsh web 再起）\n' +
  '  2. 刷新页面 → 先看到启动屏，进界面后是流浪地球 HUD 主题\n' +
  '  3. 设置 → 流浪地球主题，调配色/质感/文案\n' +
  '\n卸载：node scripts/install.mjs --uninstall')

/* ── 工具 ─────────────────────────────────────────────────────────────── */

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink() } catch { return false }
}
function removeLink(p) {
  try {
    fs.unlinkSync(p)
  } catch (err) {
    /* Windows 的 junction 有时要 rmdir */
    fs.rmSync(p, { recursive: false, force: true })
  }
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
