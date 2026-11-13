/**
 * dsh-supreme-command — 浏览器半侧（设置页「流浪地球主题」）
 * ----------------------------------------------------------------------------
 * 手写 ModuleLoader bundle，无构建、无依赖（只 require('react')）。
 *
 * 在 DSH 设置里注册一个 settings.section，用来调：
 *   配色（预设色卡 + 四色选择器 + 深色策略）→ 质感（发光/扫描线/颗粒/暗角 + HUD 框）
 *   → 启动屏（开关/时机/速度/跳过/文案/地位/身份/状态行/徽标/声音）→ 关于（版本/配置路径/恢复默认/重播/预览）
 *
 * 数据不走 settings 命名空间，走 Host 半侧自带的 HTTP API（契约见 docs/CONFIG.md §7）：
 *   GET  /dsh-command/config  → { ok, version, config, defaults, presets, file }
 *   POST /dsh-command/config  → { patch: {...} } 或 { action: 'reset' }，返回同形状
 * 预设色板只从响应的 presets 里读，这里不内置任何预设色值。
 */
window.__ModuleLoader__.load({
  id: 'dsh-supreme-command',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-command/config'
    var CSS_TAG_ID = 'dsh-supreme-command/main.css'
    /* Host 半侧没把版本注入到 window 时的兜底（版本号本身只在 package.json 里维护）。 */
    var FALLBACK_VERSION = '1.0.0'

    /* ── CSS（类名一律 __ss_ 前缀，配色走 --dsw-alias-* + 本地 --ss_accent） ── */
    var CSS = [
      '.__ss_root{--ss_accent:var(--dsw-alias-state-business-primary,#3964fe);--ss_accent2:var(--dsw-alias-brand-primary,#8b5cf6);box-sizing:border-box;max-width:760px;display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#e8eaed);font-family:inherit}',
      '.__ss_root *{box-sizing:border-box}',
      /* ── 头部 ── */
      '.__ss_head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:2px 2px 0}',
      '.__ss_brand{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.__ss_kicker{display:flex;align-items:center;gap:8px;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_kicker::before{content:"";width:16px;height:2px;background:var(--ss_accent);box-shadow:0 0 10px var(--ss_accent)}',
      '.__ss_title{font-size:15px;font-weight:700;letter-spacing:.02em;color:var(--dsw-alias-label-primary,#e8eaed)}',
      '.__ss_sub{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#8b909a);max-width:58ch}',
      '.__ss_verChip{flex:0 0 auto;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:10.5px;letter-spacing:.08em;color:var(--dsw-alias-label-secondary,#b9bec7);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:999px;padding:4px 9px;background:var(--dsw-alias-bg-layer-3,#212429);white-space:nowrap}',
      /* ── 分组跳转 chips（sticky） ── */
      '.__ss_toc{position:sticky;top:0;z-index:6;display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;margin:0;background:var(--dsw-alias-bg-base,#101216);border-bottom:1px solid transparent}',
      '.__ss_tocItem{font:inherit;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:11px;letter-spacing:.06em;line-height:1;padding:6px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-3,#212429);color:var(--dsw-alias-label-secondary,#b9bec7);cursor:pointer;transition:color .14s,border-color .14s,background .14s}',
      '.__ss_tocItem:hover{color:var(--dsw-alias-label-primary);border-color:var(--ss_accent);background:color-mix(in srgb,var(--ss_accent) 10%,var(--dsw-alias-bg-layer-3,#212429))}',
      '.__ss_tocItem:active{transform:translateY(1px)}',
      /* ── 分组卡片（HUD 直角框 + 极淡扫描纹） ── */
      '.__ss_group{position:relative;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;padding:14px 16px 16px;display:flex;flex-direction:column;gap:13px;background:var(--dsw-alias-bg-layer-1,#16181d);background-image:linear-gradient(180deg,color-mix(in srgb,var(--ss_accent) 5%,transparent),transparent 46%),repeating-linear-gradient(0deg,rgba(255,255,255,.016) 0 1px,transparent 1px 3px);transition:border-color .16s}',
      '.__ss_group::before,.__ss_group::after{content:"";position:absolute;width:11px;height:11px;pointer-events:none;border-color:color-mix(in srgb,var(--ss_accent) 55%,transparent)}',
      '.__ss_group::before{left:-1px;top:-1px;border-top:1.5px solid;border-left:1.5px solid;border-top-left-radius:12px}',
      '.__ss_group::after{right:-1px;bottom:-1px;border-bottom:1.5px solid;border-right:1.5px solid;border-bottom-right-radius:12px}',
      '.__ss_groupChanged{border-color:color-mix(in srgb,var(--ss_accent) 26%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)))}',
      '.__ss_gh{display:flex;align-items:center;gap:10px;margin:0 0 -2px;min-height:18px}',
      '.__ss_ghMark{flex:0 0 auto;width:6px;height:6px;background:var(--ss_accent);box-shadow:0 0 8px var(--ss_accent);transform:rotate(45deg)}',
      '.__ss_ghTitle{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_ghEn{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b909a);opacity:.8}',
      '.__ss_ghLine{flex:1 1 auto;height:1px;background:linear-gradient(90deg,var(--dsw-alias-border-l2,rgba(255,255,255,.1)),transparent)}',
      '.__ss_ghBadge{font-size:10.5px;line-height:1;padding:3px 7px;border-radius:999px;color:var(--ss_accent);border:1px solid color-mix(in srgb,var(--ss_accent) 42%,transparent);background:color-mix(in srgb,var(--ss_accent) 9%,transparent);white-space:nowrap}',
      /* ── 表单原子 ── */
      '.__ss_field{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.__ss_labelRow{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}',
      '.__ss_label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#e8eaed)}',
      '.__ss_dot{width:5px;height:5px;border-radius:50%;background:var(--ss_accent);box-shadow:0 0 6px var(--ss_accent);opacity:0;transition:opacity .16s;flex:0 0 auto}',
      '.__ss_changed .__ss_dot{opacity:1}',
      '.__ss_changedTag{flex:0 0 auto;font-size:10px;letter-spacing:.06em;color:var(--ss_accent);opacity:.9}',
      '.__ss_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}',
      '.__ss_grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}',
      '.__ss_input{width:100%;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-3,#212429);color:var(--dsw-alias-label-primary,#e8eaed);border-radius:8px;padding:7px 10px;font:inherit;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s;min-width:0}',
      '.__ss_input:focus{border-color:var(--ss_accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ss_accent) 20%,transparent)}',
      '.__ss_select{cursor:pointer;appearance:none;-webkit-appearance:none;padding-right:30px;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-size:5px 5px,5px 5px;background-position:calc(100% - 15px) 50%,calc(100% - 10px) 50%;background-repeat:no-repeat}',
      '.__ss_voiceRow{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}',
      '.__ss_voiceRow>.__ss_field{flex:1 1 260px}',
      '.__ss_photoRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.__ss_photoThumb{width:64px;height:80px;flex:none;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:6px;background:var(--dsw-alias-bg-layer-3,#212429);display:grid;place-items:center;overflow:hidden}',
      '.__ss_photoThumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.__ss_photoThumb span{font:10px/1.2 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-tertiary,#8b909a);letter-spacing:.1em;text-align:center}',
      '.__ss_input::placeholder{color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_input:disabled{opacity:.55;cursor:not-allowed}',
      '.__ss_inputBad{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 62%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)))}',
      '.__ss_changed .__ss_input{border-color:color-mix(in srgb,var(--ss_accent) 55%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)))}',
      '.__ss_mono{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:12px;letter-spacing:.03em}',
      '.__ss_textarea{min-height:104px;resize:vertical;line-height:1.65;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:12px}',
      '.__ss_counter{flex:0 0 auto;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      /* 分段按钮 */
      '.__ss_seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:9px;background:var(--dsw-alias-bg-layer-2,rgba(42,44,50,.92));max-width:100%}',
      '.__ss_segBtn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#b9bec7);font:inherit;font-size:12px;line-height:1.2;padding:6px 12px;border-radius:7px;cursor:pointer;white-space:nowrap;transition:color .14s,background .14s,box-shadow .14s}',
      '.__ss_segBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}',
      '.__ss_segBtn[aria-pressed="true"]{background:var(--ss_accent);color:#0a0705;font-weight:600;box-shadow:0 0 12px -2px color-mix(in srgb,var(--ss_accent) 65%,transparent)}',
      /* 开关 */
      '.__ss_switch{display:flex;align-items:flex-start;gap:10px;padding:2px 0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%}',
      '.__ss_switchTrack{position:relative;flex:0 0 auto;width:38px;height:21px;margin-top:1px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,#212429);border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.14));transition:background .16s,border-color .16s}',
      '.__ss_switchTrack::after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#8b909a);transition:transform .16s,background .16s,box-shadow .16s}',
      '.__ss_switch[aria-checked="true"] .__ss_switchTrack{background:color-mix(in srgb,var(--ss_accent) 26%,var(--dsw-alias-bg-layer-3,#212429));border-color:var(--ss_accent)}',
      '.__ss_switch[aria-checked="true"] .__ss_switchTrack::after{transform:translateX(17px);background:var(--ss_accent);box-shadow:0 0 8px var(--ss_accent)}',
      '.__ss_switch[aria-checked="true"] .__ss_switchLabel{color:var(--dsw-alias-label-primary,#e8eaed)}',
      '.__ss_switchText{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.__ss_switchLabel{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#b9bec7);transition:color .16s}',
      '.__ss_switch:hover .__ss_switchTrack{border-color:var(--ss_accent)}',
      '.__ss_switch .__ss_hint{margin-top:1px}',
      '.__ss_switch.__ss_changed .__ss_switchLabel::after{content:" · 未保存";font-size:10px;font-weight:400;letter-spacing:.02em;color:var(--ss_accent)}',
      '.__ss_changed .__ss_switchTrack{border-color:color-mix(in srgb,var(--ss_accent) 55%,var(--dsw-alias-border-l3,rgba(255,255,255,.14)))}',
      /* 滑杆 */
      '.__ss_sliderRow{display:flex;align-items:center;gap:12px;min-width:0}',
      '.__ss_range{-webkit-appearance:none;appearance:none;flex:1 1 auto;min-width:110px;height:20px;margin:0;background:transparent;cursor:pointer}',
      '.__ss_range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(90deg,var(--ss_accent) 0 var(--ss_p,50%),var(--dsw-alias-border-l2,rgba(255,255,255,.1)) var(--ss_p,50%) 100%)}',
      '.__ss_range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;margin-top:-4.5px;border-radius:50%;background:var(--dsw-alias-label-primary,#e8eaed);border:2px solid var(--ss_accent);box-shadow:0 0 9px color-mix(in srgb,var(--ss_accent) 60%,transparent);transition:transform .12s}',
      '.__ss_range:hover::-webkit-slider-thumb{transform:scale(1.08)}',
      '.__ss_range:focus-visible{outline:2px solid color-mix(in srgb,var(--ss_accent) 55%,transparent);outline-offset:3px;border-radius:999px}',
      '.__ss_range:disabled{opacity:.45;cursor:not-allowed}',
      '.__ss_readout{flex:0 0 auto;min-width:56px;text-align:right;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      /* 颜色选择器 */
      '.__ss_colorRow{display:flex;align-items:center;gap:8px;min-width:0}',
      '.__ss_swatchWrap{position:relative;flex:0 0 auto;width:36px;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.25) inset}',
      '.__ss_swatchWrap::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.22),transparent 55%);pointer-events:none}',
      '.__ss_swatchEmpty::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(0,0,0,.34) 0 3px,transparent 3px 8px);pointer-events:none}',
      '.__ss_swatchEmpty::after{background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 55%)}',
      '.__ss_swatchInput{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);border:0;padding:0;background:transparent;opacity:0;cursor:pointer}',
      '.__ss_colorHex{flex:1 1 auto;min-width:84px}',
      '.__ss_clearBtn{flex:0 0 auto;width:28px;height:28px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:transparent;color:var(--dsw-alias-label-tertiary,#8b909a);font:inherit;font-size:12px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .14s,border-color .14s}',
      '.__ss_clearBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.14))}',
      '.__ss_clearBtn:disabled{opacity:.35;cursor:not-allowed}',
      /* 预设色卡 */
      '.__ss_presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '.__ss_preset{position:relative;display:flex;flex-direction:column;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;overflow:hidden;background:var(--ss_p_bg,var(--dsw-alias-bg-layer-1,#16181d));color:var(--ss_p_text,var(--dsw-alias-label-primary,#e8eaed));font:inherit;text-align:left;cursor:pointer;transition:transform .13s,border-color .13s,box-shadow .13s}',
      '.__ss_preset:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--ss_p_accent,#fff) 62%,transparent)}',
      '.__ss_preset[aria-pressed="true"]{border-color:var(--ss_p_accent,#fff);box-shadow:0 0 0 1px var(--ss_p_accent,#fff),0 8px 20px -10px color-mix(in srgb,var(--ss_p_accent,#fff) 60%,transparent)}',
      '.__ss_presetBand{display:block;height:34px;background:linear-gradient(135deg,var(--ss_p_accent,#444),var(--ss_p_accent2,#888))}',
      '.__ss_presetBody{display:flex;flex-direction:column;gap:2px;padding:8px 10px 9px;background:linear-gradient(180deg,color-mix(in srgb,var(--ss_p_bg,#111) 88%,#000),var(--ss_p_bg,#111))}',
      '.__ss_presetName{font-size:12.5px;font-weight:600;letter-spacing:.02em;line-height:1.25}',
      '.__ss_presetEn{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.62;line-height:1.3}',
      '.__ss_presetCheck{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:var(--ss_p_accent,#fff);color:#0a0705;font-size:11px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.72);transition:opacity .15s,transform .15s;box-shadow:0 0 10px var(--ss_p_accent,#fff);pointer-events:none}',
      '.__ss_preset[aria-pressed="true"] .__ss_presetCheck{opacity:1;transform:none}',
      '.__ss_customTag{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b909a);line-height:1.5}',
      '.__ss_customTag::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--ss_accent);box-shadow:0 0 7px var(--ss_accent);flex:0 0 auto}',
      /* 小标题 / 提示块 */
      '.__ss_subhead{display:flex;align-items:center;gap:9px;margin:7px 0 -3px;font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_subhead::after{content:"";flex:1 1 auto;height:1px;background:var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.__ss_note{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;padding:10px 12px;background:color-mix(in srgb,var(--ss_accent) 5%,transparent);display:flex;flex-direction:column;gap:5px;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_noteTitle{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ss_accent)}',
      '.__ss_noteWarn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#fac053) 40%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)));background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#fac053) 8%,transparent)}',
      '.__ss_noteWarn .__ss_noteTitle{color:var(--dsw-alias-state-warn-primary,#fac053)}',
      /* 关于页 */
      '.__ss_aboutRow{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:6px 0;border-bottom:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.06));min-width:0}',
      '.__ss_aboutRow:last-of-type{border-bottom:0}',
      '.__ss_aboutK{flex:0 0 auto;font-size:12px;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_aboutV{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap;text-align:right;font-size:12px;color:var(--dsw-alias-label-primary,#e8eaed);min-width:0;word-break:break-all}',
      '.__ss_file{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:11px;line-height:1.5;letter-spacing:.01em;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_copyBtn{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:transparent;color:var(--dsw-alias-label-secondary,#b9bec7);border-radius:6px;font:inherit;font-size:11px;padding:3px 8px;cursor:pointer}',
      '.__ss_copyBtn:hover:not(:disabled){border-color:var(--ss_accent);color:var(--dsw-alias-label-primary)}',
      '.__ss_copyBtn:disabled{opacity:.4;cursor:not-allowed}',
      '.__ss_confirmRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 9%,transparent)}',
      '.__ss_confirmText{flex:1 1 220px;font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_actionsRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      /* 按钮 */
      '.__ss_btn{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-3,#212429);color:var(--dsw-alias-label-primary,#e8eaed);border-radius:8px;padding:6px 14px;font:inherit;font-size:12.5px;line-height:1.4;cursor:pointer;transition:border-color .14s,background .14s,opacity .14s;text-decoration:none;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
      '.__ss_btn:hover:not(:disabled){border-color:var(--ss_accent);color:var(--dsw-alias-label-primary)}',
      '.__ss_btn:disabled{opacity:.45;cursor:not-allowed}',
      '.__ss_btn:active:not(:disabled){transform:translateY(1px)}',
      '.__ss_btnPrimary{border-color:var(--ss_accent);background:var(--ss_accent);color:#0a0705;font-weight:600}',
      '.__ss_btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--ss_accent) 84%,#fff);border-color:color-mix(in srgb,var(--ss_accent) 84%,#fff)}',
      '.__ss_btnDanger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,var(--dsw-alias-bg-layer-3,#212429));color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_btnGhost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_btnGhost:hover:not(:disabled){border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary)}',
      '.__ss_linkBtn{font-size:12px}',
      /* 底部吸底保存条 */
      '.__ss_bar{position:sticky;bottom:0;z-index:7;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px 12px;margin-top:2px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-bottom:0;border-radius:12px 12px 0 0;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-bg-layer-3,#212429) 96%,transparent),var(--dsw-alias-bg-layer-3,#212429));box-shadow:0 -10px 24px -18px rgba(0,0,0,.85)}',
      '.__ss_bar::after{content:"";position:absolute;left:0;right:0;top:100%;height:84px;background:var(--dsw-alias-bg-base,#101216);pointer-events:none}',
      '.__ss_bar[data-dirty="true"]{border-color:color-mix(in srgb,var(--ss_accent) 45%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)));box-shadow:0 0 0 1px color-mix(in srgb,var(--ss_accent) 18%,transparent) inset,0 -8px 24px -16px rgba(0,0,0,.85)}',
      '.__ss_barState{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary,#b9bec7)}',
      '.__ss_barStateLine{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}',
      '.__ss_barError{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#f85149);word-break:break-word}',
      '.__ss_barActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}',
      '.__ss_pulse{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--ss_accent);box-shadow:0 0 8px var(--ss_accent);animation:__ss_pulse 1.6s ease-in-out infinite}',
      '@keyframes __ss_pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '/* 系统要求减少动态时，面板自身的脉冲/转圈/微光全部停掉 */',
      '@media (prefers-reduced-motion: reduce){.__ss_pulse,.__ss_spinner{animation:none!important}}',
      '.__ss_dirtyText{color:var(--ss_accent);font-weight:600}',
      '.__ss_okText{color:var(--dsw-alias-state-success-primary,#6ed889)}',
      '.__ss_err{color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_ok{color:var(--dsw-alias-state-success-primary,#6ed889);font-size:12px}',
      '.__ss_spinner{flex:0 0 auto;width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,var(--ss_accent) 28%,transparent);border-top-color:var(--ss_accent);animation:__ss_spin .8s linear infinite;display:inline-block}',
      '@keyframes __ss_spin{to{transform:rotate(360deg)}}',
      /* 骨架屏 */
      '.__ss_loadingLine{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      '.__ss_skGroup{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-layer-1,#16181d)}',
      '.__ss_skBlock{height:13px;border-radius:6px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-3,#212429) 0%,color-mix(in srgb,var(--dsw-alias-bg-layer-3,#212429) 78%,#fff 8%) 45%,var(--dsw-alias-bg-layer-3,#212429) 100%);background-size:200% 100%;animation:__ss_shimmer 1.5s linear infinite}',
      '.__ss_skBlockTall{height:34px}',
      '@keyframes __ss_shimmer{0%{background-position:140% 0}100%{background-position:-40% 0}}',
      /* 错误卡片 */
      '.__ss_errorCard{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 46%,var(--dsw-alias-border-l2,rgba(255,255,255,.1)));border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 7%,var(--dsw-alias-bg-layer-1,#16181d))}',
      '.__ss_errorTitle{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_errorText{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:11.5px;line-height:1.6;word-break:break-word;color:var(--dsw-alias-label-secondary,#b9bec7);padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.22)}',
      '.__ss_errorHint{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#8b909a)}',
      /* 窄屏 */
      '@media (max-width:560px){.__ss_grid2{grid-template-columns:1fr}.__ss_presets{grid-template-columns:repeat(2,minmax(0,1fr))}.__ss_bar{align-items:flex-start}.__ss_barActions{margin-left:0;width:100%}}'
    ].join('')
    var cssTagId = CSS_TAG_ID
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + cssTagId + '"]') === null) {
      var styleTag = document.createElement('style')
      styleTag.dataset.plugin = 'dsh-supreme-command'
      styleTag.dataset.pluginCss = cssTagId
      styleTag.textContent = CSS
      ;(document.head || document.documentElement).appendChild(styleTag)
    }

    /* ── 小工具 ──────────────────────────────────────────────────────────── */
    function cx() {
      var out = []
      for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i])
      return out.join(' ')
    }
    function num(value, fallback) {
      var n = Number(value)
      return isFinite(n) ? n : fallback
    }
    function text(value) {
      return value == null ? '' : String(value)
    }
    function fieldId(key) {
      return '__ss_f_' + key
    }
    /** 把 color input 需要的 #rrggbb 压出来（3 位补全，其它非法值给 null）。 */
    function hex6(value) {
      var s = text(value).trim()
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
      if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase()
      }
      return null
    }
    function looksLikeColor(value) {
      return /^#[0-9a-fA-F]{3,8}$/.test(text(value).trim())
    }
    /** statusLines：Host 可能给字符串，也可能给字符串数组；统一成 \n 分隔的字符串。 */
    function toLines(value) {
      if (Array.isArray(value)) return value.map(text).join('\n')
      return text(value)
    }
    function linesOf(value) {
      return toLines(value).split('\n')
    }
    function friendlyError(err) {
      if (!err) return '未知错误'
      var msg = err && err.message ? String(err.message) : String(err)
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return '网络请求失败（Host 半侧没起来，或 /dsh-command 路由不可达）'
      return msg
    }
    function readInjectedVersion() {
      try {
        var v = window.__DSH_COMMAND_VERSION__
        return v ? String(v) : ''
      } catch (e) { return '' }
    }
    function clockText(date) {
      if (!date) return ''
      var p = function (n) { return (n < 10 ? '0' : '') + n }
      return p(date.getHours()) + ':' + p(date.getMinutes()) + ':' + p(date.getSeconds())
    }
    function sameValue(a, b) {
      return a === b || (a == null && b == null)
    }
    function jumpToGroup(key) {
      if (typeof document === 'undefined' || !document.getElementById) return
      var node = document.getElementById('__ss_group_' + key)
      if (!node) return
      if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }

    /* ── 配置兜底（只兜非预设色字段：预设色板永远来自 API 的 presets） ────── */
    var FALLBACK = {
      enabled: true,
      splashEnabled: true,
      mode: 'session',
      speed: 1,
      allowSkip: true,
      preset: 'command-red',
      accent: '',
      accent2: '',
      bgBase: '',
      textPrimary: '',
      themeMode: 'force-dark',
      glow: 1,
      scanlines: 0.5,
      grain: 0.35,
      vignette: 0.6,
      watermark: true,
      cornerLogo: true,
      modelLogo: true,
      showModel: true,
      autoFullscreen: true,
      hudFrames: true,
      titleZh: '智能量子计算机',
      titleZh2: '重点实验室',
      subtitleEn: 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER',
      org: 'DEEPSEEK HARNESS',
      orgZh: '深度求索',
      clearLevel: '绝密 / TOP SECRET',
      operator: '操作员',
      operatorId: '0000',
      footer: 'POWERED BY DEEPSEEK',
      statusLines: '建立安全信道 … OK\n校验操作员生物签名 … OK\n解密绝密指令包 … OK\n载入 HARNESS 运行时 … OK',
      showUeg: true,
      showBsc: true,
      logoColor: 'accent',
      logoCustom: '',
      sound: true,
      soundVolume: 0.4,
      voice: true,
      voiceLang: 'zh',
      voiceName: '',
      voiceRate: 0.88,
      voicePitch: 0.85,
      voiceVolume: 0.9,
      voiceCue: true,
      voiceLead: 240,
      voiceSource: 'tts',
      voiceLine1: '智能量子计算机重点实验室，绝密。',
      voiceLine2: '操作员 {operator}，北京航天中心，权限验证通过。',
      voiceLine3: '授权通过，正在进入系统。',
      voiceLine1En: 'Key Laboratory of Intelligent Quantum Computer. Top secret.',
      voiceLine2En: 'Operator {operator}. Beijing Space Center. Clearance verified.',
      voiceLine3En: 'Authorization granted. Entering system.',
      badge: true,
      badgeName: '图恒宇',
      badgeId: 'IDL.IQC-001',
      badgeNo: '222179',
      badgePinyin: 'TU HENGYU',
      badgeOrg: '北京航天中心',
      badgeOrgEn: 'BEIJING SPACE CENTER',
      badgeLab: '智能量子计算机重点实验室',
      badgeLabEn: 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER',
      badgeLabShort: 'IQC',
      badgeRole: '研究员',
      badgeClearance: 'L1',
      badgeHold: 2400
    }
    var BOOL_KEYS = ['enabled', 'splashEnabled', 'allowSkip', 'hudFrames', 'watermark', 'cornerLogo', 'modelLogo', 'showModel', 'autoFullscreen', 'badge', 'showUeg', 'showBsc', 'sound', 'voice', 'voiceCue']
    var NUM_KEYS = ['speed', 'glow', 'scanlines', 'grain', 'vignette', 'soundVolume', 'voiceRate', 'voicePitch', 'voiceVolume', 'voiceLead', 'badgeHold']
    var COLOR_KEYS = ['accent', 'accent2', 'bgBase', 'textPrimary', 'logoCustom']

    function normalizeConfig(raw, defaults) {
      var cfg = Object.assign({}, FALLBACK)
      var src = raw && typeof raw === 'object' ? raw : {}
      var defs = defaults && typeof defaults === 'object' ? defaults : {}
      Object.keys(FALLBACK).forEach(function (key) {
        if (src[key] !== undefined && src[key] !== null) cfg[key] = src[key]
        else if (defs[key] !== undefined && defs[key] !== null) cfg[key] = defs[key]
      })
      cfg.statusLines = toLines(cfg.statusLines)
      COLOR_KEYS.forEach(function (key) {
        cfg[key] = typeof cfg[key] === 'string' ? cfg[key].trim() : ''
        if (cfg[key] && !looksLikeColor(cfg[key])) cfg[key] = ''
      })
      NUM_KEYS.forEach(function (key) { cfg[key] = num(cfg[key], FALLBACK[key]) })
      BOOL_KEYS.forEach(function (key) { cfg[key] = cfg[key] !== false })
      if (!cfg.mode) cfg.mode = FALLBACK.mode
      if (!cfg.themeMode) cfg.themeMode = FALLBACK.themeMode
      if (!cfg.logoColor) cfg.logoColor = FALLBACK.logoColor
      if (!cfg.preset) cfg.preset = FALLBACK.preset
      return cfg
    }

    /* ── 网络 ────────────────────────────────────────────────────────────── */
    function request(method, body) {
      var options = { method: method, headers: { Accept: 'application/json' }, cache: 'no-store' }
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
      }
      return fetch(API, options).then(function (response) {
        return response.json().catch(function () {
          throw new Error('HTTP ' + response.status + '：响应不是合法 JSON')
        }).then(function (json) {
          if (!json || json.ok !== true) {
            throw new Error((json && json.error) || ('HTTP ' + response.status))
          }
          return json
        })
      })
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: cx('__ss_field', props.changed && '__ss_changed', props.className) },
        h('div', { className: '__ss_labelRow' },
          h('label', { className: '__ss_label', htmlFor: props.htmlFor },
            h('span', { className: '__ss_dot', 'aria-hidden': 'true' }),
            props.label
          ),
          props.changed ? h('span', { className: '__ss_changedTag' }, '未保存') : null
        ),
        props.children,
        props.hint ? h('div', { className: '__ss_hint' }, props.hint) : null
      )
    }

    function TextField(props) {
      var id = fieldId(props.field)
      return h(Field, {
        label: props.label,
        hint: props.hint,
        changed: props.changed,
        htmlFor: id
      }, h('input', {
        id: id,
        'data-field': props.field,
        className: cx('__ss_input', props.mono && '__ss_mono'),
        type: 'text',
        value: text(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        autoComplete: 'off',
        onChange: function (e) { props.onChange(e.target.value) }
      }))
    }

    function TextAreaField(props) {
      var id = fieldId(props.field)
      var lineCount = linesOf(props.value).filter(function (line) { return line.trim() !== '' }).length
      return h(Field, {
        label: props.label,
        changed: props.changed,
        htmlFor: id,
        hint: props.hint
      },
        h('textarea', {
          id: id,
          'data-field': props.field,
          className: '__ss_input __ss_textarea',
          value: text(props.value),
          rows: props.rows || 5,
          spellCheck: false,
          onChange: function (e) { props.onChange(e.target.value) }
        }),
        h('div', { className: '__ss_counter' }, lineCount + ' 行有效指令 · 空行会被忽略')
      )
    }

    function SelectField(props) {
      var id = fieldId(props.field)
      return h(Field, {
        label: props.label,
        hint: props.hint,
        changed: props.changed,
        htmlFor: id
      }, h('select', {
        id: id,
        'data-field': props.field,
        className: '__ss_input __ss_select',
        value: text(props.value),
        disabled: !!props.disabled,
        onChange: function (e) { props.onChange(e.target.value) }
      }, (props.options || []).map(function (option) {
        return h('option', { key: option[0], value: option[0] }, option[1])
      })))
    }

    function Segmented(props) {
      return h('div', { className: '__ss_seg', role: 'group', 'aria-label': props.label || '' },
        props.options.map(function (option) {
          return h('button', {
            key: option[0],
            type: 'button',
            className: '__ss_segBtn',
            'aria-pressed': props.value === option[0] ? 'true' : 'false',
            'data-value': option[0],
            'data-field': props.field,
            title: option[2] || '',
            disabled: !!props.disabled,
            onClick: function () { props.onChange(option[0]) }
          }, option[1])
        })
      )
    }

    function Switch(props) {
      return h('button', {
        type: 'button',
        className: cx('__ss_switch', props.changed && '__ss_changed'),
        role: 'switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'data-field': props.field,
        onClick: function () { props.onChange(!props.checked) }
      },
        h('span', { className: '__ss_switchTrack', 'aria-hidden': 'true' }),
        h('span', { className: '__ss_switchText' },
          h('span', { className: '__ss_switchLabel' }, props.label),
          props.hint ? h('span', { className: '__ss_hint' }, props.hint) : null
        )
      )
    }

    function Slider(props) {
      var min = props.min
      var max = props.max
      var value = num(props.value, props.fallback == null ? min : props.fallback)
      if (value < min) value = min
      if (value > max) value = max
      var pct = max === min ? 0 : ((value - min) / (max - min)) * 100
      var id = fieldId(props.field)
      return h(Field, {
        label: props.label,
        hint: props.hint,
        changed: props.changed,
        htmlFor: id
      }, h('div', { className: '__ss_sliderRow' },
        h('input', {
          id: id,
          'data-field': props.field,
          className: '__ss_range',
          type: 'range',
          min: min,
          max: max,
          step: props.step,
          value: value,
          disabled: !!props.disabled,
          'aria-label': props.label,
          style: { '--ss_p': pct.toFixed(2) + '%' },
          onChange: function (e) { props.onChange(Number(e.target.value)) }
        }),
        h('span', { className: '__ss_readout' }, props.display(value))
      ))
    }

    function ColorField(props) {
      var value = text(props.value).trim()
      var resolved = value || text(props.fallback)
      var swatchValue = hex6(resolved) || '#000000'
      var invalid = value !== '' && !looksLikeColor(value)
      var hint = props.hint
      if (invalid) hint = '色值格式不对，应为 #rrggbb（当前：' + value + '）。' + (hint ? ' ' + hint : '')
      return h(Field, { label: props.label, hint: hint, changed: props.changed },
        h('div', { className: '__ss_colorRow' },
          h('span', {
            className: cx('__ss_swatchWrap', !value && '__ss_swatchEmpty'),
            style: resolved ? { background: swatchValue } : undefined,
            title: value ? value : ('跟随预设：' + (props.fallback || '未知'))
          }, h('input', {
            'data-field': props.field,
            className: '__ss_swatchInput',
            type: 'color',
            value: swatchValue,
            disabled: !!props.disabled,
            'aria-label': props.label + ' 取色器',
            onChange: function (e) { props.onChange(e.target.value) }
          })),
          h('input', {
            'data-field': props.field + '-hex',
            className: cx('__ss_input', '__ss_mono', '__ss_colorHex', invalid && '__ss_inputBad'),
            type: 'text',
            value: value,
            placeholder: props.fallback ? ('预设 ' + props.fallback) : '留空 = 用预设值',
            spellCheck: false,
            autoComplete: 'off',
            maxLength: 9,
            disabled: !!props.disabled,
            'aria-label': props.label + ' 十六进制值',
            onChange: function (e) { props.onChange(e.target.value.trim()) }
          }),
          props.clearable ? h('button', {
            type: 'button',
            className: '__ss_clearBtn',
            'data-action': 'clear-' + props.field,
            title: '清空 → 跟随预设值',
            'aria-label': '清空' + props.label,
            disabled: !!props.disabled || value === '',
            onClick: function () { props.onChange('') }
          }, '✕') : null
        )
      )
    }

    function PresetCard(props) {
      var preset = props.preset
      var selected = !!props.selected
      return h('button', {
        type: 'button',
        className: '__ss_preset',
        'aria-pressed': selected ? 'true' : 'false',
        'data-preset-id': props.presetId,
        title: preset.label + ' · ' + preset.labelEn,
        style: {
          '--ss_p_accent': preset.accent || 'transparent',
          '--ss_p_accent2': preset.accent2 || preset.accent || 'transparent',
          '--ss_p_bg': preset.bg || undefined,
          '--ss_p_text': preset.text || undefined
        },
        onClick: props.onSelect
      },
        h('span', { className: '__ss_presetBand', 'aria-hidden': 'true' }),
        h('span', { className: '__ss_presetCheck', 'aria-hidden': 'true' }, '✓'),
        h('span', { className: '__ss_presetBody' },
          h('span', { className: '__ss_presetName' }, text(preset.label)),
          h('span', { className: '__ss_presetEn' }, text(preset.labelEn))
        )
      )
    }

    function Group(props) {
      return h('section', {
        className: cx('__ss_group', props.changedCount > 0 && '__ss_groupChanged'),
        id: '__ss_group_' + props.groupKey,
        'aria-label': props.title
      },
        h('div', { className: '__ss_gh' },
          h('span', { className: '__ss_ghMark', 'aria-hidden': 'true' }),
          h('span', { className: '__ss_ghTitle' }, props.title),
          props.titleEn ? h('span', { className: '__ss_ghEn' }, props.titleEn) : null,
          h('span', { className: '__ss_ghLine', 'aria-hidden': 'true' }),
          props.changedCount > 0 ? h('span', { className: '__ss_ghBadge' }, props.changedCount + ' 项未保存') : null
        ),
        props.children
      )
    }

    function SubHead(props) {
      return h('div', { className: '__ss_subhead' }, props.children)
    }

    function Head(props) {
      return h('div', { className: '__ss_head' },
        h('div', { className: '__ss_brand' },
          h('div', { className: '__ss_kicker' }, '智能量子计算机 · 重点实验室'),
          h('div', { className: '__ss_title' }, '流浪地球主题'),
          h('div', { className: '__ss_sub' }, props.sub || '统一调整启动屏与 DSH 界面皮肤：配色、质感、文案与音效。改动保存后写入配置文件。')
        ),
        h('div', { className: '__ss_verChip', title: 'dsh-supreme-command 插件版本' }, 'v' + (props.version || FALLBACK_VERSION))
      )
    }

    function SkeletonGroup(props) {
      var rows = []
      for (var i = 0; i < (props.rows || 3); i++) rows.push(i)
      return h('div', { className: '__ss_skGroup', 'aria-hidden': 'true' },
        h('div', { className: '__ss_skBlock', style: { width: '26%' } }),
        rows.map(function (index) {
          return h('div', {
            key: 'sk' + index,
            className: cx('__ss_skBlock', index === 0 && '__ss_skBlockTall'),
            style: { width: (index === 0 ? 66 : 100 - index * 9) + '%' }
          })
        })
      )
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [base, setBase] = react.useState(null)
      var [presets, setPresets] = react.useState({})
      var [file, setFile] = react.useState('')
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [loading, setLoading] = react.useState(true)
      var [loadError, setLoadError] = react.useState(null)
      var [saveError, setSaveError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      var [confirmReset, setConfirmReset] = react.useState(false)
      var [savedAt, setSavedAt] = react.useState(null)
      var [voiceList, setVoiceList] = react.useState([])

      /* 系统音色：浏览器里随时可读（首次可能为空，等 voiceschanged 再刷一次） */
      react.useEffect(function () {
        function load() {
          try {
            var ss = window.speechSynthesis
            var list = ss ? ss.getVoices() || [] : []
            setVoiceList(list.map(function (v) {
              return { name: v.name, lang: v.lang, local: !!v.localService }
            }))
          } catch (e) { /* 隐私模式/无语音引擎：保持空列表 */ }
        }
        load()
        try {
          if (window.speechSynthesis) window.speechSynthesis.addEventListener('voiceschanged', load)
          return function () {
            try { window.speechSynthesis.removeEventListener('voiceschanged', load) } catch (e) { /* noop */ }
          }
        } catch (e) { return undefined }
      }, [])

      function absorb(json) {
        var nextPresets = json && json.presets && typeof json.presets === 'object' ? json.presets : {}
        var cfg = normalizeConfig(json && json.config, json && json.defaults)
        setPresets(nextPresets)
        setBase(cfg)
        setDraft(cfg)
        setFile(json && json.file ? text(json.file) : '')
        if (json && json.version) setVersion(text(json.version))
        setConfirmReset(false)
      }

      function load() {
        setLoading(true)
        setLoadError(null)
        setSaveError(null)
        setNotice(null)
        setConfirmReset(false)
        request('GET').then(function (json) {
          absorb(json)
          setSavedAt(null)
          setLoading(false)
        }).catch(function (err) {
          setLoading(false)
          setLoadError(friendlyError(err))
        })
      }

      react.useEffect(function () { load() }, [])

      var dirtyKeys = react.useMemo(function () {
        if (!draft || !base) return []
        var list = []
        Object.keys(draft).forEach(function (key) {
          if (!sameValue(draft[key], base[key])) list.push(key)
        })
        return list
      }, [draft, base])

      var dirty = dirtyKeys.length > 0
      function changed(key) { return dirtyKeys.indexOf(key) !== -1 }

      function set(key, value) {
        setNotice(null)
        setSaveError(null)
        setDraft(function (current) {
          if (!current) return current
          var next = Object.assign({}, current)
          next[key] = value
          /* 手动改任意基色 = 离开预设，落到 custom（契约 §3） */
          if (COLOR_KEYS.indexOf(key) !== -1) next.preset = 'custom'
          return next
        })
      }

      function choosePreset(presetId) {
        var preset = presets[presetId]
        if (!preset) return
        setNotice(null)
        setSaveError(null)
        setDraft(function (current) {
          if (!current) return current
          var next = Object.assign({}, current)
          next.preset = presetId
          next.accent = text(preset.accent)
          next.accent2 = text(preset.accent2)
          /* bgBase / textPrimary 留空 = 用预设值（契约 §2） */
          next.bgBase = ''
          next.textPrimary = ''
          return next
        })
      }

      function save() {
        if (!draft || busy) return
        setBusy(true)
        setSaveError(null)
        setNotice(null)
        request('POST', { patch: draft }).then(function (json) {
          absorb(json)
          setSavedAt(new Date())
          /* 保存成功不用再弹文字：吸底条左侧会变成「✓ 已保存 · HH:MM:SS」 */
        }).catch(function (err) {
          setSaveError(friendlyError(err))
        }).then(function () {
          setBusy(false)
        })
      }

      function doReset() {
        if (busy) return
        setBusy(true)
        setSaveError(null)
        setNotice(null)
        setConfirmReset(false)
        request('POST', { action: 'reset' }).then(function (json) {
          absorb(json)
          setSavedAt(new Date())
          setNotice('已恢复默认配置')
        }).catch(function (err) {
          setSaveError(friendlyError(err))
        }).then(function () {
          setBusy(false)
        })
      }

      function discard() {
        if (!base) return
        setDraft(Object.assign({}, base))
        setSaveError(null)
        setNotice('已放弃修改')
      }

      function replaySplash() {
        setSaveError(null)
        var api = null
        try { api = window.__DSC_SPLASH__ } catch (e) { api = null }
        if (api && typeof api.replay === 'function') {
          try {
            api.replay()
            setNotice('已请求重播启动屏')
            return
          } catch (e) { /* 掉到下面的兜底提示 */ }
        }
        setNotice('当前页面没有可重播的启动屏（刷新后通常已播放完）。保存后刷新页面即可看到新版。')
      }

      /* 试听：直接用 draft 里的音色/语速参数念第 1 句（不需要保存） */
      function previewVoice() {
        setSaveError(null)
        try {
          var ss = window.speechSynthesis
          if (!ss || typeof window.SpeechSynthesisUtterance !== 'function') {
            setNotice('当前环境没有语音合成能力（speechSynthesis 不可用）')
            return
          }
          var d = draft || {}
          var line = voiceInterpolate(d.voiceLine1 || '').trim()
          if (!line) { setNotice('第 1 句台词是空的，先填点东西'); return }
          ss.cancel()
          var u = new window.SpeechSynthesisUtterance(line)
          u.rate = num(d.voiceRate, 0.88)
          u.pitch = num(d.voicePitch, 0.85)
          u.volume = num(d.voiceVolume, 0.9)
          u.lang = d.voiceLang === 'en' ? 'en-US' : 'zh-CN'
          var list = []
          try { list = ss.getVoices() || [] } catch (e2) { list = [] }
          var chosen = null
          var i
          if (d.voiceName) {
            for (i = 0; i < list.length; i++) { if (list[i].name === d.voiceName) { chosen = list[i]; break } }
          }
          if (!chosen) {
            var want = (d.voiceLang === 'en' ? 'en' : 'zh')
            for (i = 0; i < list.length; i++) {
              if (String(list[i].lang || '').toLowerCase().indexOf(want) === 0) { chosen = list[i]; break }
            }
          }
          if (chosen) u.voice = chosen
          ss.speak(u)
          setNotice('已试听第 1 句：' + line)
        } catch (e) {
          setNotice('试听失败：' + (e && e.message ? e.message : e))
        }
      }

      /* 台词占位符：与 splash.js 同一套（{operator} / {id} / {titleZh} / {titleZh2} / {clearLevel} / {org}） */
      function voiceInterpolate(text) {
        var d = draft || {}
        var dict = {
          operator: d.operator, id: d.operatorId, titleZh: d.titleZh,
          titleZh2: d.titleZh2, clearLevel: d.clearLevel, org: d.org
        }
        return String(text == null ? '' : text).replace(/\{([A-Za-z]+)\}/g, function (all, key) {
          return dict[key] == null ? all : String(dict[key])
        })
      }

      function copyFile() {
        var value = file
        if (!value) return
        var done = function () { setNotice('配置文件路径已复制') }
        var fail = function () { setNotice('复制失败，请手动选中路径复制') }
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(value).then(done, fail)
            return
          }
        } catch (e) { /* 隐私模式等直接走 fail */ }
        fail()
      }

      /* ── 加载态 / 错误态：绝不白屏 ── */
      if (!draft) {
        if (loadError) {
          return h('div', { className: '__ss_root' },
            h(Head, { version: version, sub: '设置面板读不到 Host 的配置接口。' }),
            h('div', { className: '__ss_errorCard' },
              h('div', { className: '__ss_errorTitle' }, '⚠ 读取配置失败'),
              h('div', { className: '__ss_errorText' }, loadError),
              h('div', { className: '__ss_errorHint' }, '通常是 Host 半侧没启动，或 /dsh-command/config 路由不可用。修好后点「重试」；也可以直接检查插件配置目录下的 dsh-supreme-command.json。'),
              h('div', { className: '__ss_row' },
                h('button', { type: 'button', className: '__ss_btn __ss_btnPrimary', 'data-action': 'retry', onClick: load }, '重试'),
                h('button', { type: 'button', className: '__ss_btn', onClick: function () { window.location.reload() } }, '刷新页面')
              )
            )
          )
        }
        return h('div', { className: '__ss_root' },
          h(Head, { version: version, sub: '正在读取配置…' }),
          h(SkeletonGroup, { rows: 3 }),
          h(SkeletonGroup, { rows: 4 }),
          h('div', { className: '__ss_loadingLine' },
            h('span', { className: '__ss_spinner', 'aria-hidden': 'true' }),
            '正在读取 /dsh-command/config'
          )
        )
      }

      var presetEntries = Object.keys(presets).map(function (id) { return { id: id, preset: presets[id] } })
      var activePreset = presets[draft.preset] || (presetEntries[0] && presetEntries[0].preset) || {}
      var effectiveAccent = draft.accent || text(activePreset.accent)
      var effectiveAccent2 = draft.accent2 || text(activePreset.accent2) || effectiveAccent
      var effectiveBg = draft.bgBase || text(activePreset.bg)
      var effectiveText = draft.textPrimary || text(activePreset.text)
      var isCustomPreset = !presets[draft.preset]

      var rootStyle = {}
      if (effectiveAccent) rootStyle['--ss_accent'] = effectiveAccent
      if (effectiveAccent2) rootStyle['--ss_accent2'] = effectiveAccent2

      var COLOR_FIELDS = ['enabled', 'preset', 'accent', 'accent2', 'bgBase', 'textPrimary', 'themeMode']
      var QUALITY_FIELDS = ['glow', 'scanlines', 'grain', 'vignette', 'hudFrames', 'watermark', 'cornerLogo', 'modelLogo']
      var SPLASH_FIELDS = ['splashEnabled', 'mode', 'speed', 'allowSkip', 'titleZh', 'titleZh2', 'subtitleEn', 'org', 'orgZh', 'clearLevel', 'operator', 'operatorId', 'footer', 'statusLines', 'showUeg', 'showBsc', 'logoColor', 'logoCustom', 'sound', 'soundVolume',
        'voice', 'voiceLang', 'voiceName', 'voiceRate', 'voicePitch', 'voiceVolume', 'voiceCue', 'voiceLead', 'voiceSource',
        'voiceLine1', 'voiceLine2', 'voiceLine3', 'voiceLine1En', 'voiceLine2En', 'voiceLine3En',
        'showModel', 'badge', 'badgeName', 'badgeId', 'badgeNo', 'badgePinyin', 'badgeOrg', 'badgeOrgEn',
        'badgeLab', 'badgeLabEn', 'badgeLabShort', 'badgeRole', 'badgeClearance', 'badgeHold']
      function countChanged(list) {
        var count = 0
        for (var i = 0; i < list.length; i++) if (changed(list[i])) count++
        return count
      }

      var GROUPS = [['color', '配色'], ['quality', '质感'], ['splash', '启动屏'], ['about', '关于']]
      var toc = h('div', { className: '__ss_toc', role: 'navigation', 'aria-label': '面板分组' },
        GROUPS.map(function (entry) {
          return h('button', {
            key: entry[0],
            type: 'button',
            className: '__ss_tocItem',
            'data-jump': entry[0],
            onClick: function () { jumpToGroup(entry[0]) }
          }, entry[1])
        })
      )

      var barText
      if (busy) barText = '正在写入配置…'
      else if (dirty) barText = '未保存 · ' + dirtyKeys.length + ' 项变更'
      else if (savedAt) barText = '✓ 已保存 · ' + clockText(savedAt)
      else barText = '配置已是最新'

      var statusLines = toLines(draft.statusLines)

      return h('div', { className: '__ss_root', style: rootStyle, 'data-testid': 'supreme-command-panel' },
        h(Head, { version: version }),
        toc,

        /* ── 配色 ── */
        h(Group, {
          groupKey: 'color',
          title: '配色',
          titleEn: 'Palette',
          changedCount: countChanged(COLOR_FIELDS)
        },
          h(Switch, {
            field: 'enabled',
            label: '启用界面主题（DSH 皮肤）',
            hint: '总开关。关闭后 DSH 界面回到原生配色，启动屏设置不受影响。',
            checked: !!draft.enabled,
            changed: changed('enabled'),
            onChange: function (value) { set('enabled', value) }
          }),
          h('div', { className: '__ss_presets' },
            presetEntries.map(function (entry) {
              return h(PresetCard, {
                key: entry.id,
                presetId: entry.id,
                preset: entry.preset,
                selected: draft.preset === entry.id,
                onSelect: function () { choosePreset(entry.id) }
              })
            })
          ),
          isCustomPreset
            ? h('div', { className: '__ss_customTag' }, '当前为自定义配色（未套用任何预设）——点任意预设可整套恢复。')
            : h('div', { className: '__ss_customTag' },
              '当前预设：' + text(activePreset.label) + '（' + text(activePreset.labelEn) + '）· 选预设会覆盖主/辅色；底色与文字色留空 = 跟随预设。'),
          h(SubHead, null, '基色'),
          h('div', { className: '__ss_grid2' },
            h(ColorField, {
              label: '主色 accent',
              field: 'accent',
              value: draft.accent,
              fallback: text(activePreset.accent),
              changed: changed('accent'),
              hint: 'HUD 线条、按钮、选中态与 Logo 主色。',
              onChange: function (value) { set('accent', value) }
            }),
            h(ColorField, {
              label: '辅色 accent2',
              field: 'accent2',
              value: draft.accent2,
              fallback: text(activePreset.accent2),
              changed: changed('accent2'),
              hint: '渐变、高光与次强调。',
              onChange: function (value) { set('accent2', value) }
            }),
            h(ColorField, {
              label: '底色 bgBase',
              field: 'bgBase',
              value: draft.bgBase,
              fallback: effectiveBg || text(activePreset.bg),
              changed: changed('bgBase'),
              clearable: true,
              hint: '留空 = 用预设底色。',
              onChange: function (value) { set('bgBase', value) }
            }),
            h(ColorField, {
              label: '文字色 textPrimary',
              field: 'textPrimary',
              value: draft.textPrimary,
              fallback: effectiveText || text(activePreset.text),
              changed: changed('textPrimary'),
              clearable: true,
              hint: '留空 = 用预设文字色。',
              onChange: function (value) { set('textPrimary', value) }
            })
          ),
          h(Field, {
            label: '深色策略 themeMode',
            changed: changed('themeMode'),
            hint: '强制深色最稳；跟随系统时浅色环境下 HUD 观感会弱一些。'
          }, h(Segmented, {
            field: 'themeMode',
            label: '深色策略',
            value: draft.themeMode,
            options: [['force-dark', '强制深色', '始终使用深色设置页与主题'], ['auto', '跟随系统', '跟随 DSH / 系统的明暗设置']],
            onChange: function (value) { set('themeMode', value) }
          }))
        ),

        /* ── 质感 ── */
        h(Group, {
          groupKey: 'quality',
          title: '质感',
          titleEn: 'Texture',
          changedCount: countChanged(QUALITY_FIELDS)
        },
          h('div', { className: '__ss_grid2' },
            h(Slider, {
              field: 'glow',
              label: '发光 glow',
              min: 0, max: 2, step: 0.05,
              value: draft.glow, fallback: 1,
              display: function (value) { return value.toFixed(2) },
              changed: changed('glow'),
              hint: '文字 / 线条外发光与扫描线亮度。1 为原设计强度。',
              onChange: function (value) { set('glow', value) }
            }),
            h(Slider, {
              field: 'scanlines',
              label: '扫描线 scanlines',
              min: 0, max: 1, step: 0.01,
              value: draft.scanlines, fallback: 0.5,
              display: function (value) { return Math.round(value * 100) + '%' },
              changed: changed('scanlines'),
              hint: 'CRT 横向扫描纹强度。',
              onChange: function (value) { set('scanlines', value) }
            }),
            h(Slider, {
              field: 'grain',
              label: '颗粒 grain',
              min: 0, max: 1, step: 0.01,
              value: draft.grain, fallback: 0.35,
              display: function (value) { return Math.round(value * 100) + '%' },
              changed: changed('grain'),
              hint: '噪点 / 网格颗粒，让暗部不那么平。',
              onChange: function (value) { set('grain', value) }
            }),
            h(Slider, {
              field: 'vignette',
              label: '暗角 vignette',
              min: 0, max: 1, step: 0.01,
              value: draft.vignette, fallback: 0.6,
              display: function (value) { return Math.round(value * 100) + '%' },
              changed: changed('vignette'),
              hint: '四角压暗，把视线收回中央。',
              onChange: function (value) { set('vignette', value) }
            })
          ),
          h(Switch, {
            field: 'hudFrames',
            label: 'HUD 直角框',
            hint: '面板四角的直角装饰线（启动屏与界面外壳都吃这个值）。',
            checked: !!draft.hudFrames,
            changed: changed('hudFrames'),
            onChange: function (value) { set('hudFrames', value) }
          }),
          h(Switch, {
            field: 'watermark',
            label: '中央机构水印',
            hint: '把启动屏里那层模糊的 UEG 大徽标搬到界面背景，只在空白处淡淡透出来。',
            checked: !!draft.watermark,
            changed: changed('watermark'),
            onChange: function (value) { set('watermark', value) }
          }),
          h(Switch, {
            field: 'cornerLogo',
            label: '角落机构徽标',
            hint: '右上角常驻北京航天中心（BSC）徽标，颜色跟主题走；窄窗口会自动缩小。',
            checked: !!draft.cornerLogo,
            changed: changed('cornerLogo'),
            onChange: function (value) { set('cornerLogo', value) }
          }),
          h(Switch, {
            field: 'modelLogo',
            label: '主机型号标识 550C',
            hint: '左侧导航栏底部常驻 550C 主机型号标识，颜色跟主题走。',
            checked: !!draft.modelLogo,
            changed: changed('modelLogo'),
            onChange: function (value) { set('modelLogo', value) }
          }),
          h(Switch, {
            field: 'autoFullscreen',
            label: '启动时最大化窗口',
            hint: '桌面端启动后把主窗口最大化（不改 DSH 本体，只发一次窗口消息，DSH 更新不受影响）。改动需重启 DSH 生效。',
            checked: !!draft.autoFullscreen,
            changed: changed('autoFullscreen'),
            onChange: function (value) { set('autoFullscreen', value) }
          })
        ),

        /* ── 启动屏 ── */
        h(Group, {
          groupKey: 'splash',
          title: '启动屏',
          titleEn: 'Splash',
          changedCount: countChanged(SPLASH_FIELDS)
        },
          h(Switch, {
            field: 'splashEnabled',
            label: '启用启动屏',
            hint: '关闭后直接进入主界面。',
            checked: !!draft.splashEnabled,
            changed: changed('splashEnabled'),
            onChange: function (value) { set('splashEnabled', value) }
          }),
          !draft.splashEnabled ? h('div', { className: '__ss_note __ss_noteWarn' },
            h('div', { className: '__ss_noteTitle' }, '启动屏已关闭'),
            h('div', null, '下面这些设置暂不生效；重新开启后立即使用当前值。')
          ) : null,
          h(Field, {
            label: '播放时机 mode',
            changed: changed('mode'),
            hint: '「每会话」是默认：同一个浏览器会话里只播一次。'
          }, h(Segmented, {
            field: 'mode',
            label: '播放时机',
            value: draft.mode,
            options: [['always', '每次'], ['session', '每会话'], ['daily', '每天']],
            onChange: function (value) { set('mode', value) }
          })),
          h(Slider, {
            field: 'speed',
            label: '动画速度 speed',
            min: 0.5, max: 2, step: 0.05,
            value: draft.speed, fallback: 1,
            display: function (value) { return value.toFixed(2) + '×' },
            changed: changed('speed'),
            hint: '0.5× 慢放 · 1× 原速 · 2× 快放。文字与时间线一起缩放。',
            onChange: function (value) { set('speed', value) }
          }),
          h(Switch, {
            field: 'allowSkip',
            label: '允许跳过',
            hint: 'Esc 或点击可直接进入主界面。',
            checked: !!draft.allowSkip,
            changed: changed('allowSkip'),
            onChange: function (value) { set('allowSkip', value) }
          }),

          h(SubHead, null, '文案 · 标题与身份'),
          h('div', { className: '__ss_grid2' },
            h(TextField, {
              field: 'titleZh', label: '主标题 · 中文', value: draft.titleZh,
              changed: changed('titleZh'), onChange: function (value) { set('titleZh', value) }
            }),
            h(TextField, {
              field: 'titleZh2', label: '副标题 · 中文', value: draft.titleZh2,
              changed: changed('titleZh2'), onChange: function (value) { set('titleZh2', value) }
            }),
            h(TextField, {
              field: 'org', label: '机构 · 英文', mono: true, value: draft.org,
              changed: changed('org'), onChange: function (value) { set('org', value) }
            }),
            h(TextField, {
              field: 'orgZh', label: '机构 · 中文', value: draft.orgZh,
              changed: changed('orgZh'), onChange: function (value) { set('orgZh', value) }
            }),
            h(TextField, {
              field: 'clearLevel', label: '密级', value: draft.clearLevel,
              changed: changed('clearLevel'), onChange: function (value) { set('clearLevel', value) }
            }),
            h(TextField, {
              field: 'operator', label: '操作员', value: draft.operator,
              changed: changed('operator'), onChange: function (value) { set('operator', value) }
            }),
            h(TextField, {
              field: 'operatorId', label: '操作员编号', mono: true, value: draft.operatorId,
              changed: changed('operatorId'), onChange: function (value) { set('operatorId', value) }
            }),
            h(TextField, {
              field: 'footer', label: '页脚', mono: true, value: draft.footer,
              changed: changed('footer'), onChange: function (value) { set('footer', value) }
            })
          ),
          h(TextField, {
            field: 'subtitleEn', label: '英文副标题', mono: true, maxLength: 80,
            value: draft.subtitleEn, changed: changed('subtitleEn'),
            hint: '显示在中文标题下方的全大写英文行。',
            onChange: function (value) { set('subtitleEn', value) }
          }),
          h(SubHead, null, '状态行 · 逐行播报'),
          h(TextAreaField, {
            field: 'statusLines',
            label: 'statusLines',
            value: statusLines,
            changed: changed('statusLines'),
            rows: 6,
            hint: '每行一条指令，按 \\n 拆分写回配置；启动屏按顺序逐行点亮。',
            onChange: function (value) { set('statusLines', value) }
          }),

          h(SubHead, null, '徽标与声音'),
          h(Switch, {
            field: 'showModel',
            label: '550C 主机型号标识',
            hint: '启动屏左上角显示 550C 主机型号标识（和主题左上角那枚是同一个文件）。',
            checked: !!draft.showModel,
            changed: changed('showModel'),
            onChange: function (value) { set('showModel', value) }
          }),
          h('div', { className: '__ss_grid2' },
            h('div', { className: '__ss_field' },
              h(Switch, {
                field: 'showUeg', label: 'UEG 徽标', checked: !!draft.showUeg,
                changed: changed('showUeg'), onChange: function (value) { set('showUeg', value) }
              })
            ),
            h('div', { className: '__ss_field' },
              h(Switch, {
                field: 'showBsc', label: 'BSC 动画徽标', checked: !!draft.showBsc,
                changed: changed('showBsc'),
                hint: '保留橄榄枝逐叶浮现动画。',
                onChange: function (value) { set('showBsc', value) }
              })
            )
          ),
          h(Field, {
            label: 'Logo 着色 logoColor',
            changed: changed('logoColor'),
            hint: '「自定义」时才使用下面的 logoCustom。'
          }, h(Segmented, {
            field: 'logoColor',
            label: 'Logo 着色',
            value: draft.logoColor,
            options: [['accent', '主色'], ['accent2', '辅色'], ['text', '文字色'], ['custom', '自定义']],
            onChange: function (value) { set('logoColor', value) }
          })),
          h(ColorField, {
            label: '自定义 Logo 颜色',
            field: 'logoCustom',
            value: draft.logoCustom,
            fallback: effectiveAccent,
            changed: changed('logoCustom'),
            disabled: draft.logoColor !== 'custom',
            hint: draft.logoColor === 'custom' ? '仅 logoColor = 自定义 时生效。' : '先把上面的 Logo 着色切到「自定义」才能编辑。',
            onChange: function (value) { set('logoCustom', value) }
          }),
          /* 工牌准入（《流浪地球2》北京航天中心 IQC 实验室胸卡：正反两面、无照片） */
          h(SubHead, {}, '工牌准入 · BADGE'),
          h(Switch, {
            field: 'badge',
            label: '展示工牌准入',
            hint: '启动序列中间会升起一张 BSC 实验室胸卡：正面扫描 → 翻面 → 「准入通过」。默认按图恒宇的工牌填；电影里这张卡没有照片，所以这里也不放头像。',
            checked: !!draft.badge,
            changed: changed('badge'),
            onChange: function (value) { set('badge', value) }
          }),
          h('div', { className: '__ss_grid2' },
            h(TextField, { field: 'badgeName', label: '姓名 badgeName', value: draft.badgeName, maxLength: 24, changed: changed('badgeName'), onChange: function (v) { set('badgeName', v) } }),
            h(TextField, { field: 'badgeId', label: '正面编号 badgeId', value: draft.badgeId, maxLength: 24, mono: true, changed: changed('badgeId'), hint: '正面红色编号带和背面编号行都用它，例如 IDL.IQC-001。', onChange: function (v) { set('badgeId', v) } }),
            h(TextField, { field: 'badgeNo', label: '背面编号 badgeNo', value: draft.badgeNo, maxLength: 12, mono: true, changed: changed('badgeNo'), onChange: function (v) { set('badgeNo', v) } }),
            h(TextField, { field: 'badgePinyin', label: '英文名 badgePinyin', value: draft.badgePinyin, maxLength: 24, mono: true, changed: changed('badgePinyin'), onChange: function (v) { set('badgePinyin', v) } }),
            h(TextField, { field: 'badgeOrg', label: '机构名（中文）', value: draft.badgeOrg, maxLength: 24, changed: changed('badgeOrg'), onChange: function (v) { set('badgeOrg', v) } }),
            h(TextField, { field: 'badgeOrgEn', label: '机构名（英文）', value: draft.badgeOrgEn, maxLength: 40, mono: true, changed: changed('badgeOrgEn'), onChange: function (v) { set('badgeOrgEn', v) } }),
            h(TextField, { field: 'badgeLab', label: '实验室名（中文）', value: draft.badgeLab, maxLength: 30, changed: changed('badgeLab'), onChange: function (v) { set('badgeLab', v) } }),
            h(TextField, { field: 'badgeLabEn', label: '实验室名（英文）', value: draft.badgeLabEn, maxLength: 64, mono: true, changed: changed('badgeLabEn'), onChange: function (v) { set('badgeLabEn', v) } }),
            h(TextField, { field: 'badgeLabShort', label: '实验室缩写 badgeLabShort', value: draft.badgeLabShort, maxLength: 8, mono: true, changed: changed('badgeLabShort'), hint: '正面那个大字就是它（IQC）。', onChange: function (v) { set('badgeLabShort', v) } }),
            h(TextField, { field: 'badgeRole', label: '职务 badgeRole', value: draft.badgeRole, maxLength: 24, changed: changed('badgeRole'), onChange: function (v) { set('badgeRole', v) } }),
            h(TextField, { field: 'badgeClearance', label: '权限等级 badgeClearance', value: draft.badgeClearance, maxLength: 12, mono: true, changed: changed('badgeClearance'), onChange: function (v) { set('badgeClearance', v) } }),
            h(Slider, {
              field: 'badgeHold',
              label: '工牌停留 badgeHold',
              min: 0, max: 6000, step: 100,
              value: draft.badgeHold, fallback: 2400,
              display: function (value) { return (value / 1000).toFixed(1) + ' 秒' },
              changed: changed('badgeHold'),
              hint: '工牌核验通过后停留多久再退场；嫌一眨眼就没了就调大。',
              onChange: function (value) { set('badgeHold', value) }
            })
          ),
          h('div', { className: '__ss_hint' }, '卡片造型（正面 IQC 大字 + 编号带 + 条码 / 背面 BSC 徽标 + 姓名 + 职务）按电影里的实物胸卡复刻；字体优先用本机已装的 Noto Sans SC Black、Bahnschrift、Rajdhani。'),

          h(Switch, {
            field: 'sound',
            label: '界面音效',
            hint: 'WebAudio 现场合成，不加载任何素材文件。',
            checked: !!draft.sound,
            changed: changed('sound'),
            onChange: function (value) { set('sound', value) }
          }),
          h(Slider, {
            field: 'soundVolume',
            label: '音效音量 soundVolume',
            min: 0, max: 1, step: 0.01,
            value: draft.soundVolume, fallback: 0.4,
            display: function (value) { return Math.round(value * 100) + '%' },
            changed: changed('soundVolume'),
            disabled: !draft.sound,
            hint: draft.sound ? '启动屏与界面提示音的音量。' : '音效关闭时不可调。',
            onChange: function (value) { set('soundVolume', value) }
          }),

          /* 语音播报（音色/节奏参照 dsh-startup-screen） */
          h(SubHead, {}, '语音播报 · VOICE'),
          h(Switch, {
            field: 'voice',
            label: '语音播报',
            hint: '用系统语音念三段台词（标题 / 操作员验证 / 授权通过）。音色按「神经网络 > 女声 > 语种吻合」自动挑，不是随便第一个。',
            checked: !!draft.voice,
            changed: changed('voice'),
            onChange: function (value) { set('voice', value) }
          }),
          h(Segmented, {
            field: 'voiceLang',
            label: '语音语言',
            value: draft.voiceLang,
            options: [['zh', '中文'], ['en', '英文'], ['both', '双语']],
            disabled: !draft.voice,
            onChange: function (value) { set('voiceLang', value) }
          }),
          h(SelectField, {
            field: 'voiceName',
            label: '音色 voiceName',
            value: draft.voiceName,
            disabled: !draft.voice,
            changed: changed('voiceName'),
            options: [['', voiceList.length ? '自动（女声优先 · 本机 ' + voiceList.length + ' 个音色）' : '自动（本机暂未上报音色）']].concat(
              voiceList.map(function (v) { return [v.name, v.name + ' · ' + v.lang] })
            ),
            hint: '「自动」优先挑神经网络女声（Edge Natural / Google / Siri），没有再退到系统女声。指向本机已装音色更稳。',
            onChange: function (value) { set('voiceName', value) }
          }),
          h('div', { className: '__ss_grid2' },
            h(Slider, {
              field: 'voiceRate', label: '语速 voiceRate', min: 0.5, max: 2, step: 0.01,
              value: draft.voiceRate, fallback: 0.88, changed: changed('voiceRate'), disabled: !draft.voice,
              display: function (value) { return Number(value).toFixed(2) + '×' },
              hint: '参考插件用的是 0.88（比朗读慢，字与字之间有重量）。',
              onChange: function (value) { set('voiceRate', value) }
            }),
            h(Slider, {
              field: 'voicePitch', label: '音调 voicePitch', min: 0, max: 2, step: 0.01,
              value: draft.voicePitch, fallback: 0.85, changed: changed('voicePitch'), disabled: !draft.voice,
              display: function (value) { return Number(value).toFixed(2) },
              hint: '参考插件用的是 0.85（压低音调，深沉的 AI 女声）。',
              onChange: function (value) { set('voicePitch', value) }
            }),
            h(Slider, {
              field: 'voiceVolume', label: '音量 voiceVolume', min: 0, max: 1, step: 0.01,
              value: draft.voiceVolume, fallback: 0.9, changed: changed('voiceVolume'), disabled: !draft.voice,
              display: function (value) { return Math.round(Number(value) * 100) + '%' },
              onChange: function (value) { set('voiceVolume', value) }
            }),
            h(Slider, {
              field: 'voiceLead', label: '开口前留白 voiceLead', min: 0, max: 1200, step: 10,
              value: draft.voiceLead, fallback: 240, changed: changed('voiceLead'), disabled: !draft.voice,
              display: function (value) { return Math.round(Number(value)) + 'ms' },
              hint: '提示音之后留一小段空白再开口。',
              onChange: function (value) { set('voiceLead', value) }
            })
          ),
          h(Switch, {
            field: 'voiceCue',
            label: '念之前提示音 voiceCue',
            hint: '两声轻提示（1046.5 + 1568 Hz），像播报系统开场。',
            checked: !!draft.voiceCue,
            changed: changed('voiceCue'),
            disabled: !draft.voice,
            onChange: function (value) { set('voiceCue', value) }
          }),
          h(Segmented, {
            field: 'voiceSource',
            label: '语音来源 voiceSource',
            value: draft.voiceSource,
            options: [['tts', '系统合成'], ['asset', '素材文件']],
            disabled: !draft.voice,
            onChange: function (value) { set('voiceSource', value) }
          }),
          h('div', { className: '__ss_hint' },
            draft.voiceSource === 'asset'
              ? '素材模式：优先播 lib/assets/voice/{title|operator|grant}.mp3，缺哪个就用合成补哪个。可用 node scripts/import-voice.mjs 导入参考插件的真声素材。'
              : '合成模式：台词内容与你的文案完全一致（含 {operator} 占位符替换）。'
          ),
          h('div', { className: '__ss_row' },
            h('button', {
              type: 'button', className: '__ss_btn', 'data-action': 'voice-preview',
              disabled: !draft.voice, onClick: previewVoice
            }, '试听第 1 句')
          ),

          h(SubHead, {}, '播报台词 · LINES'),
          h('div', { className: '__ss_hint' },
            '三段台词分别卡在：标题砸下 / 进度与日志开始 / 授权通过。支持占位符 {operator} {id} {titleZh} {titleZh2} {clearLevel} {org}；留空的句子不播。'
          ),
          h('div', { className: '__ss_grid2' },
            h(TextField, {
              field: 'voiceLine1', label: '第 1 句（中文）', value: draft.voiceLine1, maxLength: 64,
              changed: changed('voiceLine1'),
              onChange: function (value) { set('voiceLine1', value) }
            }),
            h(TextField, {
              field: 'voiceLine1En', label: '第 1 句（英文）', value: draft.voiceLine1En, maxLength: 64,
              mono: true, changed: changed('voiceLine1En'),
              onChange: function (value) { set('voiceLine1En', value) }
            }),
            h(TextField, {
              field: 'voiceLine2', label: '第 2 句（中文）', value: draft.voiceLine2, maxLength: 64,
              changed: changed('voiceLine2'),
              onChange: function (value) { set('voiceLine2', value) }
            }),
            h(TextField, {
              field: 'voiceLine2En', label: '第 2 句（英文）', value: draft.voiceLine2En, maxLength: 64,
              mono: true, changed: changed('voiceLine2En'),
              onChange: function (value) { set('voiceLine2En', value) }
            }),
            h(TextField, {
              field: 'voiceLine3', label: '第 3 句（中文）', value: draft.voiceLine3, maxLength: 64,
              changed: changed('voiceLine3'),
              onChange: function (value) { set('voiceLine3', value) }
            }),
            h(TextField, {
              field: 'voiceLine3En', label: '第 3 句（英文）', value: draft.voiceLine3En, maxLength: 64,
              mono: true, changed: changed('voiceLine3En'),
              onChange: function (value) { set('voiceLine3En', value) }
            })
          )
        ),

        /* ── 关于 ── */
        h(Group, {
          groupKey: 'about',
          title: '关于',
          titleEn: 'About',
          changedCount: 0
        },
          h('div', { className: '__ss_aboutRow' },
            h('span', { className: '__ss_aboutK' }, '插件版本'),
            h('span', { className: '__ss_aboutV __ss_mono' }, 'v' + (version || FALLBACK_VERSION))
          ),
          h('div', { className: '__ss_aboutRow' },
            h('span', { className: '__ss_aboutK' }, '配置文件'),
            h('span', { className: '__ss_aboutV' },
              h('code', { className: '__ss_file' }, file || '（Host 未返回路径）'),
              h('button', {
                type: 'button', className: '__ss_copyBtn', disabled: !file,
                'data-action': 'copy-file', onClick: copyFile
              }, '复制')
            )
          ),
          confirmReset
            ? h('div', { className: '__ss_confirmRow' },
              h('span', { className: '__ss_confirmText' }, '确认恢复默认？当前自定义的配色、质感、文案与声音设置都会被清空，且立即写回配置文件。'),
              h('button', {
                type: 'button', className: '__ss_btn __ss_btnDanger',
                'data-action': 'reset-confirm', disabled: busy, onClick: doReset
              }, busy ? '恢复中…' : '确认恢复'),
              h('button', {
                type: 'button', className: '__ss_btn',
                onClick: function () { setConfirmReset(false) }
              }, '取消')
            )
            : h('div', { className: '__ss_actionsRow' },
              h('button', {
                type: 'button', className: '__ss_btn __ss_btnDanger',
                'data-action': 'reset', disabled: busy,
                onClick: function () { setConfirmReset(true); setNotice(null) }
              }, '恢复默认…'),
              h('button', {
                type: 'button', className: '__ss_btn',
                'data-action': 'replay', onClick: replaySplash
              }, '重播启动屏'),
              h('a', {
                className: '__ss_btn __ss_linkBtn',
                href: '/dsh-command/preview', target: '_blank', rel: 'noopener noreferrer'
              }, '打开独立预览')
            ),
          h('div', { className: '__ss_note' },
            h('div', { className: '__ss_noteTitle' }, '预览说明'),
            h('div', null, '「重播启动屏」只在启动屏运行时可用（页面刚加载的那几秒）；页面已加载完时，保存后刷新即可看到新版启动屏。'),
            h('div', null, '「打开独立预览」在浏览器里单独播一遍启动屏（用的就是正式注入那套路由与配置，不会写"已播过"标记），适合不重启 DSH 就快速比较配色；界面皮肤本身在下次刷新后生效。')
          )
        ),

        /* ── 吸底保存条 ── */
        h('div', {
          className: '__ss_bar',
          'data-dirty': dirty ? 'true' : 'false',
          'data-testid': 'supreme-command-bar'
        },
          h('div', { className: '__ss_barState', role: 'status', 'aria-live': 'polite' },
            h('div', { className: '__ss_barStateLine' },
              busy ? h('span', { className: '__ss_spinner', 'aria-hidden': 'true' }) : null,
              (!busy && dirty) ? h('span', { className: '__ss_pulse', 'aria-hidden': 'true' }) : null,
              h('span', { className: busy ? undefined : (dirty ? '__ss_dirtyText' : (savedAt ? '__ss_okText' : undefined)) }, barText),
              notice ? h('span', { className: '__ss_ok' }, notice) : null
            ),
            saveError ? h('div', { className: '__ss_barError' }, '保存失败：' + saveError) : null
          ),
          h('div', { className: '__ss_barActions' },
            h('button', {
              type: 'button', className: '__ss_btn __ss_btnGhost',
              disabled: !dirty || busy, onClick: discard
            }, '放弃修改'),
            h('button', {
              type: 'button', className: '__ss_btn __ss_btnPrimary',
              'data-action': 'save', disabled: !dirty || busy, onClick: save
            }, busy ? '保存中…' : (saveError ? '重试保存' : '保存'))
          )
        )
      )
    }

    /* ── 桌面端自举 ─────────────────────────────────────────────────────────
     * DSH Desktop 的主窗口页面是 dsh-app://app/index.html，直接从打包后的 dist
     * 静态文件读出来 —— 不走 Host 的 index render，所以 Host 端 tapIndex 的注入
     * 在桌面端永远到不了页面（设置面板能显示、主题与启动屏却不生效，就是这个原因）。
     * 但 dsh-app://app/* 的其它请求会带 cookie 转发给 Host，所以 /dsh-command/*
     * 全都可用：这里只负责在"页面里没有 Host 注入痕迹"时，把自举脚本挂上去，
     * 真正的注入逻辑仍然只有一份（Host 生成的 /dsh-command/selfboot.js）。
     * Web 模式下 Host 已经注入过，这里直接返回，不会重复注入。
     */
    var SELFBOOT_SRC = '/dsh-command/selfboot.js'
    var SELFBOOT_FLAG = '__DSC_SELFBOOT__'

    function hostInjected() {
      try {
        if (window.__DSC_CFG__) return true
        if (document.getElementById('dsh-command-splash')) return true
        if (document.getElementById('dsh-command-deco')) return true
        if (document.querySelector('link[href$="/dsh-command/theme.css"],link[href$="dsh-command/theme.css"]')) return true
        var html = document.documentElement
        if (html && html.getAttribute('data-dsh-command') === 'on' &&
            document.getElementById('dsh-command-vars')) return true
      } catch (err) { /* 判不出来就当没注入 */ }
      return false
    }

    function selfBoot() {
      try {
        if (window[SELFBOOT_FLAG]) return
        if (hostInjected()) return
        window[SELFBOOT_FLAG] = true
        if (document.querySelector('script[src$="/dsh-command/selfboot.js"]')) return
        var tag = document.createElement('script')
        tag.src = SELFBOOT_SRC
        tag.async = false
        tag.onerror = function () {
          try { window.__DSC_SELFBOOT_FAILED__ = true } catch (err) { /* noop */ }
        }
        ;(document.head || document.documentElement).appendChild(tag)
      } catch (err) { /* 自举失败不影响设置面板 */ }
    }

    /* 越早越好：客户端 bundle 在首屏渲染前就执行，此时挂上注入脚本可以尽量避免闪一下原生配色。 */
    selfBoot()

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'supreme-command', order: 27, label: '流浪地球主题' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
