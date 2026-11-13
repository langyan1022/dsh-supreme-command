/* ============================================================================
 * dsh-supreme-command — 配色预设（唯一来源）
 * ----------------------------------------------------------------------------
 * Host 半侧在这里读预设；/dsh-command/config 会把 `presets` 一起发给设置面板，
 * 所以设置面板不需要另存一份色板，改这里就是改全部。
 *
 * 每个预设只给 4 枚基色，其余（面板底色、线条、发光）由 theme.css / splash.css
 * 用 color-mix() 从 accent 派生 —— 用户改一只 accent，整套观感跟着走。
 * ========================================================================== */

/** 预设表：id → { label, labelEn, scheme, accent, accent2, bg, text } */
export const PRESETS = {
  'command-red': {
    label: '地球红',
    labelEn: 'Earth Red',
    scheme: 'dark',
    accent: '#ff3b30',
    accent2: '#ff8a5c',
    bg: '#080305',
    text: '#f3e7e4'
  },
  amber: {
    label: '琥珀终端',
    labelEn: 'Amber Terminal',
    scheme: 'dark',
    accent: '#ffb020',
    accent2: '#ffd76a',
    bg: '#0a0703',
    text: '#f5eddf'
  },
  cyan: {
    label: '全息青',
    labelEn: 'Holo Cyan',
    scheme: 'dark',
    accent: '#22d3ee',
    accent2: '#7dd3fc',
    bg: '#03080a',
    text: '#e2f6fa'
  },
  green: {
    label: '战术绿',
    labelEn: 'Tactical Green',
    scheme: 'dark',
    accent: '#35e07a',
    accent2: '#a3e635',
    bg: '#040a06',
    text: '#e3f7ea'
  },
  violet: {
    label: '深空紫',
    labelEn: 'Deep Space',
    scheme: 'dark',
    accent: '#a855f7',
    accent2: '#e879f9',
    bg: '#08040e',
    text: '#f0e8fb'
  },
  mono: {
    label: '冷白机',
    labelEn: 'Cold Mono',
    scheme: 'dark',
    accent: '#e5e7eb',
    accent2: '#9ca3af',
    bg: '#09090b',
    text: '#f4f4f5'
  }
}

/** `custom` 不是可选项：用户改了 accent 就落到它上面，色板沿用最近的预设骨架。 */
export const CUSTOM_ID = 'custom'

export const PRESET_IDS = Object.keys(PRESETS)

/** 把 preset + 四个基色解析成最终色板（accent 永远以用户值为准）。 */
export function resolvePalette(config) {
  const cfg = config && typeof config === 'object' ? config : {}
  const preset = PRESETS[cfg.preset] || PRESETS['command-red']
  const pick = (value, fallback) => {
    const s = typeof value === 'string' ? value.trim() : ''
    return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback
  }
  return {
    id: PRESETS[cfg.preset] ? cfg.preset : CUSTOM_ID,
    accent: pick(cfg.accent, preset.accent),
    accent2: pick(cfg.accent2, preset.accent2),
    bg: pick(cfg.bgBase, preset.bg),
    text: pick(cfg.textPrimary, preset.text)
  }
}
