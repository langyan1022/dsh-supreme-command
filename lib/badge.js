/**
 * 工牌（从 MOSS 目录完整移植）：使用 MOSS 的 staff-badge-print.svg 印刷层
 * + 参考字形字体 + Code128 条形码，按它的 credential-card 结构与排版渲染。
 *
 * 导出：renderCredentialCard(container, profile, side)
 *   profile = { number, name, role, serial }
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

function setBarcode(code, profile, useReferenceSerial) {
  const value = useReferenceSerial ? REFERENCE.serial.replace('–', '-') : profile.number
  code.setAttribute('aria-label', `工牌${useReferenceSerial ? '流水号' : '编号'} ${value} 的条形码`)
  code.dataset.badgeNumber = profile.number
  code.dataset.value = value
  drawBarcode(code, value)
}

const FACES = {
  front: `
    <div class="credential-card__stripe" lang="en"><span>IDL. <span class="credential-card__number"></span></span></div>
    <svg class="credential-card__barcode" role="img"></svg>`,
  back: `
    <div class="credential-card__identity credential-card__number" lang="en"></div>
    <div class="credential-card__name"></div>
    <div class="credential-card__role"></div>
    <div class="credential-card__serial"></div>
    <svg class="credential-card__barcode" role="img"></svg>`
}

export function renderCredentialCard(container, profile, side) {
  const back = side === 'back'
  const card = document.createElement('article')
  card.className = 'credential-card'
  card.dataset.side = back ? 'back' : 'front'
  card.setAttribute('aria-label', back ? '工牌背面' : '工牌正面')
  card.innerHTML = FACES[card.dataset.side]

  const layers = [card.dataset.side]
  function setLabel(selector, value, referenceLayer, exact, hiddenWrapper) {
    const node = card.querySelector(selector)
    node.textContent = value
    node.title = value
    node.style.setProperty('--glyph-count', [...value].length)
    if (exact) {
      card.querySelector(hiddenWrapper || selector).dataset.reference = ''
      layers.push(referenceLayer)
    }
  }

  const referenceNumber = profile.number === REFERENCE.number
  const referenceName = profile.name === REFERENCE.name
  const referenceSerial = referenceNumber && referenceName && profile.role === REFERENCE.role
  setLabel('.credential-card__number', profile.number, `${card.dataset.side}-reference-id`, referenceNumber,
    back ? '.credential-card__identity' : '.credential-card__stripe')
  if (back) {
    setLabel('.credential-card__name', profile.name, 'reference-name', referenceName)
    setLabel('.credential-card__role', profile.role, 'reference-role', profile.role === REFERENCE.role)
    setLabel('.credential-card__serial',
      referenceSerial ? REFERENCE.serial : (profile.serial || `BSC-${profile.number} ${profile.name}`),
      'reference-serial', referenceSerial)
  }

  const print = `<svg class="credential-card__print" viewBox="0 0 450 282" role="img" aria-hidden="true">
    ${layers.map((layer) => `<use href="${PRINT_ASSET}#${layer}"></use>`).join('')}</svg>`
  card.insertAdjacentHTML('afterbegin', print)

  setBarcode(card.querySelector('.credential-card__barcode'), profile, referenceSerial)
  container.replaceChildren(card)
  return card
}
