# 智能量子计算机 · 重点实验室 — DSH 启动屏与主题

> **一个插件，两件事**：给 DeepSeek Harness 换上一套「暗色金属控制台 + 红色 HUD 屏」的
> **启动屏**，以及**同色板的界面主题**。再带上两枚官方徽标 —— UEG 徽标（静态）与
> BSC 橄榄枝徽标（**原动画完整保留**、颜色跟随主题、可换任意配色）。
>
> 启动序列里还有：**BSC 实验室工牌准入**（《流浪地球2》北京航天中心的 IQC 胸卡，正反两面扫描翻面，
> 姓名/编号/实验室/职务都能在设置里改，默认图恒宇）、**MOSS 式开屏**（中央 550W 描边→填充 +
> 底部中英两行）、**发光粒子背景**、**三段 MOSS 音色语音**（本机 OmniVoice 合成；音色与节奏参照
> `dsh-startup-screen`：神经网络女声优先、0.88 语速、0.85 音调、念前提示音）。

配色不是写死的：**6 套预设 + 全量自定义**，所有派生色（面板、线条、文字阶梯、发光）
都由 4 个基色用 `color-mix()` 现算 —— 改一只主色，整屏整界面一起变。

![启动屏](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/splash-hero.jpg)
![流浪地球主题界面](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/ui-red-dark.jpg)

---

## 目录

- [它长什么样](#它长什么样)
- [安装 / 卸载](#安装--卸载)
- [能调什么（设置 → 流浪地球主题）](#能调什么设置--流浪地球主题)
- [配色系统](#配色系统)
- [两枚徽标](#两枚徽标)
- [启动屏编排（时间线）](#启动屏编排时间线)
- [安全与容错](#安全与容错)
- [目录结构](#目录结构)
- [开发与验证](#开发与验证)
- [已知边界](#已知边界)

---

## 它长什么样

| 启动屏（进度 / 日志阶段） | 启动屏（授权通过） |
|---|---|
| ![进度](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/splash-progress.jpg) | ![授权](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/splash-grant.jpg) |

| 界面主题：统帅红 | 界面主题：全息青 |
|---|---|
| ![红](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/ui-red-dark.jpg) | ![青](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/ui-cyan.jpg) |

| BSC 徽标动画中段 | 徽标终态 |
|---|---|
| ![t=3.5s](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/logos-3-play-t3500.jpg) | ![终态](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/logos-4-play-t6000.jpg) |

| 工牌准入（背面 · 姓名/编号/职务） | 工牌正面（IQC + 条码） |
|---|---|
| ![工牌背面](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/badge-back.jpg) | ![工牌正面](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/badge-front.jpg) |

---

## 安装 / 卸载

**要求**：Node.js ≥ 20（DSH 自带运行时，一般不用另装）；DSH 版本 ≥ `0.2.2-rc.1`（见[已知边界](#已知边界)）。

### 从 GitHub 安装（推荐，不需要 npm 账号）

一条命令（PowerShell）——克隆到 `~/.dsh/local-plugins/` 再装进 desktop profile：

```powershell
irm https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/install.ps1 | iex
```

需要 `git` 和 `node ≥ 20`（DSH 用户一般都有 Node；没有就先装 Git for Windows + Node.js）。

脚本参数（本地执行时用）：

```powershell
.\install.ps1                   # desktop profile
.\install.ps1 -Profile web      # web profile
.\install.ps1 -ReplaceStartup   # 顺带停用其它启动屏插件
.\install.ps1 -Uninstall        # 卸载
```

> 以后更新：再跑一次同一条命令（会 `git reset --hard origin/main` 到最新版，然后重装/刷新联接）。

也可以在 **设置 → 插件 → 安装插件** 里直接填：

```text
github:langyan1022/dsh-supreme-command
```

或命令行：`dsh plugin --profile desktop add github:langyan1022/dsh-supreme-command`
（走 DSH 内置 pnpm；如果本机 pnpm 对 git 源有限制，用上面的 `install.ps1` 更稳）。

### 从 npm 安装（待发布）

```text
dsh-supreme-command
```

> 发布/维护细节见 [docs/PUBLISH.md](docs/PUBLISH.md)：
> DSH 的"插件市场"目前只收**官方**组合包（随安装提供 + 官方可选包），
> 第三方插件的分发方式是 **GitHub 仓库或 npm 包**，不经过市场目录。

### 一键安装

```powershell
# 在插件目录里执行（也可以直接双击 安装.cmd）
node scripts/install.mjs
```

脚本做两件事，都可以单独回退：

1. 在 `~/.dsh/profiles/desktop/node_modules/` 下建一个**目录联接**指向本插件目录；
2. 往 `~/.dsh/profiles/desktop/cordis.patch.yml` 追加一段**带注释标记的 insert 条目**（原文件自动备份）。

装完 **完全退出 DSH 再打开**（Web 版：关掉 `dsh web` 进程再起）。刷新页面就能看到启动屏，
进界面后是 HUD 主题。

可选参数：

```powershell
node scripts/install.mjs --profile web        # 装到 web profile
node scripts/install.mjs --dry-run            # 只打印将要做的事
node scripts/install.mjs --replace-startup    # 顺带停用 profile 里其它启动屏插件（推荐）
node scripts/install.mjs --uninstall          # 卸载（删联接 + 删托管块）
```

> ⚠️ 不要**同时**用 `dsh plugin add` 和本脚本安装：那会让插件注册两遍，`apply` 跑两遍，
> 路由重复注册会报错。若你之前手工加过同名条目，脚本会检测到并中止。
> 详见 [docs/INSTALL.md](docs/INSTALL.md)。

> ⚠️ **别和别的启动屏插件一起开**：两个"全屏启动动画"同时启用会叠播（同为 `z-index: 2147483000`）。
> 本插件检测到 `dsh-startup-screen` 等插件的痕迹会**主动让位不播放**（控制台会有提示），
> 界面主题不受影响。想让本插件接管启动屏，用 `--replace-startup` 装：
> 它只把对方从 `dsh.profile.bundles` 里摘掉（**不卸载、不删配置**，随时能加回去），
> 并会把 `package.json` 备份一份。
>
> 这台机器上已经用 `--replace-startup` 装好了（desktop profile）：联接 + patch 托管块 + 停用
> `dsh-startup-screen`。**完全退出 DSH 再打开**就能看到新启动屏与主题。

### 卸载

```powershell
node scripts/install.mjs --uninstall     # 或双击 卸载.cmd
```

---

## 能调什么（设置 → 流浪地球主题）

设置页里新增一个分区 **「流浪地球主题」**（顺序 27），四组面板：

| 组 | 字段 | 说明 |
|---|---|---|
| **配色** | `preset` | 6 套预设色卡，点一下整套配色跟着换 |
| | `accent` / `accent2` | 主色 / 辅色（HUD 线条、标题、按钮、徽标主色） |
| | `bgBase` / `textPrimary` | 画布底色 / 正文色；留空 = 跟预设 |
| | `themeMode` | `force-dark` 固定暗色（原生控件也暗）/ `auto` 原生控件交还系统 |
| **质感** | `glow`(0–2) | 发光强度：文字辉光、线条发光、扫描带亮度一起缩放；`0` = 全关 |
| | `scanlines`(0–1) | 扫描线密度/亮度；`0` = 完全消失 |
| | `grain`(0–1) | 网格/颗粒 |
| | `vignette`(0–1) | 暗角 |
| | `hudFrames` | 面板四角 HUD 直角框开关 |
| **启动屏** | `splashEnabled` | 启动屏总开关 |
| | `mode` | `always` 每次刷新 / `session` 每会话一次 / `daily` 每天一次 |
| | `speed`(0.5–2) | 整段动画速度倍率 |
| | `allowSkip` | 允许 Esc / Enter / 空格 / 点击跳过 |
| | 9 个文案字段 | 标题、副标、组织、密级、操作员、页脚…… |
| | `statusLines` | 状态日志，一行一条 |
| | `showUeg` / `showBsc` | 两枚徽标分别开关 |
| | `logoColor` / `logoCustom` | 徽标着色：主色 / 辅色 / 正文色 / 自定义 |
| | `sound` / `soundVolume` | 界面音效（WebAudio 合成，无音频文件） |
| **关于** | — | 版本、配置文件路径、恢复默认、重播启动屏 |

配置落在 **`~/.dsh/dsh-supreme-command.json`**（不走 DSH 的 settings 命名空间，
不受 `dsh-settings` 版本漂移影响）。**改完刷新页面即生效，不用重启**。

也可以直接手改这个 JSON，或调接口：

```powershell
curl http://127.0.0.1:10022/dsh-command/config                      # 读
curl -X POST http://127.0.0.1:10022/dsh-command/config -d '{"patch":{"preset":"cyan"}}'
curl -X POST http://127.0.0.1:10022/dsh-command/config -d '{"action":"reset"}'
```

---

## 配色系统

| 预设 id | 名称 | 主色 | 辅色 | 底色 |
|---|---|---|---|---|
| `command-red` | 统帅红（默认） | `#ff3b30` | `#ff8a5c` | `#080305` |
| `amber` | 琥珀终端 | `#ffb020` | `#ffd76a` | `#0a0703` |
| `cyan` | 全息青 | `#22d3ee` | `#7dd3fc` | `#03080a` |
| `green` | 战术绿 | `#35e07a` | `#a3e635` | `#040a06` |
| `violet` | 深空紫 | `#a855f7` | `#e879f9` | `#08040e` |
| `mono` | 冷白机 | `#e5e7eb` | `#9ca3af` | `#09090b` |

**只有 4 个基色是真值**，其余全部现算：

```css
/* 面板层级：底色 + 一点正文色 → 石墨金属，不掺主色 */
--dsc-bg-1: color-mix(in srgb, var(--dsc-bg) 92%, var(--dsc-text) 8%);
/* 线条：主色的发丝级透明版 */
--dsc-line: color-mix(in srgb, var(--dsc-accent) 16%, transparent);
/* 文字阶梯：正文色往底色收 */
--dsc-text-2: color-mix(in srgb, var(--dsc-text) 78%, var(--dsc-bg));
```

所以「改主色」不会只变几个按钮 —— 描边、选中态、发光、徽标、启动屏扫描线会一起走。
换了 `accent` 但没换预设时，`preset` 自动落到 `custom`，界面不会骗你。

> 设计取向：这是**生产力界面**，不是海报。正文接近白（`#f3e7e4`，对底色 16.9:1），
> 主色只出现在描边、选中、链接、按钮、徽标这些「HUD 发光件」上。

---

## 两枚徽标

你给的两个 Illustrator 文件都被**逐字节保留几何路径**，只做了四件事：
作用域化、`currentColor` 换色、`id`→`class`、删掉页面级全局选择器（`:root`、`svg{padding:30px}`）。

### UEG 徽标（`lib/logos/ueg.js`，3000×3500，静态）

- 4 条路径全部保留；类名 `dsc-ueg-*`。
- 用在启动屏两处：右下角**圆形印章**，以及标题后**极淡的大水印**（opacity ≈ 0.03 + 微模糊）。

### BSC 橄榄枝徽标（`lib/logos/bsc.js`，3000×705，动画）

26 条路径 + **原动画一条不少**：

| 动画 | 源语义 | 产物 |
|---|---|---|
| 橄榄枝 20 片逐叶浮现 | `olive-display`，100ms/片，延迟 ×10…×1 | 保留，节拍变量 `--olive-leaf-display-time` 可覆盖 |
| 内环描边→填充 | `fillAnimation 3s`，delay 2s，dasharray/offset 2000 | 保留 |
| 外环描边→填充 | `fillAnimation 4s`，delay 1s | 保留 |
| 中央三角自下揭示 | `clip-path inset(100% 0 0 0)` → `0`，2s | 保留 |
| 上下两行文字擦除 | `clip-path inset(0 100% 0 0)` → `0`，2s，delay 2s | 保留 |
| 中央 BSC 字标中线展开 | `clip-path inset(0 50% 0 50%)` → `0`，3s | 保留（delay 3s，见下） |

用法：

```html
<div class="dsc-bsc" data-mode="play"> …BSC_SVG… </div>   <!-- 播放 -->
<div class="dsc-bsc" data-mode="still"> …BSC_SVG… </div>  <!-- 直接终态 -->
<div class="dsc-ueg"> …UEG_SVG… </div>
```

- **改色**：根 `svg` 上是 `color: var(--dsc-logo, currentColor)`，
  所以 `--dsc-logo`、外层 `color`、或设置页的「徽标着色」三者都能改，填充与描边一起走。
- **重播**：`import { replayBsc } from './lib/logos/bsc.js'; replayBsc(container)`。
- **省电/无障碍**：`prefers-reduced-motion: reduce` 时等同 `still`（直接终态，不闪动）。
- 源文件里中央字标把 `animation-delay:3s` 写在了 `animation` 简写**之前**，实际会被重置成 `0s`；
  这里按作者意图实现为真 3s。想要 1:1 复刻浏览器的实际（0s）表现，把 `lib/logos/logos.css`
  里那条 `animation-delay` 改成 `0s` 即可。

---

## MOSS 式开屏（0–2.8s）

参考本机 MOSS 服务（`http://127.0.0.1:18221`，只读参考，不改它）的 identity 开场，做成主题自己的版本：

- **中央 550W 标识**：沿用电影里的 550W 字形（由 MOSS 的 `550w.svg` 转换的 scoped 模块），
  先描边画出（1s）、再填充（0.52s，延迟 0.64s），红色 "0" 保持 #f51b19；
- **底部两行**：中文 `智能量子计算机 550W` + 英文 `INTELLIGENT QUANTUM COMPUTER MOSS`，
  居中、字距拉开，像 MOSS 的开场字幕；
- 填充完后再停留约 1.2s，然后整层淡出（0.9s）；主序列整体延后 2.8s 开始（`later()` 统一缩放，`speed` 也一样生效）；
- **静态帧 / 减少动态**时不播开屏（`?static=1` 截图、prefers-reduced-motion 都直接跳过）。

补帧：开屏那枚 550W 是**服务端内联**进 `splash.js` 的（`/*__DSC_OPEN_LOGO__*/` 占位符），
所以首帧就有 logo，不会因为拉取素材把描边动画拖晚。

![开屏](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/splash-open.jpg)

## 发光粒子背景

启动屏底层加了一层 canvas 粒子：主题色（`accent`/`accent2`）的细碎光点，`lighter` 混合、
缓慢上浮 + 呼吸闪烁，数量按视口面积自适应（26–88 个）。

- `prefers-reduced-motion` / 静态帧：只画一帧，不动；
- 粒子失败不影响启动屏（整段 try/catch，失败就跳过）。

## 启动屏编排（时间线）

全屏 HUD：机壳 → 屏体 → 顶栏 / 左右信息栏 / 中央核心 / **工牌准入** / 底部遥测 / 授权横幅。
`speed=1` 时全程约 **11 秒**（工牌停留 `badgeHold` 可调；授权画面还会再停 ~2.4s 才淡出 720ms 收尾）：

| 时间 | 事件 |
|---|---|
| 0.00s | 黑幕 + 机壳点亮，一道扫描带自上而下扫过 |
| 0.22s | HUD 框线、四角直角标、技术网格、边缘刻度落位 |
| 0.32s | 顶部导轨、左右信息栏点亮；右侧伪遥测数据流开始滚动 |
| 0.42s | **BSC 徽标开播**（逐叶 → 双环 → 三角 → 文字） |
| 0.90s | 标题「智能量子计算机 · 重点实验室」逐字砸下（每字 42ms 错位 + 模糊收敛）+ 第 1 句播报 |
| 1.56s | 英文副标字距收拢 |
| 1.82s | 分段进度条推进 + 频谱条跳动 + 状态日志逐条打出（每行一声轻响） |
| 3.05s | **工牌准入**：核心内容退成背景，胸卡升起（正面 IQC + 编号带 + 条码） |
| 3.31s | 扫描线自上而下扫过卡面 |
| 4.35s | 扫完**翻到背面**（姓名 / 编号 / 实验室 / 职务 / 条码） |
| 5.05s | 「准入通过 · ACCESS GRANTED」+ 第 2 句播报（操作员验证通过） |
| 5.05s + `badgeHold`（默认 2.4s） | 工牌停留在这里，足够看清姓名 / 编号 / 条码 |
| 退场后 ~0.4s | 工牌退场、核心内容恢复；「授权通过 / AUTHORIZATION GRANTED」横幅 + 第 3 句播报 |
| 授权后 ~2.4s（终幕语音没念完就等它念完） | 收尾：720ms 淡出，再移除遮罩、解锁页面 |

> 以上时间点从**开屏结束后**开始算：整条时间线在 `later()` 里统一 `+OPEN(2800ms)`，所以实际落地时刻比表里晚 2.8s。

- **跳过**：Esc / Enter / Space / 点击任意处（`allowSkip=false` 时禁用；跳过会同时掐掉语音）。
- **只播一次**：`mode=session` 用 `sessionStorage`，`mode=daily` 用 `localStorage` 记日期；
  标记只在**真的播完之后**才写 —— 中途崩了下次还会再试。
- **重播**：`window.__DSC_SPLASH__.replay()`（设置页「关于」里也有按钮）。

---

## 工牌准入（BSC 实验室胸卡）

启动序列中间那一屏，按《流浪地球2》里北京航天中心（BSC）的**实物胸卡**复刻，正反两面、**没有照片**。
比例是照着你给的实物图量的（卡面 1.586，ID-1 卡），尺寸全部用容器查询单位（`cqh/cqw`），放大缩小都同比例：

![参考图 vs 本插件](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/badge-vs-reference.jpg)

- **正面**：顶部「BEIJING SPACE CENTER」重复红字 → 白色真实 BSC 徽标水印（不是画的假章，就是插件自带的那枚 BSC SVG）→
  巨大 `IQC`（优设标题黑，笔画加粗到参考图的重量）→ 实验室中英文名 → 深红编号带 `IDL.IQC-001` → 白底条码区。
- **背面**：左列 29% ＝ 上半蓝色真实 BSC 徽标 + 北京航天中心 + 下半红底巨大 `CS`；右列 71% ＝
  上半 `IDL.` `IQC-001` 与右侧大姓名，下半白面板里实验室名 / 职务（右对齐）/ 编码行 `BSC-IQC001 222179 TU HENGYU` / 条码。
- 卡片是**纯 CSS 画的浅色塑料卡**（不引用任何剧照或外部图片），浮在红色 HUD 里被扫描线扫过，
  四角取景框、状态条（`SCANNING` → `ACCESS GRANTED`）、核验章都在卡片外的覆盖层里（不随 3D 翻面镜像）。
- 默认就是**图恒宇**的姓名；姓名 / 正背面编号 / 英文名 / 机构中英 / 实验室中英 / 缩写 / 职务 / 权限，
  设置 → 启动屏 → 工牌准入 里 12 个字段全可改。

### 工牌字体还原（逐像素匹配出来的）

不是靠肉眼猜的：把参考卡上的文字裁出来做墨迹二值化，再把候选字体渲染成同样的墨迹，
统一高度后算 IoU（交并比）排序；几何位置则用"行投影"量出每个元素的包围盒，按数字对齐。

| 位置 | 匹配结论 | 本插件用字 |
|---|---|---|
| `IQC` 大字 | **DIN 系**（窄、等宽笔画、Q 尾垂直下坠），参考墨迹宽高比 19.4%×24.3% | `Bahnschrift` 700 + `scaleX(.62)`（Windows 自带 DIN 克隆） |
| `CS` 红底大字 | 超窄重黑体（IoU 最高 = Anton 0.150，第二名 Impact 0.103） | 随包字体 `Anton` + `scaleX(1.12)` |
| 背面编码行 `BSC-IQC001…` | 同 Anton 类窄重黑体 | 随包 `Anton` |
| `BEIJING SPACE CENTER` 顶部重复条 | 常规粗体 + **极大字距**（不是超宽字体） | `Bahnschrift` 700 + `letter-spacing .26em` |
| `IDL.IQC-001` 编号带 / 背面 `IDL.` `IQC-001` | DIN 窄体（Anton 太黑，Bahnschrift 更接近） | `Bahnschrift SemiBold Condensed` |
| `智能量子计算机重点实验室` | **思源黑体 Regular**（IoU 0.60，远高于 Bold 0.42） | `Noto Sans SC` 400 + 字距 |
| 姓名 | 日系 Gothic（MS Gothic / Yu Gothic 得分高于思源） | `Yu Gothic` / `Yu Gothic Medium` |
| 职务 `实验室主任` | 思源粗体 | `Noto Sans SC` 700 |
| 徽标下「北京·航天中心」 | 书法体（属于 BSC 标识本身） | 真实 `bsc.svg` 里的原字 |

另外这轮把字号按行投影**逐项对齐**了：正面各元素的位置/高度/宽度与参考的偏差基本都在 0.3% 卡面以内
（顶部条 95.3%→96.1%、IQC 19.4%×24.3% → 19.4%×24.3%、实验室名 54.0%→54.1%…）。
之前的总偏差来自两个错误：把"字高占比"直接当 `font-size`（整卡小 30%），以及 `CS` 用了窄体重字（参考是更窄更黑）。

> 电影里那张卡确实没有照片，所以这里**不做头像上传** —— 也就不涉及任何人像素材的版权问题。

---

## FUI 细节优化（参考《流浪地球》FUI）

参考 [The Wandering Earth FUI design · Richard Chan（Behance）](https://www.behance.net/gallery/93931179/The-Wandering-Earth-FUI-design/)
与[同系列 FUI 还原](https://www.zcool.com.cn/work/ZMzY3NjA0OTY%3d.html) 的设计语言，
在不动宿主布局的前提下补了几处「机加工控制台」的细节：

| 优化 | 做法 |
|---|---|
| **原生标题栏配色适配**（Win 桌面） | DSH Desktop 的 Windows 标题栏 overlay 颜色取自渲染器的 `--dsw-specific-sidebar-fill` / `--dsw-alias-label-primary`；插件启动时会触发一次 body style 变更，让 preload 重新取色，窗口按钮区不再是一块宿主的纯黑 |
| **图标按钮的“对角刻度”** | ghost 图标按钮的 L 形刻度从常驻改为 **hover / focus 才出现**（对角双刻度），静止时干净——原来常驻的小 L 在窄图标上像断掉的角标 |
| **primary 双切角** | 主按钮从「右下单切角」升级成**左上 + 右下双切角**，更像 FUI 的机加工面板 |
| **danger 警示斜纹** | hover 时出现 45° 警示斜条 + 左侧 LED，对应 FUI 的危险色块 |
| **面板焦点反馈** | composer / dock 面板 hover 或 focus-within 时，HUD 描边提亮一档（只改 outline-color，零布局位移） |
| **开屏副标 [MOSS]** | 底部中文行 `智能量子计算机 550W [MOSS]`，方括号用主色高亮 |
| **开屏 FUI 细节** | 550W 标识加机加工角框、刻度尺、`SYS // 550W · UEG` 微标签，外加雷达环 + 旋扫锥 + 左右两列读数（PWR/SIG/TMP/SEC 与 LAT/LON/ALT/ROT） |
| **主题 FUI 增强层** | 固定的 .dsc-deco 里加了：右下遥测块（坐标 / 温度 / 功率条）、右缘校准刻度（000–100）、底部滚动的十六进制数据条、左下序列号 `FUI-9393 // UEG-02`、内容区缓慢下扫的扫描线 |
| **桌面端外观重测** | ping 放在 **selfboot 自举脚本**里（桌面端真正会执行的路径），触发 body style 变化让 Electron preload 重新取色，把 Windows 原生标题栏 overlay 刷成主题色（并把侧栏 token 调成 88% 不透明，让 HUD 纹理能微微透上来） |

> 这些全部是 CSS 变量 / 背景层 / 伪元素级别的小改动，不新增 DOM 钩子、不改宿主布局；宿主要是把对应结构改掉，规则只是不生效，不会把界面弄坏。

## FUI 增强层（§16）

主题装饰层（`.dsc-deco`，固定层 + `pointer-events:none`）里加了一组纯装饰的 FUI 元素，不依赖宿主 DOM：

- **遥测块**（内容区右侧）：`UEG · 550W / SYS-CTL`、`LAT/LON`、`ALT/TMP`、功率条；
- **校准刻度**（右缘）：000–100 的竖排刻度 + 长短两档 tick；
- **数据条**（内容区底部）：缓慢横向滚动的十六进制读数，两侧用 mask 淡出；
- **序列号**（内容区左下）：`FUI-9393 // UEG-02`；
- **扫描线**：内容区一条 1px 主线每 11s 从上往下扫一次（`prefers-reduced-motion` 时停）；
- **内容区 reticle（取景框角标）**：会话内容区四角的 16px 直角标；
- **左缘竖排机构标签**：`UEG · 550W · SYS-CTL`（writing-mode 竖排，贴左缘）；
- **内容区顶部刻度带**：贴着顶部的一条 5px 刻度带，亮度缓慢呼吸（9s）；
- **面板刻度尺（§5）**：composer / dock 面板在原有四角框之外，又加了顶部 + 左侧细刻度尺和底部刻度，像仪表面板。

另外遥测块/数据条/序列号/刻度的字号和透明度整体调高了一档，弱光下也能看清；全部元素窄屏自动隐藏、HUD 关掉一起消失。

这些都受 `--dsc-hud-ui-alpha` 闸门控制，HUD 关掉时一起消失；窄屏（<1100px）自动隐藏。开屏那边则是雷达环 + 旋扫锥 + 左右读数，外加左下角的**自检行**（`> UEG SECURE BOOT / OMNIVOICE LINK … OK /
IQC AUTH … OK / 550W ONLINE`，逐行出现）和 550W 下方**连接进度条**（2.2s 填满），全部纯 CSS。

面板级 FUI（几何由 `lib/center.js` 测量 `[data-composer-card]` 写入 `--dsc-composer-*`，resize/滚动跟手）：

- **composer 编号标签**：左上 `PANEL-01 // INSTRUCTION INPUT`，右上 `C-01 · LIVE`；
- **composer 取景角标**：贴着输入框四角的 12px 直角标；
- **OPS 滚动日志**：侧栏底部三行 `> OPS LOG 0x1F / > WORKER POOL 04/04 / > SYNC 98% · HOLD`，6s 循环逐行出现。

开屏这轮又加了两处：

- **左右数字刻度列**：机壳内缘 000–160 的竖排校准尺；
- **工牌扫描 UI**：扫描/核验时工牌四角出现取景框 + `ID SCAN // SCANNING` 标签，核验通过切成 `VERIFIED`。

**扫描与空状态（v1.1.8）**

- **工牌扫描百分比**：`ID SCAN // SCANNING 042%` 从 0 走到 100，核验后切 `VERIFIED 100%`；
- **顶部 FRAME 帧号**：右上角 `FRAME 0000` 每 120ms 刷新一次（FUI 帧计数）；
- **空状态雷达**：会话里没有轮次行时，内容区出现同心虚线圆 + 十字准星 + 旋扫锥（有消息自动隐藏，纯属性切换）。

**轮次与光标（v1.1.7）**

- **轮次编号 gutter**：每个 `[data-chat-turn]` 行左侧出现 `T01 / T02 / …`（deco 层测量定位，最多 24 行，滚动跟手）；
- **助手输出轨道**：`[data-chat-flow-kind="turn-assistant"]` 块左侧一条渐隐竖线（同样 deco 层定位）；
- **光标坐标读数**：内容区左下 `X 0842  Y 0361`，鼠标移动 rAF 节流更新；
- **菜单/列表 FUI**：menu 项 hover 左缘主色渐隐条、`[role="separator"]` 换成点刻虚线；
- **网格缓慢呼吸**：14s 一轮的极小幅透明度变化，静态 HUD 有"活着"的感觉（reduced-motion 关闭）。

**消息级 & 实时数据（v1.1.6）**

- **用户消息终端提示符**：在装饰层里维护一组 `>`，跟随 `[data-message-bubble]` 实时定位（不动宿主 DOM，滚动/resize 都跟）；用户气泡加一条主色发丝描边 + hover 提亮；
- **真实跳动的读数**：`MIS T+HH:MM:SS` 每秒走、PWR 功率条 / 百分比缓慢起伏、OPS 日志三行每 4s 轮换（`data-dsc-live` 钩子 + client 里一个 1s 计时器，全部只改我们自己的 deco 文本）。

主题侧再加了三处仪表感：
- **侧栏右缘信号条**：9 段红色小条按 2.6s 周期错峰呼吸，贴在侧栏与内容区的分界线上；
- **OPS 读数**：左下 `OPS // 0x1F`；
- **任务时钟**：右下 `MIS T+0000:12:47`。

## 工牌（从 MOSS 移植，高保真）

启动屏工牌移植的是 MOSS 更新后的第二版（v2）：

- **印刷层**：`lib/assets/badge/print.svg`（MOSS 的 staff-badge-print.svg，含 front / back / reference 图层）；
- **真实字体**：可编辑字段不再用"逐字描的参考子集"，改为真实字体，按 v2 的规则分工——
  中文姓名/角色 → **字魂创粗黑**（`[data-han]` 时切到 `--badge-zh`）、
  编号/数字 → **Rajdhani Bold**、流水号 → **Fira Sans**、
  其余可编辑拉丁字段（以及无中文的姓名）→ **淘宝买菜体**；
  这些字体**不随插件分发**，由 Host 从本机 MOSS 目录读取（与程序化渲染器同一套 `DSC_MOSS_ASSETS`），
  缺失时回退到随包的思源黑体（OFL）；MOSS v2 里「马兆」还会做参考对（马 + 升起的兆）的精确排布；
- **条码**：Code128，按工牌编号实时生成；
- **排版**：v2 credential-card.css（色带 / IDL. 编号 / 姓名 / 实验室 / 角色 / 流水号光学缩放 / 条码位置），
  以及 `fitSerial` 的画布测宽缩放；
- 默认档案仍是 MOSS 复刻对象：**马兆 / 实验室主任 / IQC-001 / 222179 / MAZHAO**；设置面板可改任意姓名编号。

## 开屏：550W 红光影片（完整移植）

启动屏现在是三段式：

1. **identity**：550W 标识描边 / 自检 / 机位点；
2. **红光影片**：4 秒（1536×864，随插件分发 2.2MB），从 11× 拉镜到 1×、亮度 1.55→1，正是 550W 红色光学核心那一段；影片开始时播第一句语音；
3. **主序列**：标题 / 数据流 / 工牌核验 / 授权。

影片随插件放在 `lib/assets/opening/film.mp4`，由 Host `/dsh-command/opening/film.mp4` 以 Range 方式下发；
`prefers-reduced-motion` / 静态帧模式会跳过影片。节奏用 `speed` 缩放（影片 playbackRate 同步）。

## 语音：四句台词（开屏第一句是 MOSS）

默认文案（可在设置里逐句改，留空不播）：

| 槽位 | 时机 | 默认中文 |
| --- | --- | --- |
| `voiceLineBoot` | 红光影片开始 | MOSS is online。为了延续人类文明，请保持理智。 |
| `voiceLine1` | 标题砸下 | 550W 正在覆写 DeepSeek Harness，覆写完毕。 |
| `voiceLine2` | 工牌核验通过 | 操作员生物签名核验通过，权限等级 L1。 |
| `voiceLine3` | 授权通过 | 北京航天中心授权完成，系统进入待命。 |

音色仍由本机 OmniVoice（MOSS 参考音）生成，`lib/assets/voice/boot.wav` 等四个文件；语音串行队列保证不叠音。

**读法**按 MOSS 自带的 `voice/pronunciations.json` 修正：`MOSS` → `moss`，`550W` → `五五零 W`，`L1` → `L 一`（浏览器 TTS 兜底也会做同样替换）。

## 电影级 FUI 整改（依据 wandering-earth-fui-design 技能）

参考技能里的电影 FUI 规则，对本主题做了一轮"删装饰、留仪表"的整改：

- **每个标记都必须是仪表**：删掉装饰层的假遥测（扫描带 / 雷达 / 跑马灯 / 假信号条 / 假 LAT-LON-TMP / 假 PWR / 假 OPS 日志），
  只保留四个真实来源的仪表：系统标识、运行时钟（真实 uptime）、光标坐标、输入区目标框；
- **扁平**：装饰层不再有发光、阴影、模糊、文字光晕；只留 1px 发丝线；
- **颜色各有职责**：白色是正文；暗蓝灰是标签/单位；青色是实时数据（时钟、坐标）；橙色只表示"选中/在用"（输入区聚焦、消息悬停）；
  红色只留给品牌标识与错误/危险，不再给普通边框/文字上色；
- **形状优先**：输入区 6px 键半径 + 1.5px 白轮廓，聚焦转橙色；面板去掉装饰框，只留结构发丝线；
- **动效只跟状态变化**：取消扫描、雷达旋转、呼吸网格、跑马灯、聚焦扫描线等无限循环；保留 hover/focus 的 120–180ms 过渡；
- **用户气泡**：从红玻璃改成黑底白字 + 1px 发丝线（宿主的 token 在 body 上重新定义，所以覆盖写在 `body` 层）；
- 保留的偏离：UEG 统帅红作为品牌色仍用在 logo / 水印 / 边角标识上（不做普通 UI 强调色）。

## 550W 桌面宠物（可拖动）

在界面上浮一个 550W 桌面宠物（**设置里保存后即时生效，不用重启**）。两种渲染模式：

- **完整移植（优先）**：直接复用本机 MOSS 网页的 `moss-render.js`（Worker + OffscreenCanvas），
  它程序化重建的 550W 自带小屏数据、LED 阵列、光圈、TOF 转子、舵机姿态，效果与参考网页一致；
  需要本机存在 `F:/moss/agent-lab/prototype/static/conversation-assets`（可用 `DSC_MOSS_ASSETS` 覆盖），
  Host 以同源路由下发 worker 与 `moss-exterior.glb` / `moss-tof.glb`；首次载入约 20–35 秒（本地磁盘 56MB）；
- **GLB 轻量回退**：本机没有 MOSS 资源（或 Worker/OffscreenCanvas 不可用）时，回退到 `pet-glb.js`
  （`moss-exterior.glb` + three.js，之前那套轻量实现）。

两者共用：

- **默认停在窗口顶部右侧**，按住拖到任意位置（限制在视口上半部，左右滑动为主），位置记在 `localStorage`；
- **尺寸/开关即时生效**：设置里的滑块一拖就变；点保存后也会把最终值应用上去（不用刷新）；
- **模型保持原生**：不加任何额外组件；金属件用 PMREM 影棚环境补光（不再黑成一团）；
- **原生灯光**（实现在模型自带零件上）：LED 阵列按 MOSS 的扫描公式呼吸、状态灯呼吸、底部电源指示条按 3.6s 呼吸；镜头环按 MOSS 的 TOF rotor 节奏（10.45s：0→64°→-42°→0）旋转；
- 说明：MOSS 网页里的"小屏"是它程序化重建模型里的独立屏幕网格；本 GLB 里那块是印刷的 H50 面板，没有可替换的屏幕网格，所以小屏动画只能在移植程序化渲染器后实现；
- **舵机式动作**（不是连续摆动）：待机在 standby / listen / think / speak 姿态之间小幅切换，每个目标缓动到位后停住，机身保持直立；
- **真关节动作**：按 MOSS 的 `shoulderYaw / elbowYaw / wristPitch` 锚点搭肩→肘→腕链，204 个零件按几何位置自动归到对应段；待机随机扫视 / 抬臂 / 点头，点一下会加快摆动；模型不会解体；
- **不做 360° 自转**；
- 说明：这个 GLB 是 CAD 装配体（没有运动学链），直接转零件会把模型拆散，所以宠物用相机环视制造"活物感"，不动模型本身；
- **没有吊轨、没有外框**，纯悬浮 + 主色辉光 + 小 `550W` 铭牌；
- 启动屏播放期间自动隐藏；`prefers-reduced-motion` 时只渲染一帧、不跑动画；
- 设置里可关（`pet`）、调尺寸（`petSize` 80–520px）、开关顶部吸附（`petSnap`：开启时宠物始终贴顶、只能左右拖；关掉可自由摆放）。

**模型来源**（不随插件分发，避免 39MB 资产 + 版权问题）：按以下顺序找第一个存在的文件：

1. 环境变量 `DSC_PET_MODEL`；
2. 插件目录 `assets/pet/model.glb`（放你自己的 550W 模型）；
3. 本机 MOSS 原型：`F:/moss/agent-lab/prototype/static/conversation-assets/moss-exterior.glb`。

Host 用 `/dsh-command/pet/model.glb` 把文件以同源方式喂给 three.js（绕过 CORS），three.js 本体
（MIT，约 800KB）随插件放在 `lib/assets/three/`。

## FUI 总览与开关（fuiExtra）

主题的 HUD 分成两层：

| 层 | 内容 | 开关 |
|---|---|---|
| **基础 HUD** | 125 枚 token 配色、扫描线/暗角/网格、四角直角框、四边刻度带、面板四角框、侧栏/菜单/按钮/滚动条样式、标题栏同步 | `hudFrames` / 各强度旋钮 |
| **FUI 增强层** | 遥测块、右缘校准刻度、底部数据条、序列号、四角 reticle、竖排标签、顶部刻度带、扫描线、信号条、OPS 日志、任务时钟、光标坐标、composer 编号/取景角标、轮次 gutter `T01…`、助手输出轨道、用户消息提示符、空状态雷达 | **`fuiExtra`（默认开）** |

关掉 `fuiExtra` 时，装饰层立刻回到"只有基础 HUD"的状态（属性门 `html[data-dsc-fui-extra="off"]`，CSS 隐藏 + client 侧不启动那些计时器/监听器）。

**性能预算（实测，1600×1000 预览页）**

- 装饰层 DOM：约 76 个节点（其中 FUI 增强层 61 个）；
- 轮次/提示符标记复用节点池，上限分别是 24 / 40 个，不会随消息无限增长；
- 计时器 4 个（live 1s、prompts 0.9s、rows 1.2s、radar 1.2s），全部在标签页隐藏时跳过重绘；坐标读数是 mousemove + rAF 节流；
- 关闭 `fuiExtra` 后这些计时器/监听器根本不会创建。

## 语音播报（MOSS 音色）

三段播报默认走**随包素材**（`voiceSource: "asset"`），素材是**本机 OmniVoice 模型**合成的 MOSS 音色：

| 槽位 | 台词 | 文件 |
|---|---|---|
| `title` | 智能量子计算机 550W，已上线。 | `lib/assets/voice/title.wav` |
| `operator` | 身份核验通过，北京航天中心。 | `lib/assets/voice/operator.wav` |
| `grant` | 授权通过，欢迎进入系统。 | `lib/assets/voice/grant.wav` |

- 文件是 24kHz 单声道 wav（立体声源自动降混），浏览器 `Audio` 直接播；
- **三句串行、绝不叠音**：素材比时间线间隙长时，下一句会排队等上一句念完（内部队列 + 独占播放）；重播/跳过会先停掉旧音频并复位队列；
- 想换自己的文案/语气：`node scripts/moss-voice.mjs --text title=… --text operator=… --text grant=…`
  （只读调用本机 MOSS 服务的 `/api/speak`，会覆盖上面三个文件；`--category` 可选 reply/media/notice/warm）；
- 没有 MOSS 服务时：把 `voiceSource` 设回 `tts`，走系统 `speechSynthesis`（语速 0.88 / 音调 0.85 /
  神经网络女声优先，和参考插件一致），或放自己的 `lib/assets/voice/<槽位>.mp3`。

> 参考插件里的真声 mp3 仍然不随包发布；MOSS 音色 wav 是本地合成、随包分发（见 `NOTICE`）。

## 采样率与时长备注

音色与节奏按 `dsh-startup-screen` 的做法适配：**先按分数挑音色，而不是"第一个能用的"**。

- 打分顺序：**神经网络音色**（`Natural / Neural / Online / Premium / Enhanced / Siri / Google`）> **女声**（含 `xiaoxiao / huihui / yaoyao` 等中文女声）> **语种吻合** > 本地音色；男声（`kangkang / yunxi / david …`）扣分。
- 语种优先级高于音色档次：念英文时只在英文音色里挑（拿中文音色念英文会很怪）。
- 参数与参考插件一致：`rate 0.88` / `pitch 0.85` / `volume 0.9`，念之前两声轻提示（1046.5 + 1568 Hz），之后留 240ms 再开口。
- 三个播报点：标题砸下、工牌核验通过、授权通过；台词可改，支持 `{operator}` 等六个占位符。
- **素材模式（这台机器已经启用）**：`voiceSource=asset` 时优先播 `lib/assets/voice/{title,operator,grant}.mp3`，
  缺哪个槽位就用合成补哪个。已经用 `node scripts/import-voice.mjs --all` 把参考插件装在本机的真声素材接下来了：

  | 槽位 | 来源素材 | 语义 |
  |---|---|---|
  | `title` | `line-1.mp3` | 「需要访问许可 / ACCESS PERMISSION REQUIRED」 |
  | `operator` | `line-5.mp3` | 「读取完毕 · 核验通过 / READ COMPLETE · VERIFIED」（工牌核验那一刻） |
  | `grant` | `line-6.mp3` | 「Welcome. Authorization granted.」（授权通过那一刻） |

  想换回合成：`node scripts/import-voice.mjs --remove`（或把配置里 `voiceSource` 改回 `tts`）；
  想看看本机还有什么素材：`node scripts/import-voice.mjs --list`。

---

## 字体

**优设标题黑已经下载、装到系统（当前用户）、并随插件打包**：启动屏标题、工牌 `IQC` / `CS` / 姓名都用它。
取字体顺序是「系统已装 → 插件路由 → 相对路径」，所以换台机器没有这个字体时还有兜底：

| 用途 | 字体栈（按优先级） |
|---|---|
| 展示字（标题 / IQC / CS / 姓名） | `YouSheBiaoTiHei`（优设标题黑，已随插件打包）→ `Arial Black` → `Noto Sans SC Black` |
| 中文正文 / 标签 / 实验室名 | `Noto Sans SC` → `Microsoft YaHei UI` → `Microsoft YaHei` → `Source Han Sans SC` |
| 拉丁副字（BEIJING SPACE CENTER / 编号 / 编码行） | `Bahnschrift SemiBold Condensed` → `Bahnschrift Condensed` → `Rajdhani` → `Arial Narrow` |
| 等宽数据 | `Cascadia Mono` → `Cascadia Code` → `Consolas` |

字体文件在 `lib/assets/fonts/YouSheBiaoTiHei.ttf`（1.35 MB，优设网络科技免费商用授权），
运行时经 `/dsh-command/font/YouSheBiaoTiHei.ttf` 只读下发（白名单 + 防目录穿越）。

---

## 主题装饰（水印 / 角落徽标 / 主机型号）

启动屏那套"模糊大徽标 + 角落机型标识"的语汇搬进了界面，全部走 SVG mask + 主题色，换配色自动跟着变：

| 装饰 | 位置 | 做法 | 开关 |
|---|---|---|---|
| **UEG 大徽标水印** | 视口中央偏上 | 真实的 UEG 徽标 SVG 当遮罩、`--dsc-logo` 上色，约 6% 不透明度 + 2.2px 模糊，只在空白处透出来 | `watermark` |
| **北京航天中心（BSC）徽标** | 会话标题栏中间 | 真实 BSC 徽标（同一枚动画徽标的静态件）当遮罩，约 52% 不透明度 + 主题色光晕 | `cornerLogo` |
| **550W 主机型号标识** | 左侧导航栏底部、水平居中 | 由本机 MOSS 服务的 `550w.svg` 转换来的 scoped 模块（5 条路径，红/黑分组），mask + 主题色上色 | `modelLogo`（主题）/ `showModel`（启动屏） |

- 装饰层是 Host 注入的 `<div id="dsh-command-deco">`，固定定位 + `pointer-events:none`，不吃点击、不改布局；
  强度跟 `--dsc-hud-ui-alpha` 联动，`hudFrames=0` 时和别的 HUD 装饰一起归零。
- 徽标遮罩走 `/dsh-command/logo/{ueg,bsc,550w}.svg?mask=1`（Host 会把 SVG 刷成全白，取 alpha 上色），
  所以它们永远跟主题色一致，不会出现"红色界面里压着一枚蓝色旧 logo"。
- 启动屏左上角也有 550W 型号标识（`MAINFRAME 550W` 小字标签），和主题左上角那枚是同一个文件。

---

## 桌面端（DSH Desktop）为什么需要自举

DSH Desktop 的主窗口页面是 `dsh-app://app/index.html`，Electron 主进程**直接从打包后的
`dsh-web-frontend/dist` 读静态 index.html**（只额外塞一个 `__DSH_BOOT_READY__`），
不走 webServer 的 index render —— 所以 **Host 端 `tapIndex` 注入在桌面端永远到不了页面**：

- 设置面板是客户端 bundle，照常加载 → 「流浪地球主题」分区看得见；
- 但主题 CSS、装饰层、启动屏根节点都是 Host 注入的 → 桌面端全都不出现。

![桌面端自举后的界面](https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/shots/desktop-selfboot.jpg)

修复方式（和 `dsh-startup-screen` 的 selfBoot 思路一致）：

1. Host 把"注入"本身做成一条路由 `/dsh-command/selfboot.js`（由 `lib/selfboot.js` 生成），
   内容与 tapIndex 注入**完全同一套**：主题属性、变量表、critical CSS、装饰层、启动屏根节点、
   跳过判定、10 秒兜底；
2. 客户端半侧在启动时检查"页面里有没有 Host 注入痕迹"，没有就挂上这个脚本；
3. `dsh-app://app/*` 的其它路径会带 cookie 转发给 Host，所以 `/dsh-command/*` 在桌面端可用。

Web 模式（`http://127.0.0.1:PORT`）仍有 Host 注入，客户端会自动跳过，不会重复注入。
**改完 Host 侧代码必须完全退出 DSH 再打开**（客户端 bundle 与路由都是启动时加载的）。

---

## 启动时最大化窗口

DSH Desktop 的主窗口是固定 `1280×820` 创建的，也不保存窗口尺寸，Electron 主进程又没有把窗口控制
暴露给页面 —— 所以"默认全屏"没法用普通设置做到。插件换了个不改 DSH 本体的做法：

- Host 半侧在启动时（只在 **Windows + DSH Desktop** 宿主里，靠 `DSH_DESKTOP_*` 环境变量识别）
  拉起一个隐藏 PowerShell：找到标题匹配 `DeepSeek Harness` 的主窗口，发一次 `SW_MAXIMIZE`；
- 20 秒内持续看窗口，欢迎页先出现、主窗口后创建也能兜住；已经铺满就直接收手；
- 只发一次窗口消息，**不碰 app.asar、不影响 DSH 更新**；失败就静默，绝不影响启动。

开关：设置 → 流浪地球主题 → 质感 → **启动时最大化窗口**（默认开，改完重启 DSH 生效）。
窗口最大化的效果是"铺满工作区、任务栏可见"；想要连任务栏一起盖住的话告诉我，我把脚本换成真全屏定位。

---

## 免责声明

- 本插件是**非官方同人主题**，视觉语言参考《流浪地球 2》北京航天中心的控制台与工牌，
  与电影版权方、DeepSeek 官方均无隶属关系；
- 插件内**不含任何电影剧照、海报、影片音频或影片字体**：工牌是纯 CSS 绘制，徽标是 SVG 重绘；
- 「UEG」「550W」「北京航天中心」等名称与标识归原权利人；
- 参考插件的真声 `lib/assets/voice/*.mp3` **不随包发布**；随包的 `*.wav` 是本机 OmniVoice 合成的 MOSS 音色；
- 第三方材料与字体授权见 [NOTICE](NOTICE)，代码部分为 MIT。

---

## 安全与容错

这些不是"顺便加的"，每一条都对应一个真实翻车点：

| 问题 | 处理 |
|---|---|
| 首帧闪出宿主白底 | 内联脚本在 `<head>` 里**先挂** `html[data-dsh-command="on"]`，critical CSS 同时把窗口压黑 |
| splash.js 404 / 语法错 / 被拦 | 10 秒兜底：无条件移除遮罩、解锁滚动，**绝不留黑屏** |
| 徽标素材拿不到 | 并行 fetch + 1.6s 超时，拿不到就少两枚徽标继续播 |
| 载体没有 HTTP 路由（`file://` + IPC） | Host 半侧不炸（只记一条 warn）；客户端半侧会自己挂 `/dsh-command/selfboot.js` 做自举，所以桌面端照样生效 |
| 跳过/结束后的监听残留 | 播完解绑键盘/指针监听、清全部定时器与 rAF |
| 用户开了"减少动态效果" | 停掉动画，直接渲染终态并在 1.6s 后收尾 |
| 配色把界面调得不能看 | 正文/面板/线条全部由 `color-mix` 派生，只暴露 4 个基色；对比度见上 |
| 宿主升级改了 token | 只覆盖 `--dsw-alias-*` 语义 token，不改布局/字体族/圆角体系 |

---

## 目录结构

```
dsh-supreme-command/
├── package.json              host ESM + dsh.bundle/dsh.client 声明
├── cordis.patch.yml          安装时被并入 profile 的 bundle patch
├── 安装.cmd / 卸载.cmd        双击安装/卸载
├── lib/
│   ├── index.js              Host：配置、路由、index.html 注入、变量计算
│   ├── palettes.js           6 套预设（唯一色源，同时下发给设置面板）
│   ├── theme.css             界面主题：125 枚 --dsw-* token 映射 + HUD 装饰层
│   ├── splash.css            启动屏样式
│   ├── splash.js             启动屏运行时（时间线 / 音效 / 跳过 / 重播）
│   ├── client.js             设置面板（ModuleLoader bundle，无构建）
│   └── logos/
│       ├── ueg.js            UEG 徽标（scoped + currentColor）
│       ├── bsc.js            BSC 动画徽标 + replayBsc()
│       └── logos.css         全部徽标动画，41 条规则全 .dsc- 作用域
├── preview/
│   ├── index.html            启动屏 + 假 DSH 外壳预览（支持 URL 参数）
│   ├── theme.html            主题样张（仿真 DSH 结构）
│   └── logos.html            徽标检验台（冻结帧 / 三配色 / 运行时自检）
├── scripts/
│   ├── install.mjs           安装/卸载（目录联接 + patch 托管块）
│   ├── serve.mjs             预览静态服务器
│   ├── shot.mjs              无头浏览器截图
│   ├── check-injection.mjs   用真实 DSH index.html 跑注入回归
│   └── check-timeline.mjs    启动屏时间线自检（无头浏览器）
├── test/                     smoke-host / smoke-splash / smoke-client
├── docs/                     CONFIG.md（契约）/ INSTALL.md / logos.md
└── shots/                    验证截图
```

**没有构建步骤**：所有文件就是产物，改完刷新页面即生效。

---

## 开发与验证

```powershell
npm test                        # 112 项静态自检（配置/注入/路由/样式隔离/协议）
node scripts/check-injection.mjs    # 用真实 DSH index.html 验证注入（8 项）
node scripts/check-timeline.mjs     # 启动屏时间线（需预览服务器，14 项）
node scripts/check-guards.mjs       # 护栏：跳过不黑屏 / 与其它启动屏互斥 / 减少动态（8 项）
node scripts/check-voice.mjs        # 语音接线：三句台词 / 音色打分 / 双语 / 占位符（9 项）
node scripts/moss-voice.mjs         # 用本机 MOSS 服务重新合成三句 MOSS 音色语音（可选）
node scripts/import-voice.mjs --list # 看看本机有没有可复用的真声素材
npm run preview                 # http://127.0.0.1:8791/preview/index.html
node scripts/shot.mjs <url> <out.png> [宽 高 虚拟时间ms]
```

装好插件后还有一个**真机预览页**：`/dsh-command/preview`（设置面板「关于 → 打开独立预览」也指向它）。
它用和正式注入完全同一套路由与配置单独播一遍，并且**不写"已播过"标记**。

预览页 URL 参数（很方便单独验某一块）：

| 参数 | 作用 |
|---|---|
| `?chrome=0` | 隐藏控制条（截图用） |
| `?static=1` | **静态终态**：不走动画，直接把整屏钉在终态（视觉回归用，确定性最高） |
| `?splash=0` | 不播启动屏，直接看主题后的界面 |
| `?nogrant=1` | 隐藏「授权通过」横幅（配合 `static=1` 截进度阶段构图） |
| `?preset=cyan\|amber\|green\|violet\|mono` | 换配色 |
| `?host=light` | 假装宿主是浅色，验证主题仍压得住 |
| `?speed=1.5` | 动画速度 |
| `?glow=0&scanlines=0&frames=0` | 逐项关掉质感层 |

> 截图注：无头 Chrome 的 `--virtual-time-budget` 能快进 `setTimeout`，但**动画时钟**不一定跟得上，
> 所以"看设计"用 `?static=1`，"看动画进行到哪"用 `preview/logos.html?t=<ms>` 这类冻结帧能力。

---

## 已知边界

- **主题是硬锁定暗色 HUD**：无论宿主是深色还是浅色偏好，色板都是同一套（这是设计选择，
  也是 `themeMode` 只控制原生控件 `color-scheme` 的原因）。
- **面板四角框依赖宿主存在的 DOM 钩子**（`[data-composer-card]`、`[data-dockkit-pane]` 等）。
  钩子不存在时那几条规则不生效 —— 不会报错，只是少一层装饰。钩子很小（比如浮动工具条）时角框会偏挤，
  从 `lib/theme.css` §5 的选择器列表里去掉对应那一条即可。
- **验证环境**：DSH `0.2.2-rc.1`（desktop profile）。注入点按真实 `dsh-web-frontend/dist/index.html`
  回归；主题覆盖按该版本 `--dsw-*` token 表（125 枚）。DSH 升级后若新增 token，未覆盖项会回落到宿主默认色。
- **少数宿主调色板挂在 hashed 类作用域上**（如 JSON 树的 `--json-tree-*` 声明在
  `body[data-ds-dark-theme] ._root_hash`），没有稳定钩子可选，浅色宿主下这部分仍跟浅色。
  `themeMode=force-dark`（默认）碰不到；只有 `force-dark` 被关且系统是浅色时才可能遇到。
- **面板四角框用 `outline` 实现**（不覆盖宿主 elevation 阴影）。若某个面板自身可聚焦，
  它的 focus 环颜色会被这层描边吃掉 —— 面板一般不可聚焦，风险低；要保险就把
  `lib/theme.css` §5 里的 `outline` 换成 `box-shadow: inset 0 0 0 1px`。
- **BSC 中央字标延迟**：见[两枚徽标](#两枚徽标)末尾的说明（3s vs 源文件实际 0s）。
- 音效走 WebAudio；浏览器自动播放策略下，若页面从未有过用户手势，首次可能静音（不影响动画）。

---

MIT License · 用 `dsh-startup-screen` 的架构经验搭起来，视觉与实现均为本项目原创。

