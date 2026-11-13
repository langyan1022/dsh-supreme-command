# 徽标模块（UEG / BSC）

`dsh-supreme-command` 的两个徽标：UEG 地球政府徽标（静态）与 BSC「北京航天中心」橄榄枝徽标（逐叶浮现动画）。
两个 SVG 都从 Illustrator 源文件机械转换而来，**几何路径一个点都没改**，只做了四件事：
作用域化、`currentColor` 换色、`id` → `class`、删掉页面级全局选择器。

| 文件 | 内容 |
|------|------|
| `lib/logos/ueg.js` | `export const UEG_SVG`（`viewBox="0 0 3000 3500"`，静态，无动画） |
| `lib/logos/bsc.js` | `export const BSC_SVG`（`viewBox="0 0 3000 705"`）+ `export function replayBsc(host)` |
| `lib/logos/logos.css` | 全部配色 + 动画 + keyframes（全部 `dsc-` 前缀、全部作用域选择器） |
| `preview/logos.html` | 检验页：播放态 / 终态 / UEG / 三套配色 / 重播按钮 / 运行时自检 |

源 SVG（只读参考，不随包发布）：
`…/各种logo/UEG标志.svg`、`…/动画logo/bsc2.svg`。转换脚本与结构转储在 `_tool/logo-scratch/`。

---

## 1. 最小用法

```html
<!-- 1. 引入样式（预览页用相对路径；正式插件里由 Host 暴露静态资源） -->
<link rel="stylesheet" href="../lib/logos/logos.css">

<!-- 2. 容器：BSC 必须有 .dsc-bsc；UEG 用 .dsc-ueg -->
<div class="dsc-bsc" data-mode="play" id="my-bsc"></div>
<div class="dsc-ueg" id="my-ueg"></div>

<script type="module">
  import { BSC_SVG, replayBsc } from '../lib/logos/bsc.js'
  import { UEG_SVG } from '../lib/logos/ueg.js'

  document.getElementById('my-bsc').innerHTML = BSC_SVG
  document.getElementById('my-ueg').innerHTML = UEG_SVG

  // 重播：移除旧 <svg> 并插入新解析的实例，CSS 动画从 0 重新计时
  document.querySelector('#replay-btn').addEventListener('click', () => replayBsc('#my-bsc'))
</script>
```

> **路由说明**：`lib/logos/*.js` 是浏览器端 ESM（无构建）。仓库根的静态服务器（`scripts/serve.mjs`）直接提供
> `lib/logos/*`；正式插件里的 URL 由 Host（`lib/index.js`）决定，建议与 `splash.css` / `splash.js` 同风格，
> 例如 `/dsh-command/logos.css`、`/dsh-command/logos/bsc.js`、`/dsh-command/logos/ueg.js`。
> 若启动屏不想多发请求，也可以把 `BSC_SVG` / `UEG_SVG` 字符串在 `lib/splash.js` 里直接 import 后内联。

如果页面已有 DSH 的变量注入（`--dsc-logo`），什么都不用再做；否则在任意祖先上给一个颜色：

```html
<div style="--dsc-logo:#22d3ee">
  <div class="dsc-bsc" data-mode="play"></div>
</div>
```

### 尺寸

两个根 `<svg>` 都是 `width:100%; height:auto`，**宽度由容器决定**，高度按 `viewBox` 自动算：

```css
.hero-logo   { width: 560px; }   /* BSC  → 高度 560 × 705/3000 ≈ 132px */
.hero-ueg    { width: 220px; }   /* UEG  → 高度 220 × 3500/3000 ≈ 257px */
```

容器 `.dsc-bsc` / `.dsc-ueg` 默认 `display:block; line-height:0`；需要行内排布时自己覆盖 `display:inline-block`。

---

## 2. 动画语义（与源文件逐条对应，时长/延迟未改）

| 源 id | 现在用的 class | 关键帧 | 时长 / 延迟 | 行为 |
|-------|---------------|--------|-------------|------|
| `#olive #left .l01–l10` / `#right .r01–r10` | `.dsc-bsc-leaf.dsc-bsc-l01` … `.dsc-bsc-r10` | `dsc-olive-display` | 每片 `var(--olive-leaf-display-time)`（默认 100ms），延迟 `×10 … ×1` | 20 片叶子 `opacity:0 → 1` 逐片浮现，左右同序号同延迟 |
| `#center-inner-circle` | `.dsc-bsc-inner-circle` | `dsc-fill` | `3s ease-in-out`，延迟 `2s` | `dashoffset 2000 → 0`（50%）→ 100% 填充实心 |
| `#center-outer-circle` | `.dsc-bsc-outer-circle` | `dsc-fill` | `4s ease-in-out`，延迟 `1s` | 同上 |
| `#center-triangle` | `.dsc-bsc-triangle` | `dsc-triangle-reveal` | `2s`，无延迟 | `clip-path inset(100% 0 0 0) → inset(0)` 自下而上揭示 |
| `#center-text-bsc`（中央 BSC 字标） | `.dsc-bsc-center-text` | `dsc-wings-reveal` | `3s`，延迟 `3s` | `clip-path inset(0 50% 0 50%) → inset(0)` 从中线向两侧展开 |
| `#text-first-line`（北京航天中心） | `.dsc-bsc-text-first` | `dsc-text-first-reveal` | `2s`，延迟 `2s` | `clip-path inset(0 100% 0 0) → inset(0)` 从左向右擦除 |
| `#text-second-line`（BEIJING SPACE CENTER） | `.dsc-bsc-text-second` | `dsc-text-second-reveal` | `2s`，延迟 `2s` | 同上 |

总时长约 **6s**（中央字标 3s 延迟 + 3s 动画）。橄榄叶节拍变量：

```css
/* 挂在 .dsc-bsc 上，可按实例覆盖；不要写在页面根选择器上 */
.dsc-bsc { --olive-leaf-display-time: 100ms; }

/* 例：整体慢一倍的橄榄枝 */
<div class="dsc-bsc" style="--olive-leaf-display-time:200ms"></div>
```

---

## 3. 换色

颜色只有一个入口：`currentColor`。根 `<svg>` 自带
`style="color:var(--dsc-logo, currentColor)"`，所有 `fill` / `stroke` 都是 `currentColor`。

```html
<!-- A. 主题变量（Host 注入，推荐） -->
<div class="theme-scope" style="--dsc-logo:#ff3b30">…</div>

<!-- B. 直接给容器颜色，多个实例互不影响 -->
<div style="color:#22d3ee"><div class="dsc-bsc" data-mode="still"></div></div>

<!-- C. 单个实例覆盖变量 -->
<div class="dsc-ueg" style="--dsc-logo:#ffb020"></div>
```

三套内置配色（检验页已逐一截图验证）：

| 名称 | 值 |
|------|-----|
| 统帅红 `command-red` | `#ff3b30` |
| 全息青 `cyan` | `#22d3ee` |
| 琥珀终端 `amber` | `#ffb020` |

> 例外：两个圆环初始 `fill: transparent`（动画起点必须透明，100% 才变成 `currentColor`），
> 这是源文件语义，不是漏改的硬编码颜色——模块里已经没有任何十六进制色值。

---

## 4. 播放 / 终态 / 重播

### 默认播放

```html
<div class="dsc-bsc" data-mode="play"></div>
```

`data-mode` 缺省时等同 `play`。

### 静态终态（首屏缩略图、打印、截图）

```html
<div class="dsc-bsc" data-mode="still"></div>
```

still 下所有动画元素 `animation:none` 并显式落到终态：
叶子 `opacity:1`、所有 `clip-path:inset(0)`、圆环 `stroke-dashoffset:0` 且 `fill/stroke:currentColor`。
不依赖 `animation-fill-mode:forwards`，所以即使元素刚插入、或动画被浏览器丢弃，也不会出现「半截」。

> still 只给两个圆环补 `stroke:currentColor`：叶子/文字/三角本来没有描边，若一并加 stroke 会凭空多出
> 1 单位宽的描边（源文件不是这个效果）。

### 重播

```js
import { replayBsc } from '/dsh-command/logos/bsc.js'

replayBsc('#my-bsc')                 // 传选择器 / .dsc-bsc 容器 / <svg> 本身都行
const svg = replayBsc(container)     // 返回新插入的 <svg>，找不到宿主返回 null
```

实现是从 `BSC_SVG` 重新解析出一个新 `<svg>`，用 `replaceWith` 换掉旧的。
新 DOM 节点上的 CSS 动画自然从 0 开始，比「删 class 再 rAF 加回来」稳，不需要强制回流 hack。
返回的节点可以继续用来测量 / 观察 `getAnimations()`。

### 减少动态效果

`@media (prefers-reduced-motion: reduce)` 下等同 still（动画关闭、直接终态），
无需调用方做任何判断。

---

## 5. 类名清单

模块里**没有任何 `id`**，同一页面放多个实例（播放 + 终态 + 多配色）不会串。中文图层 id 也全部改成了类。

| 源 id（旧） | 类名（新） |
|-------------|-----------|
| `图层_1`（根） | `.dsc-bsc-svg` / `.dsc-ueg-svg` |
| `olive` / `left` / `right` | `.dsc-bsc-olive` / `.dsc-bsc-left` / `.dsc-bsc-right` |
| 叶子 `l01…l10` `r01…r10` | `.dsc-bsc-leaf.dsc-bsc-l01` … `.dsc-bsc-r10` |
| `主体` / `center-circle` | `.dsc-bsc-body` / `.dsc-bsc-circle` |
| `center-inner-circle` / `center-outer-circle` | `.dsc-bsc-inner-circle` / `.dsc-bsc-outer-circle` |
| `center-triangle` / `center-text-bsc` | `.dsc-bsc-triangle` / `.dsc-bsc-center-text` |
| `text-first-line` / `text-second-line` | `.dsc-bsc-text-first` / `.dsc-bsc-text-second` |
| `st0` / `st1` / `st2`（Illustrator 样式类） | `.dsc-bsc-st0/1/2`、`.dsc-ueg-st0` |
| `文本` / `GOVERNMENT` / `UNITED__EARTH` / `earth` / `橄榄枝`（UEG） | `.dsc-ueg-text` / `.dsc-ueg-gov` / `.dsc-ueg-united` / `.dsc-ueg-earth` / `.dsc-ueg-olive` |

UEG 的分层类是刻意保留的钩子，后续想做分层调色（例如地球与橄榄枝不同色）直接加规则：

```css
.dsc-ueg-svg .dsc-ueg-olive { fill: color-mix(in srgb, currentColor 70%, transparent); }
```

---

## 6. 检验页

`preview/logos.html`（必须走 http，ES module 不能 `file://`）：

```
node scripts/serve.mjs 8791          # 仓库根
http://127.0.0.1:8791/preview/logos.html
```

页面参数（截图取证用）：

| 参数 | 作用 |
|------|------|
| `?only=play` / `still` / `ueg` / `palettes` | 只显示某一块，便于单独截图 |
| `&t=1500` | 用 Web Animations API 把 BSC 动画**冻结在指定毫秒**（比虚拟时间预算更精确） |
| `?selftest=1` | 运行时自检：路径数、动画实例数、重播是否重新计时、三套配色是否真的落到 `fill`、still 终态数值、时长/延迟抽样；结论直接渲染在页面上可截图 |

截图命令：

```bash
node scripts/shot.mjs 'http://127.0.0.1:8791/preview/logos.html?only=play&t=300'  shots/logos-1-play-t300.jpg  1440 900 2200
node scripts/shot.mjs 'http://127.0.0.1:8791/preview/logos.html?only=play&t=3500' shots/logos-3-play-t3500.jpg 1440 900 2200
node scripts/shot.mjs 'http://127.0.0.1:8791/preview/logos.html?selftest=1'       shots/logos-8-selftest.jpg   1440 900 3000
```

---

## 7. 与源文件的差异（全部是「允许改的四件事」，没有第五件）

1. **作用域化**：删掉源 `<style>` 里的 `svg{padding:30px}`（页面级全局规则，会把宿主所有 svg 撑开）
   和根元素上的 `--olive-leaf-display-time`（搬到 `.dsc-bsc` 上，可按实例覆盖）。
   所有规则改为 `.dsc-*` 作用域，类名 / keyframes 全部 `dsc-` 前缀，不再有裸 `st0` 之类的通用类名。
2. **换色**：`#344394` / `#344393` / `#2A7B97` → `currentColor`（含 `fillAnimation` 关键帧里的 `#344394`）。
   根 svg 挂 `color:var(--dsc-logo, currentColor)`。
3. **id → class**：见上表，`<style>` 里的 `#id` 选择器同步改为 `.dsc-*` 类选择器；
   生成的 SVG 里 `id` 数量为 0，页面上多实例不会重复 id。
4. **几何**：`d` 属性逐字节未改。`_tool/logo-scratch/build.mjs` 每次生成都会断言
   「源文件与产物的 26 条路径 `d` 完全相同」，并校验产物里没有 `id=`、没有十六进制色值、没有 `<style>`。

已知的一处语义修正（有意为之，其余全部照抄源文件）：

- **中央 BSC 字标延迟**：源 CSS 把 `animation-delay:3s` 写在 `animation` 简写**之前**，
  简写会把延迟重置成 `0s`（等于字标立刻出现）。按动画语义清单这里应为 `3s`，故在 `logos.css` 中
  把 `animation-delay` 放在 `animation` 之后，确保 `3s` 真正生效。若要 1:1 复刻源文件的「实际」表现，
  把该规则的 `animation-delay` 改成 `0s` 即可。

---

## 8. 集成注意

- 样式表只能通过 `<link>` 引入一次（`/dsh-command/logos.css`），不要内联进 DOM 的 `<style>` 里反复注入。
- 不要给 `.dsc-bsc` 之外的祖先写 `color` 以外的假设；模块自身不定义任何全局变量。
- 启动屏里如果要「进场播放 → 结束后保持」，播完不需要切 `still`：`forwards` 已经是终态；
  切 `still` 主要用于降级/截图场景。
- `replayBsc` 只重播动画，不改变 `data-mode`；`data-mode="still"` 时调用它会换节点但仍然保持终态。
