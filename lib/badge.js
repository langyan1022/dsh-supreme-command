/**
 * 工牌（移植 MOSS v2）：新版用真实字体（淘宝买菜体 / 字魂创粗黑 / Fira Sans / Rajdhani）
 * 渲染可编辑字段，参考字形只用于编号/流水号的印刷层叠印。
 *
 * 字体不随包分发：Host 从本机 MOSS 目录下发；缺失时回退到随包的思源黑体。
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const PRINT_ASSET = '/dsh-command/badge/print.svg'
const REFERENCE = { number: 'IQC-001', name: '马兆', role: '实验室主任', serial: 'BSC–IQC001 222179 MAZHAO' }

const START_B = 104
const STOP = 106
const QUIET_MODULES = 10
const BAR_HEIGHT = 32
const PATTERNS = `
212222 222122 222221 121223 121322 131222 122213 122312 132212 221213
221312 231212 112232 122132 122231 113222 123122 123221 223211 221132
221231 213212 223112 312131 311222 321122 321221 312212 322112 322211
212123 212321 232121 111323 131123 131321 112313 132113 132311 211313
231113 231311 112133 112331 132131 113123 113321 133121 313121 211331
231131 213113 213311 213131 311123 311321 331121 312113 312311 332111
314111 221411 431111 111224 111422 121124 121421 141122 141221 112214
112412 122114 122411 142112 142211 241211 221114 413111 241112 134111
111242 121142 121241 114212 124112 124211 411212 421112 421211 212141
214121 412121 111143 111341 131141 114113 114311 411113 411311 113141
114131 311141 411131 211412 211214 211232 2331112
`.trim().split(/\s+/)

function drawBarcode(svg, value) {
  svg.replaceChildren()
  if (typeof value !== 'string' || !value.length || /[^ -~]/u.test(value)) return false
  const codes = [START_B]
  let checksum = START_B
  for (let i = 0; i < value.length; i++) {
    const symbol = value.charCodeAt(i) - 32
    codes.push(symbol)
    checksum = (checksum + symbol * (i + 1)) % 103
  }
  codes.push(checksum, STOP)
  const bars = []
  let x = QUIET_MODULES
  for (const code of codes) {
    const widths = PATTERNS[code]
    for (let i = 0; i < widths.length; i++) {
      const width = Number(widths[i])
      if (i % 2 === 0) bars.push(`M${x} 0h${width}v${BAR_HEIGHT}h-${width}Z`)
      x += width
    }
  }
  svg.setAttribute('viewBox', `0 0 ${x + QUIET_MODULES} ${BAR_HEIGHT}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('shape-rendering', 'crispEdges')
  const path = svg.ownerDocument.createElementNS(SVG_NS, 'path')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', bars.join(''))
  svg.append(path)
  return true
}

const BARCODE = '<svg class="credential-card__barcode" role="img"></svg>'
const FACES = {
  back: `
    <div class="credential-card__stripe" lang="en"><span>IDL. <span class="credential-card__number"></span></span></div>
    ${BARCODE}`,
  front: `
    <div class="credential-card__identity credential-card__number" lang="en"></div>
    <div class="credential-card__name"></div>
    <div class="credential-card__role"></div>
    <div class="credential-card__serial"></div>
    ${BARCODE}`
}

function setBarcode(code, profile, useReferenceSerial) {
  const value = useReferenceSerial ? REFERENCE.serial.replace('–', '-') : profile.number
  code.setAttribute('aria-label', `工牌${useReferenceSerial ? '流水号' : '编号'} ${value} 的条形码`)
  code.dataset.badgeNumber = profile.number
  code.dataset.value = value
  drawBarcode(code, value)
}

function fitSerial(label) {
  const doc = label.ownerDocument
  const style = doc.defaultView.getComputedStyle(label)
  const optical = (name) => parseFloat(style.getPropertyValue(`--serial-${name}`))
  const width = optical('width')
  const ctx = doc.createElement('canvas').getContext('2d')
  if (!ctx || !('letterSpacing' in ctx) || !('wordSpacing' in ctx) || !width) return
  const font = `${style.fontWeight} ${optical('size')}px ${style.fontFamily}`
  const text = label.textContent
  const applyFit = () => {
    if (!label.isConnected) return
    ctx.font = font
    ctx.letterSpacing = `${optical('tracking')}px`
    ctx.wordSpacing = `${optical('word-spacing')}px`
    const textWidth = ctx.measureText(text).width
    label.style.setProperty('--serial-scale', Math.min(1, (width - 4) / Math.max(1, textWidth)))
  }
  if (doc.fonts.check(font, text)) applyFit()
  else void doc.fonts.load(font, text).then(applyFit, applyFit)
}

export function renderCredentialCard(container, profile, side) {
  const front = side !== 'back'
  const card = document.createElement('article')
  card.className = 'credential-card'
  card.dataset.side = front ? 'front' : 'back'
  card.setAttribute('aria-label', front ? '工牌正面' : '工牌背面')
  card.innerHTML = FACES[card.dataset.side]

  /* 印刷 SVG 里的图层 ID 还是上一版的命名（front/back 语义与现在相反） */
  const artworkSide = front ? 'back' : 'front'
  const layers = [artworkSide]
  function setLabel(selector, value, referenceLayer, exact, hiddenWrapper) {
    const node = card.querySelector(selector)
    node.textContent = value
    node.title = value
    const glyphCount = [...value].length
    const wrapper = card.querySelector(hiddenWrapper || selector)
    wrapper.style.setProperty('--glyph-count', glyphCount + (wrapper === node ? 0 : 5))
    if (node.matches('.credential-card__name, .credential-card__role') && /\p{Script=Han}/u.test(value)) node.dataset.han = ''
    if (selector === '.credential-card__name') {
      node.dataset.glyphCount = glyphCount
      if (glyphCount > 6) node.dataset.wrap = ''
      if (value === REFERENCE.name) {
        const raised = card.ownerDocument.createElement('span')
        raised.textContent = '兆'
        node.replaceChildren('马', raised)
        node.dataset.referencePair = ''
      }
    }
    if (selector === '.credential-card__number' && front && glyphCount > 12) node.dataset.wrap = ''
    if (exact) {
      wrapper.dataset.reference = ''
      layers.push(referenceLayer)
    }
  }

  const referenceNumber = profile.number === REFERENCE.number
  const referenceName = profile.name === REFERENCE.name
  const referenceSerial = referenceNumber && referenceName
  setLabel('.credential-card__number', profile.number, `${artworkSide}-reference-id`, referenceNumber,
    front ? '.credential-card__identity' : '.credential-card__stripe')
  if (front) {
    setLabel('.credential-card__name', profile.name, null, false)
    setLabel('.credential-card__role', profile.role, null, false)
    setLabel('.credential-card__serial',
      referenceSerial ? REFERENCE.serial : (profile.serial || `BSC-${profile.number} ${profile.name}`),
      'reference-serial', referenceSerial)
  }

  const print = `<svg class="credential-card__print" viewBox="0 0 450 282" role="img" aria-hidden="true">
    ${layers.map((layer) => `<use href="${PRINT_ASSET}#${layer}"></use>`).join('')}</svg>`
  card.insertAdjacentHTML('afterbegin', print)

  setBarcode(card.querySelector('.credential-card__barcode'), profile, referenceSerial)
  container.replaceChildren(card)
  if (front && !referenceSerial) fitSerial(card.querySelector('.credential-card__serial'))
  return card
}
