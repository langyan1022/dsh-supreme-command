# dsh-supreme-command · 一键安装（Windows / PowerShell）
#
# 用法（在 PowerShell 里）：
#   irm https://raw.githubusercontent.com/langyan1022/dsh-supreme-command/main/install.ps1 | iex
# 或者克隆后本地执行：
#   .\install.ps1                  # 装到 desktop profile
#   .\install.ps1 -Profile web     # 装到 web profile
#   .\install.ps1 -ReplaceStartup  # 顺带停用其它启动屏插件
#   .\install.ps1 -Uninstall       # 卸载
#
# 做的事：把仓库克隆/更新到 ~/.dsh/local-plugins/dsh-supreme-command，
# 再调用仓库自带的 scripts/install.mjs（目录联接 + cordis.patch.yml 托管块）。
param(
  [string]$Profile = 'desktop',
  [switch]$Uninstall,
  [switch]$ReplaceStartup,
  [string]$Repo = 'https://github.com/langyan1022/dsh-supreme-command.git',
  [string]$Target = (Join-Path $env:USERPROFILE '.dsh\local-plugins\dsh-supreme-command')
)

$ErrorActionPreference = 'Stop'

function Fail($message) {
  Write-Host ''
  Write-Host "✗ $message" -ForegroundColor Red
  exit 1
}

# 1) 依赖检查
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail '没找到 git，请先安装 Git for Windows' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail '没找到 node（需要 ≥20），请先安装 Node.js' }
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { Fail "node 版本过低（当前 $(node --version)，需要 ≥20）" }

# 2) 卸载 / 取代码
if ($Uninstall) {
  if (-not (Test-Path $Target)) { Fail "没找到已安装的插件目录：$Target" }
  Push-Location $Target
  try { node scripts/install.mjs --profile $Profile --uninstall } finally { Pop-Location }
  exit $LASTEXITCODE
}

if (Test-Path (Join-Path $Target '.git')) {
  Write-Host "→ 更新已有克隆：$Target"
  Push-Location $Target
  try {
    git fetch --depth 1 origin main
    git reset --hard origin/main
  } finally { Pop-Location }
} else {
  Write-Host "→ 克隆到：$Target"
  New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null
  git clone --depth 1 $Repo $Target
  if ($LASTEXITCODE -ne 0) { Fail 'git clone 失败（网络或代理问题？）' }
}

# 3) 安装进 profile
Push-Location $Target
try {
  $cliArgs = @('scripts/install.mjs', '--profile', $Profile)
  if ($ReplaceStartup) { $cliArgs += '--replace-startup' }
  node @cliArgs
  $code = $LASTEXITCODE
} finally { Pop-Location }

if ($code -ne 0) { Fail "安装脚本失败（退出码 $code）" }

Write-Host ''
Write-Host '✓ 安装完成：完全退出 DSH 再打开即可看到启动屏与主题。' -ForegroundColor Green
Write-Host '  配置与开关：设置 → 流浪地球主题；卸载：.\install.ps1 -Uninstall'
