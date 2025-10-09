@echo off
chcp 65001 >nul
echo ====================================
echo Starting Backend Server...
echo ====================================
cd /d "%~dp0backend"
python app.py
pause
