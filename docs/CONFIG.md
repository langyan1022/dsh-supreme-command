# dsh-supreme-command — 共享契约（配置 / 变量 / 文件布局）

> 这份文档是**唯一的接口契约**。Host 半侧（`lib/index.js`）、启动屏（`lib/splash.js` + `lib/splash.css`）、
> 主题（`lib/theme.css`）、设置面板（`lib/client.js`）、Logo（`lib/logos/*`）都只按这里写。

## 1. 插件身份

| 项 | 值 |
|----|----|
| 包名 | `dsh-supreme-command` |
| 路由前缀 | `/dsh-command` |
| 配置文件 | `$DSH_HOME/dsh-supreme-command.json` |
| HTML 根属性 | `html[data-dsh-command="on"]`（主题开启；bootstrap 在首帧前挂） |
| CSS 前缀 | `dsc-`（插件自有类名一律以此开头） |
| CSS 变量前缀 | `--dsc-`（插件自有变量） |
| 配置 API | `GET/POST /dsh-command/config` |
| 静态资源 | `/dsh-command/theme.css`、`/dsh-command/splash.css`（= splash.css+logos.css 合并）、`/dsh-command/splash.js`、`/dsh-command/logo/ueg.svg`、`/dsh-command/logo/bsc.svg` |
| 桌面端自举 | `/dsh-command/selfboot.js`（没有 Host 注入时由客户端加载，内容与 tapIndex 注入同源）、`/dsh-command/vars.css` |
| 其它 | `/dsh-command/health`（自检）、`/dsh-command/preview`（独立预览页） |

## 2. 配置字段（`lib/index.js` 的 `DEFAULTS` 必须与此完全一致）

### 开关与模式
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | bool | `true` | 主题总开关（DSH 界面皮肤） |
| `splashEnabled` | bool | `true` | 启动屏总开关 |
| `mode` | enum | `'session'` | `always` 每次刷新 / `session` 每会话一次 / `daily` 每天一次 |
| `speed` | number | `1` | 启动动画速度倍率，范围 `0.5 ~ 2` |
| `allowSkip` | bool | `true` | 允许 Esc/点击跳过 |

### 配色（核心：全部可调）
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `preset` | enum | `'command-red'` | 见 §3；选预设时 `accent/accent2/bgBase/textPrimary` 被预设值覆盖 |
| `accent` | color | `'#ff3b30'` | 主色（HUD 线条、按钮、选中、Logo 主色） |
| `accent2` | color | `'#ff8a5c'` | 辅色（渐变、高光、次强调） |
| `bgBase` | color | `'#080305'` | 界面底色（留空 `''` = 用预设值） |
| `textPrimary` | color | `'#f3e7e4'` | 主文字色（留空 `''` = 用预设值） |
| `themeMode` | enum | `'force-dark'` | `force-dark` 强制深色 / `auto` 跟随用户配色 |

### 质感效果
| 字段 | 类型 | 默认 | 范围 | 说明 |
|------|------|------|------|------|
| `glow` | number | `1` | `0 ~ 2` | 发光强度（文字/线条外发光、扫描线亮度） |
| `scanlines` | number | `0.5` | `0 ~ 1` | 扫描线强度 |
| `grain` | number | `0.35` | `0 ~ 1` | 噪点/网格颗粒 |
| `hudFrames` | bool | `true` | — | 面板四角 HUD 直角框 |
| `vignette` | number | `0.6` | `0 ~ 1` | 暗角强度 |
| `watermark` | bool | `true` | 主题中央的 UEG 大徽标模糊水印 |
| `cornerLogo` | bool | `true` | 主题右上角的北京航天中心（BSC）机构徽标 |
| `modelLogo` | bool | `true` | 主题左侧导航栏底部的 550C 主机型号标识 |
| `autoFullscreen` | bool | `true` | 桌面端启动时把主窗口最大化（只发 SW_MAXIMIZE，不改 DSH 本体） |

### 启动屏文案
| 字段 | 类型 | 默认 |
|------|------|------|
| `titleZh` | text | `'智能量子计算机'` |
| `titleZh2` | text | `'重点实验室'` |
| `subtitleEn` | text | `'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER'` |
| `org` | text | `'DEEPSEEK HARNESS'` |
| `orgZh` | text | `'深度求索'` |
| `clearLevel` | text | `'绝密 / TOP SECRET'` |
| `operator` | text | `'丁兵兵'` |
| `operatorId` | text | `'0912'` |
| `footer` | text | `'POWERED BY DEEPSEEK'` |
| `statusLines` | text（多行，`\n` 分隔） | 见下 |

`statusLines` 默认：
```
建立安全信道 … OK
校验操作员生物签名 … OK
解密绝密指令包 … OK
载入 HARNESS 运行时 … OK
```

### 工牌准入（《流浪地球2》北京航天中心 IQC 实验室胸卡：正反两面、无照片）
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `badge` | bool | `true` | 启动序列中间展示工牌（扫描 → 翻面 → 准入通过） |
| `badgeName` | text | `'图恒宇'` | 背面大字姓名 |
| `badgeId` | text | `'IDL.IQC-001'` | 正面红色编号带 + 背面编号行 |
| `badgeNo` | text | `'222179'` | 背面编码第二段 |
| `badgePinyin` | text | `'TU HENGYU'` | 背面编码末段 |
| `badgeOrg` / `badgeOrgEn` | text | `'北京航天中心'` / `'BEIJING SPACE CENTER'` | 机构名（背面徽标列 + 正面色条） |
| `badgeLab` | text | `'智能量子计算机重点实验室'` | 正面/背面实验室名 |
| `badgeLabEn` | text | `'KEY LABORATORY OF INTELLIGENT QUANTUM COMPUTER'` | 实验室英文名 |
| `badgeLabShort` | text | `'IQC'` | 正面那个大字 |
| `badgeRole` | text | `'研究员'` | 背面职务 |
| `badgeClearance` | text | `'L1'` | 背面权限等级 |

> 电影里这张卡**没有照片**，所以本插件也不放头像，也就不需要任何电影剧照素材；
> 卡片是纯 CSS 画的浅色胸卡（正面 IQC + 编号带 + 条码 / 背面 BSC 徽标 + CS 色块 + 姓名职务）。

### 语音播报（音色/节奏参照 `dsh-startup-screen`）
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `voice` | bool | `true` | 语音总开关 |
| `voiceLang` | enum | `'zh'` | `zh` / `en` / `both`（双语先中后英） |
| `voiceName` | text | `''` | 指定系统音色名；空 = 自动按分数挑 |
| `voiceRate` | number | `0.88` | 语速，`0.5 ~ 2`（参考插件同值：电影旁白档） |
| `voicePitch` | number | `0.85` | 音调，`0 ~ 2`（压低音调，深沉的 AI 女声） |
| `voiceVolume` | number | `0.9` | 音量 `0 ~ 1` |
| `voiceCue` | bool | `true` | 念之前的提示音（1046.5 + 1568 Hz） |
| `voiceLead` | number | `240` | 提示音后留白（ms，`0 ~ 1200`） |
| `voiceSource` | enum | `'tts'` | `tts` 系统合成 / `asset` 优先用 `lib/assets/voice/*.mp3` |
| `voiceLine1/2/3` | text | 见下 | 三段中文台词（标题 / 操作员 / 授权） |
| `voiceLine1En/2En/3En` | text | 见下 | 对应的英文台词（`voiceLang=en/both` 时用） |

台词默认：
```
voiceLine1   = 智能量子计算机重点实验室，绝密。
voiceLine2   = 操作员 {operator}，权限验证通过。
voiceLine3   = 授权通过，正在进入系统。
voiceLine1En = Key Laboratory of Intelligent Quantum Computer. Top secret.
voiceLine2En = Operator {operator}. Clearance verified.
voiceLine3En = Authorization granted. Entering system.
```
占位符只认这六个：`{operator}` `{id}` `{titleZh}` `{titleZh2}` `{clearLevel}` `{org}`。
留空的句子不播。

### 素材与声音
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showUeg` | bool | `true` | 显示 UEG 徽标 |
| `showBsc` | bool | `true` | 显示 BSC 动画徽标（橄榄枝逐叶浮现动画保留） |
| `showModel` | bool | `true` | 启动屏左上角显示 550C 主机型号标识 |
| `logoColor` | enum | `'accent'` | Logo 着色：`accent` / `accent2` / `text` / `custom` |
| `logoCustom` | color | `'#ff3b30'` | `logoColor=custom` 时使用 |
| `sound` | bool | `true` | 界面音效（WebAudio 合成，无素材文件） |
| `soundVolume` | number | `0.4` | `0 ~ 1` |

## 3. 预设（唯一来源：`lib/palettes.js`）

| id | 名称 | accent | accent2 | bgBase | textPrimary |
|----|------|--------|---------|--------|-------------|
| `command-red` | 统帅红 | `#ff3b30` | `#ff8a5c` | `#080305` | `#f3e7e4` |
| `amber` | 琥珀终端 | `#ffb020` | `#ffd76a` | `#0a0703` | `#f5eddf` |
| `cyan` | 全息青 | `#22d3ee` | `#7dd3fc` | `#03080a` | `#e2f6fa` |
| `green` | 战术绿 | `#35e07a` | `#a3e635` | `#040a06` | `#e3f7ea` |
| `violet` | 深空紫 | `#a855f7` | `#e879f9` | `#08040e` | `#f0e8fb` |
| `mono` | 冷白机 | `#e5e7eb` | `#9ca3af` | `#09090b` | `#f4f4f5` |

`custom` 不是预设：用户改 `accent` 时 `preset` 自动变 `custom`，其余值沿用上一次预设的骨架。

## 4. CSS 变量契约（Host 计算并注入，其余全部由 `color-mix` 派生）

Host 在每个 index 响应里注入：

```html
<style id="dsh-command-vars">
:root{
  --dsc-accent:#ff3b30;
  --dsc-accent-2:#ff8a5c;
  --dsc-bg:#080305;
  --dsc-text:#f3e7e4;
  --dsc-glow:1;
  --dsc-scanlines:0.5;
  --dsc-grain:0.35;
  --dsc-vignette:0.6;
  --dsc-logo:#ff3b30;        /* 已解析成具体色：accent / accent2 / text / logoCustom */
  --dsc-hud-frames:1;        /* 0/1，面板四角 HUD 框开关（theme.css 里乘进 alpha） */
}
</style>
```

`themeMode: 'auto'` 时，同一段 `<style>` 末尾还会追加一条
`html[data-dsh-command="on"]{color-scheme:auto}`（同特异性、更晚声明 → 压过 theme.css 里的 `dark`），
把原生滚动条/表单控件交还给系统；色板本身不变。

`lib/theme.css` / `lib/splash.css` / `lib/logos/logos.css` **只消费** `--dsc-*`，并且必须为每个变量提供
fallback（例如 `var(--dsc-accent, #ff3b30)`），这样预览页单文件打开也不会崩。

派生变量（由 `theme.css` 自己按需定义，其他文件可以复用）：
`--dsc-bg-1`（面板）、`--dsc-bg-2`（浮层）、`--dsc-bg-3`（输入框）、`--dsc-line`、`--dsc-line-strong`、
`--dsc-text-2`、`--dsc-text-3`、`--dsc-glow-soft`。

## 5. 文件布局（谁写谁）

```
package.json            lead
cordis.patch.yml        lead
lib/palettes.js         lead
lib/index.js            lead      Host：配置、路由、index.html 注入、变量计算
lib/theme.css           theme-weaver DSH 界面皮肤（125 枚 token 覆盖 + HUD 装饰）
lib/splash.css          lead      启动屏样式
lib/splash.js           lead      启动屏运行时（时间线）
lib/logos/ueg.js        logo-artisan   UEG 徽标（scoped + currentColor）
lib/logos/bsc.js        logo-artisan   BSC 动画徽标（动画保留 + scoped + currentColor）
lib/logos/logos.css     logo-artisan   Logo 用 keyframes（全部 scoped）
preview/index.html      lead      独立预览（启动屏 + 模拟 DSH 外壳）
preview/logos.html      logo-artisan   两个 Logo 的独立检验页
preview/theme.html      theme-weaver   主题样张（仿真 DSH 外壳）
lib/client.js           settings-smith 设置面板（ModuleLoader bundle）
README.md               lead
docs/logos.md           logo-artisan
test/*.mjs              lead
```

**写入范围是硬的**：只改自己名下的文件，不要顺手改别人的；需要别人改动时报告给 lead。

## 6. 无构建步骤

仓库**没有** bundler，所有产物就是手写源文件：
- Host 半侧是 ESM（`"type": "module"`），Node ≥ 20。
- `lib/client.js` 是**手写 CommonJS-ish bundle**，外层必须是
  `window.__ModuleLoader__.load({ id: 'dsh-supreme-command', factory: (require) => { ... return module.exports } })`，
  `exports.apply` / `exports.inject` 的写法照抄 `dsh-startup-screen/lib/client.js` 与 `dsh-dream-skin/lib/client.js`。
- 浏览器侧不允许 `import`，只允许 `require('react')` 这类平台种子模块。

## 7. 设置面板（`lib/client.js`）要求

- `inject = ['slots']`，`ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'supreme-command', order: 27, label: '流浪地球主题' }, () => h(Panel, {})))`。
- 数据源：`GET /dsh-command/config` → `{ ok, version, config, defaults, presets, file }`；保存：`POST /dsh-command/config`，
  body `{ patch: {...} }`，`{ action: 'reset' }` 恢复默认。
- 分组顺序：**配色**（nabled 总开关 + 预设卡片网格 + 4 个基色选择器 accent/accent2/bgBase/textPrimary + themeMode）→ **质感**（4 个滑杆 + hudFrames）→
  **启动屏**（开关/模式/速度/文案/身份/statusLines/Logo/声音）→ **关于**（版本、配置文件路径、恢复默认、预览链接）。
- 面板全部类名以 `__ss_` 开头（与参考插件一致的隔离方式），颜色/排版用 DSH 自己的 `--dsw-alias-*` 变量以融入设置页。
- 预设卡片要能直接预览颜色（两色渐变小方块 + 名称），选中态用边框高亮。

## 8. 验收命令

```bash
# 语法
node --check lib/index.js
node -e "import('./lib/palettes.js').then(m=>console.log(Object.keys(m.PRESETS)))"
# 启动屏静态自检（不开浏览器）
node test/smoke-host.mjs && node test/smoke-splash.mjs
# 视觉：先起预览服务器，再截图（shot.mjs 必须带 url 与 out）
node scripts/serve.mjs 8791
node scripts/shot.mjs http://127.0.0.1:8791/preview/index.html?static=1 shots/你的截图名.jpg 1440 900 900
node scripts/shot.mjs            # 写 shots/*.png
```
