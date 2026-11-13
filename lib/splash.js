/* ============================================================================
 * dsh-supreme-command — 启动屏运行时（浏览器端，零依赖）
 * ----------------------------------------------------------------------------
 * 由 Host 半侧注入，在 React 应用挂载之前接管首屏。一段「控制台开机」序列：
 *
 *   0.00s  黑幕 + 机壳点亮，一道扫描带横扫屏幕（power-on）
 *   0.22s  HUD 框线 / 四角直角标 / 技术网格逐层落位
 *   0.32s  顶部导轨、左右信息栏点亮，右侧数据流开始滚动
 *   0.42s  BSC 橄榄枝徽标开播（逐叶浮现 → 双环描边填充 → 三角与文字揭示）
 *   0.95s  「智能量子计算机 · 重点实验室」逐字砸下 + 故障闪切
 *   1.60s  英文副标字距收拢
 *   1.85s  分段进度条推进，状态日志逐条打出（每行一声轻响）
 *   5.00s  授权通过横幅 + 红色 LED，和弦音
 *   6.10s  整体淡出、解锁页面
 *
 * 配置来自 window.__DSC_SPLASH_CONFIG__（Host 注入）。
 * 外部 API：window.__DSC_SPLASH__.replay() / .finish() / .version
 * ========================================================================== */
(function () {
  'use strict'

  if (window.__DSC_SPLASH_LOADED__) return
  window.__DSC_SPLASH_LOADED__ = true

  var ROOT_ID = 'dsh-command-splash'
  var CFG = window.__DSC_SPLASH_CONFIG__ || {}
  var REDUCED = false
  try {
    REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  } catch (e) { /* noop */ }

  /* ── 小工具 ─────────────────────────────────────────────────────────── */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)) }

  function pad3(n) {
    var s = String(Math.round(n))
    while (s.length < 3) s = '0' + s
    return s
  }

  /** 伪随机（带种子，保证每帧数据流看起来像真遥测而不是抖动噪声）。 */
  function seedRand(seed) {
    var s = seed >>> 0
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
  }

  /* ── 音效（WebAudio 合成，不依赖素材文件） ─────────────────────────── */

  var sound = (function () {
    var enabled = CFG.sound !== false
    var volume = clamp(Number(CFG.soundVolume == null ? 0.4 : CFG.soundVolume), 0, 1)
    var ctx = null
    var master = null

    function ensure() {
      if (!enabled || volume <= 0) return null
      if (ctx) return ctx
      var AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      try {
        ctx = new AC()
        master = ctx.createGain()
        master.gain.value = volume * 0.5
        master.connect(ctx.destination)
        return ctx
      } catch (err) {
        return null
      }
    }

    function resume() {
      var c = ensure()
      if (c && c.state === 'suspended') { try { c.resume() } catch (e) { /* noop */ } }
      return c
    }

    /** 一个带包络的振荡器音。 */
    function tone(freq, dur, type, gain, glideTo) {
      var c = resume()
      if (!c) return
      var t0 = c.currentTime
      var osc = c.createOscillator()
      var g = c.createGain()
      osc.type = type || 'sine'
      osc.frequency.setValueAtTime(freq, t0)
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain == null ? 0.12 : gain), t0 + Math.min(0.03, dur * 0.3))
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g); g.connect(master)
      osc.start(t0); osc.stop(t0 + dur + 0.02)
    }

    /** 噪声横扫：开机 / 标题砸下的那口气。 */
    function whoosh(dur, from, to, gain) {
      var c = resume()
      if (!c) return
      var t0 = c.currentTime
      var len = Math.floor(c.sampleRate * dur)
      var buf = c.createBuffer(1, len, c.sampleRate)
      var data = buf.getChannelData(0)
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
      var src = c.createBufferSource()
      src.buffer = buf
      var bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.1
      bp.frequency.setValueAtTime(from || 260, t0)
      bp.frequency.exponentialRampToValueAtTime(to || 2600, t0 + dur)
      var g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain == null ? 0.1 : gain, t0 + dur * 0.25)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      src.connect(bp); bp.connect(g); g.connect(master)
      src.start(t0); src.stop(t0 + dur)
    }

    return {
      tick: function () { tone(1900 + Math.random() * 500, 0.045, 'square', 0.035) },
      blip: function () { tone(760, 0.09, 'triangle', 0.07) },
      slam: function () { whoosh(0.5, 300, 2600, 0.14); tone(84, 0.55, 'sine', 0.16, 44) },
      /* 工牌扫描 / 核验通过 */
      scan: function () { whoosh(0.95, 700, 3400, 0.055) },
      verify: function () {
        tone(1320, 0.12, 'triangle', 0.06)
        setTimeout(function () { tone(1760, 0.2, 'sine', 0.05) }, 110)
      },
      /* 念台词前的两声轻提示（1046.5 + 1568 Hz，与参考插件同一组音高） */
      cue: function () {
        tone(1046.5, 0.075, 'sine', 0.05)
        setTimeout(function () { tone(1568, 0.09, 'sine', 0.04) }, 95)
      },
      grant: function () {
        tone(440, 0.5, 'triangle', 0.08)
        tone(660, 0.48, 'triangle', 0.06)
        tone(880, 0.62, 'sine', 0.05)
      },
      power: function () { tone(55, 0.7, 'sine', 0.1, 110); whoosh(0.7, 180, 1800, 0.07) },
      stop: function () { try { if (ctx) ctx.close() } catch (e) { /* noop */ } ctx = null }
    }
  })()

  /* ── 语音播报 ─────────────────────────────────────────────────────────
   * 音色与节奏参照 dsh-startup-screen：
   *   · 先在系统音色里按分数挑（神经网络 > 女声 > 语种吻合 > 本地），而不是"第一个命中"；
   *   · 语速 0.88 / 音调 0.85 / 音量 0.9（电影旁白档：慢、低、沉）；
   *   · 念之前两声轻提示，之后留 240ms 空白再开口；
   *   · 素材模式（voiceSource=asset）优先播 lib/assets/voice/<槽位>.mp3，拿不到回落 TTS。
   *
   * 三个播报槽位：title（标题砸下）/ operator（进度与日志开始）/ grant（授权通过）。
   * 台词支持占位符：{operator} {id} {titleZh} {titleZh2} {clearLevel} {org}
   * ──────────────────────────────────────────────────────────────────── */

  var VOICE_SLOTS = ['title', 'operator', 'grant']

  var voice = (function () {
    var enabled = CFG.voice !== false
    var lang = CFG.voiceLang === 'en' || CFG.voiceLang === 'both' ? CFG.voiceLang : 'zh'
    var wantName = String(CFG.voiceName || '')
    var rate = clamp(Number(CFG.voiceRate == null ? 0.88 : CFG.voiceRate), 0.5, 2)
    var pitch = clamp(Number(CFG.voicePitch == null ? 0.85 : CFG.voicePitch), 0, 2)
    var volume = clamp(Number(CFG.voiceVolume == null ? 0.9 : CFG.voiceVolume), 0, 1)
    var cueOn = CFG.voiceCue !== false
    var lead = clamp(Number(CFG.voiceLead == null ? 240 : CFG.voiceLead), 0, 1200)
    var source = CFG.voiceSource === 'asset' ? 'asset' : 'tts'
    var lines = CFG.voiceLines || { zh: [], en: [] }
    var urls = CFG.voiceUrls || {}

    var supported = typeof window !== 'undefined' &&
      !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'
    var voices = []
    var assets = {}
    var cancelled = false
    var audioEl = null
    var ttsBusy = false
    var ttsStartedAt = 0
    var ttsEstimate = 0
    var assetDur = 0

    /* 想让它听起来像"AI 播报"，音色本身比什么都重要。
       同一台机器上 Zira/Huihui 这类 Desktop 音色念长句塑料味很重；
       Edge 的 "... Online (Natural)"、Chrome 的 "Google ..."、macOS 的 Siri 才是神经网络音色。 */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred', 'male', 'yunxi', 'yunjian', 'kangkang', '云希']

    function loadVoices() {
      if (!supported) return
      try { voices = window.speechSynthesis.getVoices() || [] } catch (e) { voices = [] }
    }
    loadVoices()
    if (supported && !voices.length) {
      try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices, { once: true }) } catch (e) { /* noop */ }
    }

    function has(hintList, name) {
      for (var i = 0; i < hintList.length; i++) if (name.indexOf(hintList[i]) !== -1) return true
      return false
    }

    /** 神经网络 > 女声 > 语种吻合 > 本地 > 默认 */
    function score(v, want) {
      var name = String(v.name || '').toLowerCase()
      var vlang = String(v.lang || '').toLowerCase()
      var sc = 0
      if (has(NATURAL_HINTS, name)) sc += 60
      if (has(FEMALE_HINTS, name)) sc += 26
      if (has(MALE_HINTS, name)) sc -= 40
      if (vlang.indexOf(want === 'zh' ? 'zh' : 'en') === 0) sc += 40
      if (v.localService) sc += 4
      if (v.default) sc += 2
      return sc
    }

    function pick(want) {
      loadVoices()
      if (!voices.length) return null
      if (wantName) {
        for (var i = 0; i < voices.length; i++) {
          if (String(voices[i].name) === wantName) return voices[i]
        }
        /* 指定了但系统里没有 → 继续走自动挑，不静音 */
      }
      /* 语种优先于音色档次：拿中文音色念英文，发音会错得很难听。
         所以先按语种过滤，只有完全没有该语种的音色时才退回全量。 */
      var target = want === 'zh' ? 'zh' : 'en'
      var pool = []
      for (var k = 0; k < voices.length; k++) {
        if (String(voices[k].lang || '').toLowerCase().indexOf(target) === 0) pool.push(voices[k])
      }
      if (!pool.length) pool = voices
      var best = null
      var bestScore = -1e9
      for (var j = 0; j < pool.length; j++) {
        var s = score(pool[j], want)
        if (s > bestScore) { bestScore = s; best = pool[j] }
      }
      return best
    }

    /** 台词占位符替换（操作员改名后语音跟着变，不用改两处）。 */
    function interpolate(text) {
      var dict = {
        operator: CFG.operator, id: CFG.operatorId, titleZh: CFG.titleZh,
        titleZh2: CFG.titleZh2, clearLevel: CFG.clearLevel, org: CFG.org
      }
      return String(text == null ? '' : text).replace(/\{([A-Za-z]+)\}/g, function (all, key) {
        return dict[key] == null ? all : String(dict[key])
      })
    }

    function say(text, want) {
      return new Promise(function (resolve) {
        if (!supported || !text) { resolve(0); return }
        var v = pick(want)
        var u = new window.SpeechSynthesisUtterance(text)
        u.rate = rate
        u.pitch = pitch
        u.volume = volume
        u.lang = want === 'zh' ? 'zh-CN' : 'en-US'
        if (v) u.voice = v
        var started = Date.now()
        var settled = false
        function done() {
          if (settled) return
          settled = true
          ttsBusy = false
          resolve(Date.now() - started)
        }
        /* 记录"在念 + 大概还剩多久"：收尾时要等它念完，别把最后一句掐断 */
        ttsBusy = true
        ttsStartedAt = started
        ttsEstimate = Math.max(700, text.length * (want === 'zh' ? 210 : 130) / rate)
        u.onend = done
        u.onerror = done
        try { window.speechSynthesis.speak(u) } catch (e) { done() }
        /* 兜底：某些实现不回调 onend（尤其语音被系统取消时） */
        setTimeout(done, 12000)
      })
    }

    function playAsset(slot) {
      try {
        var a = new Audio(urls[slot])
        a.volume = volume
        audioEl = a
        a.onloadedmetadata = function () { assetDur = isFinite(a.duration) ? a.duration : 0 }
        a.onended = function () { try { if (audioEl === a) audioEl = null } catch (e) { /* noop */ } }
        var p = a.play()
        if (p && typeof p.catch === 'function') p.catch(function () { /* 自动播放被拦就安静 */ })
      } catch (e) { /* noop */ }
    }

    /** 预检素材是否存在（HEAD 404 就是不支持），asset 模式下才会用到。 */
    function preflight() {
      if (source !== 'asset' || !window.fetch) return Promise.resolve()
      var slots = Object.keys(urls)
      return Promise.all(slots.map(function (slot) {
        return fetch(urls[slot], { method: 'HEAD' })
          .then(function (r) { assets[slot] = !!r.ok })
          .catch(function () { assets[slot] = false })
      }))
    }

    function speakSlot(index) {
      if (!enabled || cancelled) return
      if (CFG.staticFrame === true) return
      var slot = VOICE_SLOTS[index]
      if (source === 'asset' && assets[slot]) { playAsset(slot); return }
      if (!supported) return
      var wants = lang === 'both' ? ['zh', 'en'] : [lang]
      var queue = Promise.resolve()
      wants.forEach(function (want) {
        var text = interpolate((lines[want] || [])[index] || '')
        if (!text) return
        queue = queue.then(function () {
          if (cancelled) return
          if (cueOn) sound.cue()
          return new Promise(function (resolve) { setTimeout(resolve, lead) })
            .then(function () { if (!cancelled) return say(text, want) })
        })
      })
      queue.catch(function () { /* 语音失败绝不影响动画 */ })
    }

    function cancel() {
      cancelled = true
      try { if (supported) window.speechSynthesis.cancel() } catch (e) { /* noop */ }
      try { if (audioEl) { audioEl.pause(); audioEl = null } } catch (e) { /* noop */ }
    }

    preflight()

    /** 当前是否还有一句在念（素材或 TTS）。 */
    function isSpeaking() {
      try {
        if (ttsBusy) return true
        if (audioEl && !audioEl.paused && !audioEl.ended) return true
      } catch (e) { /* noop */ }
      return false
    }

    /** 当前这句大概还剩多少毫秒（拿不到时长就按 800ms 估）。 */
    function remainingMs() {
      try {
        if (audioEl && !audioEl.paused && !audioEl.ended) {
          var total = assetDur || (isFinite(audioEl.duration) ? audioEl.duration : 0)
          if (total > 0) return Math.max(0, (total - audioEl.currentTime) * 1000)
          return 1200
        }
        if (ttsBusy) return Math.max(400, ttsEstimate - (Date.now() - ttsStartedAt))
      } catch (e) { /* noop */ }
      return 0
    }

    return {
      speak: speakSlot,
      cancel: cancel,
      isSpeaking: isSpeaking,
      remainingMs: remainingMs,
      interpolate: interpolate,
      /* 给设置页/预览用：列出系统音色（按本插件的评分排序） */
      listVoices: function () {
        loadVoices()
        return voices.slice().sort(function (a, b) { return score(b, lang) - score(a, lang) })
          .map(function (v) { return { name: v.name, lang: v.lang, local: !!v.localService } })
      }
    }
  })()

  var TITLES = { zh1: CFG.titleZh || '智能量子计算机', zh2: CFG.titleZh2 || '重点实验室' }
  var STATUS = Array.isArray(CFG.statusLines) && CFG.statusLines.length
    ? CFG.statusLines
    : ['建立安全信道 … OK', '校验操作员生物签名 … OK', '解密绝密指令包 … OK', '载入 HARNESS 运行时 … OK']

  function chars(value) {
    var out = ''
    var list = String(value).split('')
    for (var i = 0; i < list.length; i++) {
      var ch = list[i] === ' ' ? '&nbsp;' : esc(list[i])
      out += '<span class="dsc-ch" style="--i:' + i + '">' + ch + '</span>'
    }
    return out
  }

  /** 左栏 NODE 只放得下短词：取组织名第一个词。 */
  function shortOrg() {
    var parts = String(CFG.org || 'HARNESS').trim().split(/\s+/)
    return (parts[0] || 'HARNESS').slice(0, 13).toUpperCase()
  }

  var WAVE_BARS = 46
  var METER_SEGMENTS = 26

  /* ── 工牌准入（《流浪地球2》北京航天中心 IQC 实验室胸卡） ───────────────
   * 按参考图实测比例复刻（卡面 1.586 宽高比，正面/背面分别是 459×288 / 459×286）：
   *   正面 顶部红色重复机构名(2.5%) → 白色 BSC 徽标水印(居中 78% 宽) → IQC 大字(26% 高)
   *        → 实验室中英名(53% / 62%) → 红色编号带(79%-85.5%) → 白色条码区(87%-98%)
   *   背面 左列 29%：上 39% 蓝色 BSC 徽标 + 下 61% 红底大字 CS
   *        右列 71%：上 39% 编号 IDL./IQC-001 + 右侧大姓名；下 61% 白底实验室/职务/编码/条码
   * 徽标用的是插件自带的真实 BSC SVG（正面白色水印、背面蓝色），不做任何剧照素材。
   * ─────────────────────────────────────────────────────────────────────── */

  /** 工牌（只有 badge !== false 才存在） */
  /** 确定性伪随机（同一个 seed 每次渲染一致，截图可复现）。 */
  function rng(seed) {
    var s = seed >>> 0
    return function () {
      s = (s + 0x6d2b79f5) >>> 0
      var t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /** 条码柱：窄/中/宽三档宽度，生成密集黑条（比重复渐变像真条码）。 */
  function barcodeBars(seed, count) {
    var rand = rng(seed)
    var out = []
    for (var i = 0; i < count; i++) {
      var r = rand()
      /* 窄/中/宽三档，单位 cqw（1cqw = 卡宽 1%）：最窄约 1px */
      var w = r < 0.42 ? 0.2 : (r < 0.86 ? 0.32 : 0.46)
      out.push('<i style="width:' + w + 'cqw"></i>')
    }
    return out.join('')
  }

  function badgeMarkup() {
    if (CFG.badge === false) return ''
    function val(v, fallback) { return esc(v == null || v === '' ? (fallback || '') : v) }
    var orgEn = val(CFG.badgeOrgEn, 'BEIJING SPACE CENTER')
    var lab = val(CFG.badgeLab, '智能量子计算机重点实验室')
    var labEn = val(CFG.badgeLabEn, 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER')
    var labShort = val(CFG.badgeLabShort, 'IQC')
    var idCode = val(CFG.badgeId, 'IDL.IQC-001')
    var badgeNo = val(CFG.badgeNo, '222179')
    var pinyin = val(CFG.badgePinyin, '')
    var name = val(CFG.badgeName, '图恒宇')
    var role = val(CFG.badgeRole, '研究员')
    var clearance = val(CFG.badgeClearance, 'L1')
    var shortId = String(CFG.badgeId || 'IDL.IQC-001').replace(/^IDL\./i, '')
    var codeLine = 'BSC-' + String(CFG.badgeId || 'IDL.IQC-001').replace(/^IDL\./i, '').replace(/[^A-Za-z0-9]/g, '') +
      ' ' + badgeNo + (pinyin ? ' ' + pinyin : '')

    return [
      '<section class="dsc-badge" data-dsc="badge" aria-hidden="true">',
        '<div class="dsc-badge__stage">',

          /* ── 正面 ── */
          '<div class="dsc-badge__face dsc-badge__face--front">',
            '<div class="dsc-badge__strip">',
              '<span>' + orgEn + '</span><span>' + orgEn + '</span><span>' + orgEn + '</span>',
            '</div>',
            '<div class="dsc-badge__wm" data-dsc="badge-wm"></div>',
            '<div class="dsc-badge__iqc">' + labShort + '</div>',
            '<div class="dsc-badge__lab">' + lab + '</div>',
            '<div class="dsc-badge__labEn">' + labEn + '</div>',
            '<div class="dsc-badge__band"><span>' + idCode + '</span></div>',
            '<div class="dsc-badge__barcodeWrap dsc-badge__barcodeWrap--front">',
              '<i class="dsc-badge__barcode">' + barcodeBars(20221113, 148) + '</i>',
            '</div>',
          '</div>',

          /* ── 背面 ── */
          '<div class="dsc-badge__face dsc-badge__face--back">',
            '<div class="dsc-badge__col">',
              '<div class="dsc-badge__markCell">',
                '<div class="dsc-badge__mark" data-dsc="badge-mark"></div>',
                '<span class="dsc-badge__markOrg">' + val(CFG.badgeOrg, '北京航天中心') + '</span>',
                '<span class="dsc-badge__markOrgEn">' + orgEn + '</span>',
              '</div>',
              '<div class="dsc-badge__cs"><span>CS</span></div>',
            '</div>',
            '<div class="dsc-badge__right">',
              '<div class="dsc-badge__top">',
                '<div class="dsc-badge__idrow">',
                  '<span class="dsc-badge__idpre">IDL.</span>',
                  '<span class="dsc-badge__idcode">' + shortId + '</span>',
                '</div>',
                '<div class="dsc-badge__name">' + name + '</div>',
              '</div>',
              '<div class="dsc-badge__white">',
                '<div class="dsc-badge__labBack">' + lab + '</div>',
                '<div class="dsc-badge__role">' + role + '</div>',
                '<div class="dsc-badge__code">' + codeLine + '</div>',
                '<div class="dsc-badge__barcodeWrap dsc-badge__barcodeWrap--back">',
                  '<i class="dsc-badge__barcode">' + barcodeBars(222179, 118) + '</i>',
                '</div>',
              '</div>',
            '</div>',
          '</div>',

          /* 取景框 / 扫描线 / 状态：单独一层，不参与 3D 翻面 */
          '<div class="dsc-badge__overlay">',
            '<div class="dsc-badge__frame">',
              '<i class="dsc-badge__reticle dsc-badge__reticle--tl"></i>',
              '<i class="dsc-badge__reticle dsc-badge__reticle--tr"></i>',
              '<i class="dsc-badge__reticle dsc-badge__reticle--bl"></i>',
              '<i class="dsc-badge__reticle dsc-badge__reticle--br"></i>',
              '<div class="dsc-badge__scan" aria-hidden="true"></div>',
              '<div class="dsc-badge__status" data-dsc="badge-status">SCANNING</div>',
              '<div class="dsc-badge__ok" data-dsc="badge-ok">准入通过 · ACCESS GRANTED</div>',
            '</div>',
          '</div>',
        '</section>'
    ].join('')
  }

  function markup() {
    var meter = ''
    for (var i = 0; i < METER_SEGMENTS; i++) meter += '<i class="dsc-meter__seg" style="--i:' + i + '"></i>'
    var wave = ''
    for (var j = 0; j < WAVE_BARS; j++) wave += '<i class="dsc-wave__bar" style="--i:' + j + '"></i>'

    return [
      '<div class="dsc-bezel">',
        '<div class="dsc-screen">',
          '<div class="dsc-screen__glow" aria-hidden="true"></div>',
          '<div class="dsc-screen__grid" aria-hidden="true"></div>',
          '<div class="dsc-screen__scan" aria-hidden="true"></div>',
          '<div class="dsc-screen__ticks" aria-hidden="true"></div>',
          '<div class="dsc-screen__sweep" aria-hidden="true"></div>',
          '<div class="dsc-hair dsc-hair--top" aria-hidden="true"></div>',
          '<div class="dsc-hair dsc-hair--bottom" aria-hidden="true"></div>',
          '<div class="dsc-frame" aria-hidden="true">',
            '<i class="dsc-corner dsc-corner--tl"></i>',
            '<i class="dsc-corner dsc-corner--tr"></i>',
            '<i class="dsc-corner dsc-corner--bl"></i>',
            '<i class="dsc-corner dsc-corner--br"></i>',
          '</div>',

          /* 顶部导轨 */
          '<header class="dsc-top">',
            '<span class="dsc-top__left"><i class="dsc-chev"></i>SECURE CHANNEL <b>0x1F</b></span>',
            '<span class="dsc-pill"><i class="dsc-pill__dot"></i>' + esc(CFG.orgZh || '深度求索') + ' · ' + esc(CFG.clearLevel || '绝密 / TOP SECRET') + '</span>',
            '<span class="dsc-top__right">',
              '<span class="dsc-tick"><b>LINK</b> OK</span>',
              '<span class="dsc-tick"><b>ENC</b> AES-256</span>',
              '<span class="dsc-tick dsc-tick--live"><b>SIG</b> 98%</span>',
            '</span>',
          '</header>',

          /* 左上角：550C 主机型号标识 */
          (CFG.showModel === false ? '' :
            '<div class="dsc-model" data-dsc="model">' +
              '<div class="dsc-model__mark" data-dsc="model-mark"></div>' +
              '<span class="dsc-model__label">MAINFRAME <b>550C</b></span>' +
            '</div>') +

          /* 左侧：操作员信息块 */
          '<aside class="dsc-rail dsc-rail--left">',
            '<div class="dsc-ops">',
              '<div class="dsc-ops__row"><span>OPERATOR</span><b>' + esc(CFG.operator || '—') + '</b></div>',
              '<div class="dsc-ops__row"><span>ID</span><b>' + esc(CFG.operatorId || '—') + '</b></div>',
              '<div class="dsc-ops__row"><span>CLEARANCE</span><b>L1</b></div>',
              '<div class="dsc-ops__row"><span>NODE</span><b>' + esc(shortOrg()) + '</b></div>',
            '</div>',
            '<div class="dsc-ops__hair" aria-hidden="true"></div>',
            '<div class="dsc-ops__note">BIOMETRIC SIGNATURE VERIFIED<br>SESSION KEY ROTATED</div>',
          '</aside>',

          /* 右侧：遥测数据流 */
          '<aside class="dsc-rail dsc-rail--right" aria-hidden="true">',
            '<div class="dsc-data" data-dsc="data"></div>',
          '</aside>',

          /* 中央 */
          '<main class="dsc-core">',
            '<div class="dsc-seal" data-dsc="seal">',
              '<div class="dsc-seal__ring" aria-hidden="true"></div>',
              '<div class="dsc-seal__slot" data-dsc="seal-slot"></div>',
            '</div>',
            '<h1 class="dsc-title">',
              '<span class="dsc-title__part" data-dsc="title1">' + chars(TITLES.zh1) + '</span>',
              '<span class="dsc-title__sep" aria-hidden="true"></span>',
              '<span class="dsc-title__part dsc-title__part--2" data-dsc="title2">' + chars(TITLES.zh2) + '</span>',
            '</h1>',
            '<p class="dsc-sub" data-dsc="sub">' + esc(CFG.subtitleEn || 'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER') + '</p>',
            '<div class="dsc-meter" data-dsc="meter">',
              '<div class="dsc-meter__bar">' + meter + '</div>',
              '<span class="dsc-meter__pct" data-dsc="pct">000%</span>',
            '</div>',
            '<ul class="dsc-log" data-dsc="log"></ul>',
            '<div class="dsc-rule" aria-hidden="true">',
              '<i></i><span>IQC LAB · CHANNEL 0X1F · FRAME 0001</span><i></i>',
            '</div>',
          '</main>',

          /* 底部 */
          '<footer class="dsc-bottom">',
            '<div class="dsc-wave" data-dsc="wave" aria-hidden="true">' + wave + '</div>',
            '<div class="dsc-bottom__meta">',
              '<span class="dsc-badge">' + esc(CFG.org || 'DEEPSEEK HARNESS') + '</span>',
              '<span class="dsc-bottom__foot">' + esc(CFG.footer || 'POWERED BY DEEPSEEK') + '</span>',
            '</div>',
            '<div class="dsc-stamp" data-dsc="stamp-slot" aria-hidden="true"></div>',
          '</footer>',

          /* 工牌准入（有工牌才渲染） */
          badgeMarkup(),

          '<div class="dsc-grant" data-dsc="grant">',
            '<i class="dsc-grant__led"></i><span>授权通过</span><em>AUTHORIZATION GRANTED</em>',
          '</div>',

          /* UEG 大徽标水印（藏在标题后面） */
          '<div class="dsc-watermark" data-dsc="watermark" aria-hidden="true"></div>',
        '</div>',
      '</div>'
    ].join('')
  }

  /* ── Logo 载入（Host 路由 → 内联进 DOM 才能吃 currentColor 与动画） ── */

  function fetchLogo(name) {
    var urls = CFG.logoUrls || {}
    var url = urls[name]
    if (!url) return Promise.resolve('')
    return fetch(url, { headers: { Accept: 'image/svg+xml' } })
      .then(function (r) { return r.ok ? r.text() : '' })
      .catch(function () { return '' })
  }

  /* 徽标契约（见 lib/logos/logos.css）：必须套一层作用域容器 .dsc-bsc / .dsc-ueg，
     data-mode 挂在容器上而不是 svg 上，否则 still/play 的规则匹配不到。 */
  function injectLogo(host, svg, kind, mode) {
    if (!host || !svg) return false
    var wrap = kind === 'bsc' ? 'dsc-bsc' : 'dsc-ueg'
    host.innerHTML = '<div class="' + wrap + '"' +
      (kind === 'bsc' && mode ? ' data-mode="' + mode + '"' : '') + '>' + svg + '</div>'
    return !!host.firstElementChild
  }

  /* ── 时间线与编排 ───────────────────────────────────────────────────── */

  var state = {
    root: null,
    speed: 1,
    timers: [],
    raf: 0,
    dataTimer: 0,
    done: false,
    startedAt: 0
  }

  function later(ms, fn) {
    var id = setTimeout(function () {
      var idx = state.timers.indexOf(id)
      if (idx >= 0) state.timers.splice(idx, 1)
      try { fn() } catch (err) { /* 单步失败不拖垮整段动画 */ }
    }, Math.max(0, ms / state.speed))
    state.timers.push(id)
    return id
  }

  function clearTimers() {
    for (var i = 0; i < state.timers.length; i++) clearTimeout(state.timers[i])
    state.timers.length = 0
    if (state.dataTimer) { clearInterval(state.dataTimer); state.dataTimer = 0 }
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0 }
  }

  function finished() {
    return state.done
  }

  /** 数据流：右侧一列滚动的伪遥测行。 */
  function startDataStream(node) {
    if (!node) return
    var rand = seedRand(Math.floor(Date.now() / 1000) || 7)
    var lines = 0
    function line() {
      var hex = Math.floor(rand() * 0xffff).toString(16).toUpperCase()
      while (hex.length < 4) hex = '0' + hex
      var block = ''
      var n = 3 + Math.floor(rand() * 5)
      for (var i = 0; i < n; i++) block += rand() > 0.45 ? '▮' : '▯'
      var val = (rand() * 1.4 - 0.2).toFixed(3)
      var cls = rand() > 0.86 ? ' is-hot' : ''
      return '<span class="dsc-data__line' + cls + '"><i>0x' + hex + '</i>' + block + '<u>' + val + '</u></span>'
    }
    function push() {
      if (finished() || lines > 90) return
      node.insertAdjacentHTML('beforeend', line())
      lines++
      var kids = node.children
      while (kids.length > 26) node.removeChild(kids[0])
    }
    for (var k = 0; k < 14; k++) push()
    state.dataTimer = setInterval(push, 130 / state.speed)
  }

  /** 频谱条：一组随机跳动的竖条，纯装饰但很"活"。 */
  function startWave(node) {
    if (!node) return
    var bars = node.children
    var rand = seedRand(1337)
    var phase = []
    for (var i = 0; i < bars.length; i++) phase.push(rand() * Math.PI * 2)
    var t = 0
    function frame() {
      if (finished()) return
      t += 0.055 * state.speed
      for (var j = 0; j < bars.length; j++) {
        var v = 0.18 +
          0.42 * Math.abs(Math.sin(t * (0.7 + (j % 5) * 0.13) + phase[j])) +
          0.3 * Math.abs(Math.sin(t * 2.3 + phase[j] * 1.7))
        bars[j].style.transform = 'scaleY(' + clamp(v, 0.08, 1).toFixed(3) + ')'
      }
      state.raf = requestAnimationFrame(frame)
    }
    frame()
  }

  /** 分段进度条：0 → 100，先快后慢，最后几格故意顿一下（像真在等解密）。
      刻意用 setInterval 而不是 requestAnimationFrame：进度是"内容状态"，
      不能因为页面在后台、或某些无头/省电环境里 rAF 被节流就停住。 */
  function startMeter(host, pctNode, durationMs) {
    if (!host) return
    var segs = host.querySelectorAll('.dsc-meter__seg')
    var started = performance.now()
    var timer = setInterval(function () {
      if (finished()) { clearInterval(timer); return }
      var t = clamp((performance.now() - started) / durationMs, 0, 1)
      var eased = t < 0.85 ? Math.pow(t / 0.85, 0.72) : 0.94 + (t - 0.85) * 0.4
      var value = clamp(eased, 0, 1)
      var filled = Math.round(value * segs.length)
      for (var i = 0; i < segs.length; i++) {
        var on = i < filled
        if (segs[i].classList.contains('is-on') !== on) segs[i].classList.toggle('is-on', on)
      }
      if (pctNode) pctNode.textContent = t >= 1 ? '100%' : pad3(value * 100) + '%'
      if (t >= 1) clearInterval(timer)
    }, 32)
  }

  /** 状态日志：逐条打出，行尾标签渐显。 */
  function startLog(node, entries) {
    if (!node) return
    var i = 0
    function pushOne() {
      if (finished() || i >= entries.length) return
      var text = String(entries[i])
      var li = document.createElement('li')
      li.className = 'dsc-log__line'
      var label = document.createElement('i')
      label.className = 'dsc-log__caret'
      label.textContent = '›'
      var body = document.createElement('span')
      body.className = 'dsc-log__text'
      li.appendChild(label); li.appendChild(body)
      node.appendChild(li)
      sound.tick()
      var charsDone = 0
      var timer = setInterval(function () {
        if (finished()) { clearInterval(timer); return }
        charsDone += 2
        body.textContent = text.slice(0, charsDone)
        if (charsDone >= text.length) {
          clearInterval(timer)
          body.textContent = text
          li.classList.add('is-done')
        }
      }, 18 / state.speed)
      i++
      if (i < entries.length) later(560, pushOne)
    }
    pushOne()
  }

  /* ── 主要流程 ───────────────────────────────────────────────────────── */

  function releaseScroll() {
    try {
      document.documentElement.classList.remove('dsc-lock')
      if (document.body) document.body.style.overflow = ''
    } catch (e) { /* noop */ }
  }

  function markShown() {
    /* 预览页不写标记：否则在预览里播一遍，正式启动屏下次刷新就被判成"已播过"了 */
    if (CFG.preview === true) return
    try {
      if (CFG.mode === 'session') sessionStorage.setItem('dsc:splash', '1')
      if (CFG.mode === 'daily') localStorage.setItem('dsc:day', new Date().toISOString().slice(0, 10))
    } catch (e) { /* 隐私模式可能抛，忽略 */ }
  }

  /** 另一个启动屏插件是否在场（dsh-startup-screen 之类）：两段全屏动画叠播观感是灾难，
      所以按约定让位。要强制本插件播放，停用对方即可。 */
  function otherSplashPresent() {
    try {
      if (window.__DSH_STARTUP__ || window.__DSH_STARTUP_BOOT__ || window.__DSH_STARTUP_LOADED__) return true
      if (document.getElementById('dsh-startup-root')) return true
    } catch (e) { /* noop */ }
    return false
  }

  function teardown() {
    clearTimers()
    try { voice.cancel() } catch (e) { /* noop */ }
    sound.stop()
    var root = state.root || document.getElementById(ROOT_ID)
    if (root) {
      root.classList.add('is-leaving')
      setTimeout(function () {
        if (root && root.parentNode) root.parentNode.removeChild(root)
        releaseScroll()
      }, 260)
    } else {
      releaseScroll()
    }
    state.root = null
  }

  function finish(reason) {
    if (state.done) return
    state.done = true
    clearTimers()
    var root = state.root
    if (reason !== 'abort') markShown()
    var fadeStarted = false
    function fade() {
      if (fadeStarted) return
      fadeStarted = true
      try { voice.cancel() } catch (e) { /* noop */ }
      if (root) root.classList.add('is-exiting')
      setTimeout(teardown, REDUCED ? 60 : 760)
    }
    /* 自然收尾且还有一句在念：等它念完再淡出（最多 6s，避免异常卡死）。
       跳过/中止仍然立即掐断——那是用户明确要求"现在就关"。 */
    var waiting = false
    try {
      if (reason === 'done' && voice.isSpeaking && voice.isSpeaking()) {
        waiting = true
        var guard = 0
        var tick = function () {
          try {
            if (!voice.isSpeaking() || ++guard > 50) { fade(); return }
          } catch (e) { fade(); return }
          setTimeout(tick, 120)
        }
        setTimeout(tick, 120)
      }
    } catch (e) { /* noop */ }
    if (!waiting) fade()
  }

  function buildRoot() {
    var root = document.getElementById(ROOT_ID)
    if (!root) {
      root = document.createElement('div')
      root.id = ROOT_ID
      root.className = 'dsc-splash'
      root.setAttribute('role', 'presentation')
      root.setAttribute('aria-hidden', 'true')
      document.body.appendChild(root)
    }
    root.className = 'dsc-splash dsc-splash--boot dsc-splash--enter'
    root.innerHTML = markup()
    return root
  }

  function run() {
    state.done = false
    state.speed = clamp(Number(CFG.speed) || 1, 0.25, 4)
    var root = buildRoot()
    state.root = root
    try { window.__DSC_RUNNING__ = true } catch (e) { /* noop */ }
    try { document.documentElement.classList.add('dsc-lock') } catch (e) { /* noop */ }

    var q = function (name) { return root.querySelector('[data-dsc="' + name + '"]') }

    /* Logo 先拿：拿不到就整段继续播，只是少了徽标 —— 绝不让素材拖垮启动屏。 */
    var logos = Promise.all([
      CFG.showBsc === false ? Promise.resolve('') : fetchLogo('bsc'),
      CFG.showUeg === false ? Promise.resolve('') : fetchLogo('ueg'),
      CFG.showModel === false ? Promise.resolve('') : fetchLogo('model')
    ])

    /* 先落一层"通电"：机壳 + 网格 + 扫描带。这两步不等 logo。
       同步加类，不押在 rAF 上——rAF 在后台标签页/省电模式会被节流。 */
    root.classList.add('is-power')
    sound.power()

    var LOGO_WAIT = REDUCED ? 900 : 1600
    var started = false
    function begin() {
      if (started) return
      started = true
      startSequence(q)
    }
    /* 关键：logo 注入**不**受 started 限制。
       超时先 begin() 之后素材才到，也要补进去 —— 否则省电/慢网络下主角徽标会整块消失
       （审计发现的 reduced-motion 竞态就是这么来的）。 */
    function applyLogos(pair) {
      if (finished()) return
      var bsc = pair[0]
      var ueg = pair[1]
      var model = pair[2]
      var sealSlot = q('seal-slot')
      if (bsc && !sealSlot.firstElementChild &&
          injectLogo(sealSlot, bsc, 'bsc', (REDUCED || CFG.staticFrame === true) ? 'still' : 'play')) {
        var seal = q('seal')
        if (seal) seal.classList.add('is-ready')
      }
      var stampSlot = q('stamp-slot')
      if (ueg && !stampSlot.firstElementChild) injectLogo(stampSlot, ueg, 'ueg')
      var watermark = q('watermark')
      if (ueg && watermark && !watermark.firstElementChild) {
        injectLogo(watermark, ueg, 'ueg')
      }
      /* 工牌：正面 BSC 白色水印 + 背面蓝色徽章（真实 logo） */
      var badgeWm = q('badge-wm')
      if (bsc && badgeWm && !badgeWm.firstElementChild) injectLogo(badgeWm, bsc, 'bsc', 'still')
      var modelMark = q('model-mark')
      if (model && modelMark && !modelMark.firstElementChild) {
        modelMark.innerHTML = '<div class="dsc-550c">' + model + '</div>'
      }
      var badgeMark = q('badge-mark')
      if (bsc && badgeMark && !badgeMark.firstElementChild) injectLogo(badgeMark, bsc, 'bsc', 'still')
    }
    logos.then(function (pair) {
      applyLogos(pair)
      begin()
    })
    later(LOGO_WAIT, function () { if (!started) begin() })
  }

  function startSequence(q) {
    var root = state.root
    if (!root) return

    /* 静态帧模式（preview 的 ?static=1 / 自动化视觉回归用）：
       不走时间线，直接把整套元素推到"终态"，用来稳定地检查排版与配色。
       真实用户永远走下面的动画分支。 */
    if (CFG.staticFrame === true) {
      root.classList.add('is-power', 'is-rails', 'is-title', 'is-sub', 'is-meter', 'is-grant', 'is-static')
      /* 静态帧默认展示标题构图；?badge=1 时才把工牌顶到前面（用于单独截工牌那一屏）。
         ?face=front 只截正面，默认截背面（背面有姓名/编号）。 */
      if (CFG.staticBadge === true) root.classList.add('is-badge')
      var badgeStatic = q('badge')
      if (badgeStatic) {
        badgeStatic.classList.add('is-verified')
        if (CFG.staticFace !== 'front') badgeStatic.classList.add('is-flipped')
      }
      var badgeStatusStatic = q('badge-status')
      if (badgeStatusStatic) badgeStatusStatic.textContent = 'ACCESS GRANTED'
      var logAll = q('log')
      if (logAll) {
        STATUS.forEach(function (line) {
          var li = document.createElement('li')
          li.className = 'dsc-log__line is-done'
          li.innerHTML = '<i class="dsc-log__caret">›</i><span class="dsc-log__text">' + esc(line) + '</span>'
          logAll.appendChild(li)
        })
      }
      var pctAll = q('pct')
      if (pctAll) pctAll.textContent = '100%'
      var meterAll = q('meter')
      if (meterAll) {
        var segsAll = meterAll.querySelectorAll('.dsc-meter__seg')
        for (var s = 0; s < segsAll.length; s++) segsAll[s].classList.add('is-on')
      }
      var dataAll = q('data')
      if (dataAll) startDataStream(dataAll)
      /* 频谱条在静态帧里也要有起伏，不能是一整块色 */
      var waveAll = q('wave')
      if (waveAll) {
        var waveBars = waveAll.children
        for (var w = 0; w < waveBars.length; w++) {
          var hgt = 0.22 + 0.52 * Math.abs(Math.sin(w * 0.9 + 0.6)) + 0.22 * Math.abs(Math.cos(w * 2.1))
          waveBars[w].style.transform = 'scaleY(' + clamp(hgt, 0.1, 1).toFixed(3) + ')'
        }
      }
      return
    }

    if (REDUCED) {
      /* 减少动态：不做"逐段显现"，但也必须把**全部**状态类挂上——
         否则顶栏/左右栏/底栏保持 opacity:0，终态是残缺的（审计指出：原来只加了 4 个）。 */
      root.classList.add('is-power', 'is-rails', 'is-title', 'is-sub', 'is-meter', 'is-grant')
      var badgeCalm = q('badge')
      if (badgeCalm) badgeCalm.classList.add('is-verified')
      var badgeStatusCalm = q('badge-status')
      if (badgeStatusCalm) badgeStatusCalm.textContent = 'ACCESS GRANTED'
      var logNode = q('log')
      if (logNode) {
        STATUS.forEach(function (line) {
          var li = document.createElement('li')
          li.className = 'dsc-log__line is-done'
          li.innerHTML = '<i class="dsc-log__caret">›</i><span class="dsc-log__text">' + esc(line) + '</span>'
          logNode.appendChild(li)
        })
      }
      var meterNode = q('meter')
      if (meterNode) {
        var segsR = meterNode.querySelectorAll('.dsc-meter__seg')
        for (var r = 0; r < segsR.length; r++) segsR[r].classList.add('is-on')
      }
      var pctR = q('pct')
      if (pctR) pctR.textContent = '100%'
      later(1600, function () { finish('done') })
      return
    }

    /* 0.32s：顶部导轨 + 信息栏 */
    later(320, function () {
      root.classList.add('is-rails')
      var data = q('data')
      startDataStream(data)
    })

    /* 0.42s：徽标播放（markup 在 logo 注入时就已带 data-mode=play） */
    later(420, function () {
      var seal = q('seal')
      if (seal) seal.classList.add('is-live')
    })

    /* 0.95s：主标题逐字砸下 + 播报第 1 句 */
    later(900, function () {
      root.classList.add('is-title')
      sound.slam()
      voice.speak(0)
    })

    /* 1.60s：英文副标 */
    later(1560, function () {
      root.classList.add('is-sub')
    })

    /* 1.85s：进度条 + 波形 + 状态日志（进度条时长跟 speed 一起缩放） */
    later(1820, function () {
      root.classList.add('is-meter')
      startWave(q('wave'))
      startMeter(q('meter'), q('pct'), 2600 / state.speed)
      startLog(q('log'), STATUS)
    })

    /* 工牌时间线：核验通过后按 badgeHold 停留，退场、授权、收尾依次顺延。
       默认 2400ms —— 工牌照出现一两秒就被收走时根本看不清姓名/编号。 */
    var BADGE_IN = 3050
    var BADGE_SCAN = BADGE_IN + 260
    var BADGE_FLIP = BADGE_IN + 1300
    var BADGE_VERIFY = BADGE_FLIP + 700
    var HOLD = clamp(Number(CFG.badgeHold == null ? 2400 : CFG.badgeHold), 0, 8000)
    var BADGE_OUT = BADGE_VERIFY + HOLD
    /* 工牌退场之后别急着收：授权画面停留 ~2.4s 再淡出 */
    var GRANT_AT = Math.max(BADGE_OUT + 420, 5700)
    var FINISH_AT = GRANT_AT + 2400

    /* 工牌准入 —— 核心内容退成背景，工牌正面升起并开始扫描 */
    if (CFG.badge !== false) {
      later(BADGE_IN, function () {
        root.classList.add('is-badge')
        sound.scan()
      })
      later(BADGE_SCAN, function () {
        var badge = q('badge')
        if (badge) badge.classList.add('is-scanning')
      })
      /* 正面扫完 → 翻到背面（背面才是姓名/编号/职务） */
      later(BADGE_FLIP, function () {
        var badge = q('badge')
        if (badge) badge.classList.add('is-flipped')
      })
      /* 翻面到位 → 核验通过，状态条变 ACCESS GRANTED，同时播报操作员 */
      later(BADGE_VERIFY, function () {
        var badge = q('badge')
        var status = q('badge-status')
        if (badge) badge.classList.add('is-verified')
        if (status) status.textContent = 'ACCESS GRANTED'
        sound.verify()
        voice.speak(1)
      })
      /* 停留 HOLD 毫秒后工牌退场 */
      later(BADGE_OUT, function () {
        root.classList.add('is-badge-out')
      })
    } else {
      later(1820, function () { voice.speak(1) })
    }

    /* 授权横幅（工牌退场之后） */
    later(GRANT_AT, function () {
      root.classList.add('is-grant')
      sound.grant()
      voice.speak(2)
    })

    /* 收尾 */
    later(FINISH_AT, function () { finish('done') })
  }

  /* ── 跳过交互 ───────────────────────────────────────────────────────── */

  function onSkipIntent(event) {
    if (CFG.allowSkip === false) return
    if (event.type === 'keydown') {
      var k = event.key
      if (k !== 'Escape' && k !== 'Enter' && k !== ' ' && k !== 'Spacebar') return
    }
    try { event.preventDefault() } catch (e) { /* noop */ }
    finish('skip')
  }

  function bindSkip(root) {
    if (CFG.allowSkip === false) return
    root.addEventListener('click', onSkipIntent, { passive: false })
    window.addEventListener('keydown', onSkipIntent)
    window.addEventListener('pointerdown', onSkipIntent, { passive: false })
  }

  function unbindSkip(root) {
    if (root) root.removeEventListener('click', onSkipIntent)
    window.removeEventListener('keydown', onSkipIntent)
    window.removeEventListener('pointerdown', onSkipIntent)
  }

  /* ── 启动 ───────────────────────────────────────────────────────────── */

  function boot() {
    var yieldToOther = false
    try { yieldToOther = otherSplashPresent() } catch (e) { /* noop */ }
    if (window.__DSC_SKIP__ === true || yieldToOther) {
      var stale = document.getElementById(ROOT_ID)
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale)
      releaseScroll()
      if (yieldToOther && window.__DSC_SKIP__ !== true) {
        try {
          console.info('[dsh-supreme-command] 检测到另一个启动屏插件（如 dsh-startup-screen），本次让位不播放。' +
            '要使用本插件的启动屏，请先停用对方的启动屏插件。')
        } catch (e) { /* noop */ }
      }
      return
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true })
      return
    }
    run()
    if (state.root) bindSkip(state.root)
    /* 播放结束后解绑，别把监听留在页面上 */
    var poll = setInterval(function () {
      if (finished()) { clearInterval(poll); unbindSkip(state.root) }
    }, 400)
  }

  /* 供设置面板「重播」用：卸载旧节点、重跑一遍。 */
  function replay() {
    clearTimers()
    unbindSkip(state.root)
    var old = document.getElementById(ROOT_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
    state.done = false
    try { window.__DSC_RUNNING__ = false } catch (e) { /* noop */ }
    run()
    if (state.root) bindSkip(state.root)
    return true
  }

  window.__DSC_SPLASH__ = {
    replay: replay,
    finish: finish,
    version: CFG.version || '0.0.0',
    get running() { return !state.done }
  }

  boot()
})()
