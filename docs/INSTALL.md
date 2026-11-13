# 安装 / 卸载 / 排错

## 它到底装了什么

DSH 用 **cordis loader** 加载插件：一个包要被加载，必须同时满足

1. profile 里能 **resolve 到包**（`~/.dsh/profiles/<profile>/node_modules/<包名>`）；
2. profile 的 **patch 层**里有一条指向它的 loader 条目。

`scripts/install.mjs` 就干这两件事，都以**可回退**的方式做：

| 动作 | 落点 | 回退方式 |
|---|---|---|
| 建目录联接 | `<profile>/node_modules/dsh-supreme-command` → 插件目录 | 删掉这个联接 |
| 追加托管块 | `<profile>/cordis.patch.yml`（带 `# >>> … >>>` 标记） | 删掉标记之间那几行；原文件已备份为 `.bak-<时间戳>` |

> 为什么不直接把插件放进 `dsh.profile.bundles`？因为那需要 `pnpm add` 重排 lockfile，
> 会动到用户已有的依赖树。patch 层 insert 是 DSH 官方支持的本地安装路径
> （`dsh-startup-screen` 的 INSTALL 里也这么写），更轻、更好回退。

## PowerShell 安装

```powershell
cd F:\dsh-startup-theme
node scripts/install.mjs                      # desktop profile（默认）
node scripts/install.mjs --profile web        # web profile
node scripts/install.mjs --replace-startup    # 顺带停用其它启动屏插件（推荐）
node scripts/install.mjs --dry-run            # 只看会做什么
```

或者双击 **`安装.cmd`**。装完**完全退出 DSH 再打开**（Electron 是整进程退出，不是关窗口）。

### `--replace-startup` 做了什么

如果 profile 里已经装了别的启动屏插件（比如 `dsh-startup-screen`），两个全屏动画会叠播。
加这个参数时脚本只会：

1. 把对方的包名从 `dsh.profile.bundles` 里**摘掉**（依赖和它的配置文件都不动）；
2. 把摘掉的名字记进 `cordis.patch.yml` 的托管块（`# replaced-bundles: …`）。

**卸载时会把它们自动加回 bundles**，所以你随时可以来回切。

## 手工安装（不用脚本）

```powershell
# 1) 联接
mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-supreme-command" "F:\dsh-startup-theme"

# 2) 在 cordis.patch.yml 末尾追加（注意是顶层列表项）
# - insert:
#     - id: supreme-command
#       name: dsh-supreme-command
```

## 安装后怎么确认

```powershell
# 1) 路由在不在（DSH 起着的时候）
curl http://127.0.0.1:10022/dsh-command/health
# → {"ok":true,"version":"1.0.0","files":{"theme":true,"splash":true,...}}

# 2) 配置文件在不在
dir "$env:USERPROFILE\.dsh\dsh-supreme-command.json"

# 3) 页面源码里有没有注入（开 F12 → Elements → <head> 里应有）
#    <style id="dsh-command-vars">、<link href="/dsh-command/theme.css">
#    <body> 开头应有 <div id="dsh-command-splash" …>
```

## 桌面端（DSH Desktop）为什么主题/启动屏要自举

桌面端主窗口 `dsh-app://app/index.html` 是**静态 dist 文件**，Electron 主进程只往 head 里塞一个
`__DSH_BOOT_READY__`，不走 Host 的 index 渲染 —— 所以 Host 端 `tapIndex` 注入在桌面端到不了页面。
本插件的做法：Host 把注入做成路由 `/dsh-command/selfboot.js`，客户端半侧发现页面没有注入痕迹时加载它。

排障：

```powershell
# 路由活着吗（在带登录 cookie 的浏览器里直接开）
Invoke-WebRequest http://127.0.0.1:<端口>/dsh-command/health
Invoke-WebRequest http://127.0.0.1:<端口>/dsh-command/selfboot.js
```

- 能打开 → Host 正常；F12 看 `<html data-dsh-command="on">` 与 `<head>` 里的 `/dsh-command/theme.css`；
- 打不开 → Host 半侧没加载/路由没注册，看启动日志里 `dsh-supreme-command` 的报错。

> 改完 Host 侧代码（`lib/index.js`、路由）必须**完全退出 DSH 再打开**；只刷新页面不够。

## 常见问题

**刷新后什么都没有（没有启动屏也没有主题）**
- 插件没加载起来。看 DSH 的启动日志里有没有 `dsh-supreme-command` 的报错；
  最常见原因是联接没建成（杀毒/权限）或 patch 块位置不对（YAML 缩进必须 2 空格层级）。
- `curl /dsh-command/health` 404 → Host 半侧没跑起来。

**有主题但没有启动屏**
- 检查 `~/.dsh/dsh-supreme-command.json` 里 `splashEnabled` 是否为 `true`、`mode` 是否把这次刷新判成"已播过"：
  `mode=session` 时同一个浏览器标签页只播一次（`sessionStorage`，关标签页后重置）；
  `mode=daily` 时同一天只播一次（`localStorage`）。
- 想强制再播：把 `mode` 改成 `always`，或设置页「关于 → 重播启动屏」。

**启动屏出现后卡住不消失**
- 设计上不会：10 秒兜底会无条件移除遮罩。若真卡住，说明 splash.js 把主线程占死了，
  按 Esc 或点一下也能跳过；刷新页面即可。请把 F12 Console 里的报错发出来。

**主题生效了但界面某些地方还是原来的颜色**
- 那部分用的是宿主写死的颜色字面量或还没被覆盖的新 token。可以把它加进 `lib/theme.css`
  的 token 覆盖表（同文件顶部有清单），或提 issue 给我。

**设置页没有「流浪地球主题」**
- 浏览器半侧（`lib/client.js`）没加载：确认 `package.json` 的 `dsh.client` 还在，
  且 `lib/client.js` 文件存在（安装脚本会自检并警告）。

**装了两次 / 报 "duplicate register"**
- 手工 patch 块和 `dsh plugin add` 的 bundle 同时生效了。删掉其中一处（推荐保留脚本装的那份），重启。

**想彻底清干净**
```powershell
node scripts/install.mjs --uninstall
del "$env:USERPROFILE\.dsh\dsh-supreme-command.json"   # 配置也删（可选）
```

## 改完插件代码要重启吗

- 改 `lib/theme.css`、`lib/splash.css`、`lib/splash.js`、`lib/logos/*` → **刷新页面即可**
  （Host 路由按 mtime 缓存，浏览器也拿 `no-store`）。
- 改 `lib/index.js` → **重启 DSH**（Host 半侧代码）。
- 改 `lib/client.js` → 刷新页面（客户端 bundle 会重新拉取；DSH 也有 HMR）。
- 改 `package.json` / `cordis.patch.yml` → 重启 DSH。
