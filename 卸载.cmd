@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   dsh-supreme-command  卸载
echo ================================================
echo.
node scripts\install.mjs --uninstall %*
echo.
pause
