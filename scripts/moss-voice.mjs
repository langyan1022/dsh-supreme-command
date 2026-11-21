// 用本机 MOSS 服务（OmniVoice）合成主题的三句语音，落成单声道 wav 素材。
// 只读调用 MOSS 的 /api/speak，不改它的任何文件。
//
// 用法:
//   node scripts/moss-voice.mjs                     # 用默认三句
//   node scripts/moss-voice.mjs --text boot=... --text title=... --text grant=...
//   node scripts/moss-voice.mjs --url http://127.0.0.1:18221 --category notice
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_LINES = {
  boot: 'MOSS is online。为了延续人类文明，请保持理智。',
  title: '550W 智能量子计算机，已接管本控制台。',
  operator: '操作员生物签名核验通过，权限等级 L1。',
  grant: '北京航天中心授权完成，系统进入待命。'
}

const argv = process.argv.slice(2)
function arg(name, fallback) {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const base = arg('url', process.env.MOSS_URL || 'http://127.0.0.1:18221').replace(/\/+$/, '')
const category = arg('category', 'notice')
const outDir = path.resolve(arg('out', 'lib/assets/voice'))

const lines = { ...DEFAULT_LINES }
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--text') continue
  const pair = String(argv[i + 1] || '')
  const eq = pair.indexOf('=')
  if (eq > 0) lines[pair.slice(0, eq)] = pair.slice(eq + 1)
}

/** PCM16 wav → 单声道（左右平均），保持采样率不变 */
function stereoToMono(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('不是 RIFF wav')
  let pos = 12
  let fmt = null
  let data = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    const start = pos + 8
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        bits: buf.readUInt16LE(start + 14)
      }
    } else if (id === 'data') {
      data = buf.subarray(start, Math.min(start + size, buf.length))
    }
    pos = start + size + (size % 2)
  }
  if (!fmt || !data) throw new Error('wav 缺少 fmt/data')
  if (fmt.bits !== 16) throw new Error('只处理 16bit wav，收到 ' + fmt.bits + 'bit')
  const mono = fmt.channels === 1
  if (mono) return { sampleRate: fmt.sampleRate, pcm: data }

  const frames = Math.floor(data.length / (2 * fmt.channels))
  const out = Buffer.alloc(frames * 2)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2)
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sum / fmt.channels))), i * 2)
  }
  return { sampleRate: fmt.sampleRate, pcm: out }
}

function buildWav(sampleRate, pcm) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function speak(text) {
  const res = await fetch(base + '/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, category })
  })
  if (!res.ok) {
    let detail = ''
    try { detail = JSON.stringify(await res.json()) } catch (e) { /* noop */ }
    throw new Error('MOSS /api/speak HTTP ' + res.status + ' ' + detail)
  }
  const type = res.headers.get('content-type') || ''
  if (!type.includes('audio')) throw new Error('返回的不是音频: ' + type)
  return Buffer.from(await res.arrayBuffer())
}

fs.mkdirSync(outDir, { recursive: true })
for (const [slot, text] of Object.entries(lines)) {
  process.stdout.write(slot + ' ← ' + text + ' … ')
  const raw = await speak(text)
  const { sampleRate, pcm } = stereoToMono(raw)
  const wav = buildWav(sampleRate, pcm)
  const file = path.join(outDir, slot + '.wav')
  fs.writeFileSync(file, wav)
  const secs = (pcm.length / 2 / sampleRate).toFixed(2)
  console.log('OK ' + (wav.length / 1024).toFixed(0) + 'KB ' + secs + 's @' + sampleRate + 'Hz → ' + path.relative(process.cwd(), file))
}
