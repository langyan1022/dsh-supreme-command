#!/usr/bin/env node
/* 把「真声素材」导入到本插件的语音槽位（可选功能）。
 *
 * 背景：本插件的语音默认走**系统合成**（Web Speech API），台词内容与你的文案一致。
 * 如果你更喜欢参考插件 dsh-startup-screen 里那种真人/AI 女声的**音色**，
 * 可以把它已经装在本机的素材按"槽位"接过来 —— 本脚本只读取/复制你本机已有的文件，
 * 不会把任何音频打进插件的发布包。
 *
 * 用法：
 *   node scripts/import-voice.mjs                    # 从已装的 dsh-startup-screen 导入 line-6 → grant
 *   node scripts/import-voice.mjs --all              # 尽量多导（line-1→title / line-5→operator / line-6→grant）
 *   node scripts/import-voice.mjs --slot grant=line-6
 *   node scripts/import-voice.mjs --from D:\a.mp3 --slot grant
 *   node scripts/import-voice.mjs --list             # 只列出找到的素材与现有槽位
 *   node scripts/import-voice.mjs --remove           # 清空导入的槽位
 *
 * 注意：素材台词是参考插件自己的台词（如 line-6 = "Welcome. Authorization granted."），
 * 与本插件中文文案不一定逐字对应，只建议用在对白不敏感、语义相近的槽位（授权通过最合适）。
 * 导入后把配置里 voiceSource 设为 'asset'（设置页：启动屏 → 语音来源 → 素材文件）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEST = path.join(ROOT, 'lib', 'assets', 'voice')
const SLOTS = ['title', 'operator', 'grant']
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

const argv = process.argv.slice(2)
const flag = (n) => argv.includes('--' + n)
function valuesOf(name) {
  const out = []
  argv.forEach((a, i) => { if (a === '--' + name && argv[i + 1]) out.push(argv[i + 1]) })
  return out
}

/* ── 找参考插件的素材 ─────────────────────────────────────────────────── */
function findReferenceAssets() {
  const found = {}
  const profiles = path.join(DSH_HOME, 'profiles')
  if (!fs.existsSync(profiles)) return found
  for (const profile of fs.readdirSync(profiles)) {
    const dir = path.join(profiles, profile, 'node_modules', 'dsh-startup-screen', 'lib', 'assets')
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      const m = file.match(/^(line-\d+)\.mp3$/i)
      if (!m) continue
      const key = m[1].toLowerCase()
      if (!found[key]) found[key] = path.join(dir, file)
    }
  }
  return found
}

function listState() {
  console.log('插件语音槽位（lib/assets/voice/）：')
  for (const slot of SLOTS) {
    const file = path.join(DEST, slot + '.mp3')
    const exists = fs.existsSync(file)
    console.log('  ' + (exists ? '✔' : '·') + ' ' + slot.padEnd(9) + (exists ? fs.statSync(file).size + ' bytes' : '（未导入，用系统合成）'))
  }
  const ref = findReferenceAssets()
  const keys = Object.keys(ref)
  console.log('\n本机找到的参考插件素材：' + (keys.length ? '' : '（没找到已安装的 dsh-startup-screen）'))
  for (const key of keys.sort()) {
    console.log('  ' + key.padEnd(8) + path.relative(DSH_HOME, ref[key]))
  }
  if (!keys.length) {
    console.log('  提示：也可以直接用 --from <你的音频.mp3> --slot <title|operator|grant> 导入自己的素材。')
  }
}

/* ── 导入 / 移除 ──────────────────────────────────────────────────────── */
const LIST = flag('list')
if (LIST) { listState(); process.exit(0) }

if (flag('remove')) {
  if (!fs.existsSync(DEST)) { console.log('没有可清空的素材目录。'); process.exit(0) }
  let removed = 0
  for (const slot of SLOTS) {
    const file = path.join(DEST, slot + '.mp3')
    if (fs.existsSync(file)) { fs.rmSync(file); removed++; console.log('已删除 ' + slot + '.mp3') }
  }
  try { fs.rmdirSync(DEST) } catch (e) { /* 目录非空就留着 */ }
  console.log(removed ? '已清空 ' + removed + ' 个槽位（语音回落到系统合成）。' : '没有已导入的素材。')
  process.exit(0)
}

const ref = findReferenceAssets()
const plan = new Map()   // slot -> source path

/* --slot grant=line-6 形式 */
for (const pair of valuesOf('slot')) {
  const [slot, value] = pair.split('=')
  if (!SLOTS.includes(slot)) {
    console.error('✖ 未知槽位：' + slot + '（只支持 ' + SLOTS.join(' / ') + '）')
    process.exit(2)
  }
  if (value && /^line-\d+$/.test(value)) {
    if (!ref[value]) { console.error('✖ 本机没有素材 ' + value); process.exit(2) }
    plan.set(slot, ref[value])
  } else if (value) {
    if (!fs.existsSync(value)) { console.error('✖ 文件不存在：' + value); process.exit(2) }
    plan.set(slot, path.resolve(value))
  } else {
    /* --slot grant --from <file> */
    const from = valuesOf('from')[0]
    if (!from) { console.error('✖ --slot ' + slot + ' 需要 =line-N 或配合 --from <文件>'); process.exit(2) }
    if (!fs.existsSync(from)) { console.error('✖ 文件不存在：' + from); process.exit(2) }
    plan.set(slot, path.resolve(from))
  }
}

/* --all：按台词语义尽量对应 */
if (flag('all')) {
  if (ref['line-6']) plan.set('grant', ref['line-6'])
  if (ref['line-1']) plan.set('title', ref['line-1'])
  if (ref['line-5']) plan.set('operator', ref['line-5'])
}

if (!plan.size) {
  /* 默认：只导 line-6（它的台词就是 "Welcome. Authorization granted."，语义对得上） */
  if (ref['line-6']) plan.set('grant', ref['line-6'])
}

if (!plan.size) {
  console.error('\n✖ 没有可导入的素材。')
  console.error('  · 先确认 dsh-startup-screen 还装着（脚本会去 ~/.dsh/profiles/*/node_modules 找）')
  console.error('  · 或者用 --from <你的音频.mp3> --slot grant 导入自己的录音')
  consolexit()
}

fs.mkdirSync(DEST, { recursive: true })
for (const [slot, source] of plan) {
  const target = path.join(DEST, slot + '.mp3')
  fs.copyFileSync(source, target)
  console.log('✔ ' + slot.padEnd(9) + '← ' + source + '  (' + fs.statSync(target).size + ' bytes)')
}

console.log('\n导入完成。接下来：')
console.log('  1. 设置 → 流浪地球主题 → 启动屏 → 语音来源，选「素材文件」')
console.log('     （或直接改 ~/.dsh/dsh-supreme-command.json 里的 "voiceSource": "asset"）')
console.log('  2. 刷新页面 / 点「重播启动屏」听效果')
console.log('\n提醒：这些音频来自你本机已安装的插件或你自己的录音，仅个人使用；')
console.log('     插件发布到 npm 前建议删掉 lib/assets/voice/（node scripts/import-voice.mjs --remove）。')

function consolexit() {
  console.error('\n  · 用 --list 看看本机有什么。')
  process.exit(2)
}
