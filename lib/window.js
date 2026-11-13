/**
 * 桌面端启动最大化。
 *
 * 为什么在插件里做而不是改 DSH：
 *   DSH Desktop 的主窗口是用固定 `1280×820` 创建的，也不保存窗口尺寸，
 *   Electron 主进程没有暴露任何"窗口控制"给页面（preload 只给了文件/浏览器/快捷键/更新）。
 *   所以插件侧唯一不改动 DSH 本体的办法：Host 半侧在启动时拉起一个隐藏的 PowerShell，
 *   找到 DSH 的主窗口句柄，发 SW_MAXIMIZE。
 *
 * 约束：
 *   - 只在 Windows + DSH Desktop 宿主下尝试（host 进程环境里有 DSH_DESKTOP_* 标记）；
 *   - 只跑一次（每进程一个 flag），失败静默 —— 最大化不了也绝不影响启动；
 *   - 20 秒内持续看窗口：欢迎窗口先出现、主窗口后创建的情况也能兜到；
 *   - 用户手动还原窗口后不再反复抢（第一次成功后脚本就退出）。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace DscWin -Name U -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindowAsync(System.IntPtr hWnd, int nCmdShow);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT lpRect);
[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'@

$work = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Width
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'DeepSeek|dsh')
  })
  foreach ($p in $procs) {
    $title = ''
    try { $title = $p.MainWindowTitle } catch {}
    if ($title -match 'Welcome|Update|更新') { continue }
    $rect = New-Object DscWin.U+RECT
    $ok = [DscWin.U]::GetWindowRect($p.MainWindowHandle, [ref]$rect)
    $w = 0
    if ($ok) { $w = $rect.Right - $rect.Left }
    if ($w -gt ($work * 0.96)) { exit 0 }   # 已经铺满，收工
    [DscWin.U]::ShowWindowAsync($p.MainWindowHandle, 3) | Out-Null
    Start-Sleep -Milliseconds 700
    $rect2 = New-Object DscWin.U+RECT
    if ([DscWin.U]::GetWindowRect($p.MainWindowHandle, [ref]$rect2)) {
      if (($rect2.Right - $rect2.Left) -gt ($work * 0.9)) { exit 0 }
    }
  }
  Start-Sleep -Milliseconds 500
}
exit 0
`

let attempted = false

/**
 * 尝试把桌面主窗口最大化（每个 Host 进程只试一次）。
 * @param {{ logger?: { info?: Function, warn?: Function } }} [ctx]
 * @param {boolean} [enabled]
 */
export function scheduleDesktopMaximize(ctx, enabled) {
  if (!enabled) return
  if (attempted) return
  attempted = true
  if (process.platform !== 'win32') return
  /* 只在 DSH Desktop 宿主里跑：它给子进程注入 DSH_DESKTOP_* 环境变量；`dsh web` 没有 */
  const desktop = Object.keys(process.env).some((key) => key.startsWith('DSH_DESKTOP_'))
  if (!desktop) return

  try {
    const dir = path.join(os.tmpdir(), 'dsh-supreme-command')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'maximize.ps1')
    fs.writeFileSync(file, PS_SCRIPT, 'utf8')
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', file],
      { detached: true, stdio: 'ignore', windowsHide: true }
    )
    child.on('error', () => { /* 没有 powershell 就算了 */ })
    child.unref()
    try { ctx?.logger?.info?.('[dsh-supreme-command] 已请求桌面窗口最大化') } catch (err) { /* noop */ }
  } catch (err) {
    try { ctx?.logger?.warn?.('[dsh-supreme-command] 最大化脚本启动失败：' + (err && err.message)) } catch (e) { /* noop */ }
  }
}
