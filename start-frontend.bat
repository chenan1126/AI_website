@echo off
chcp 65001 >nul
echo ====================================
echo Starting Frontend Dev Server...
echo ====================================
cd /d "%~dp0react-app"
npm run dev
pause
