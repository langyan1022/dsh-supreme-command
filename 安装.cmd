@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   dsh-supreme-command  安装
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没找到 node，请先安装 Node.js 20+ 并加入 PATH。
  pause
  exit /b 1
)
node scripts\install.mjs %*
echo.
pause
