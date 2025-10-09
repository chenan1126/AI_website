@echo off
chcp 65001 >nul
echo ====================================
echo Starting Frontend and Backend Servers...
echo ====================================
echo.
echo Starting Backend in new window...
start "Backend Server (Port 5000)" cmd /k "chcp 65001 >nul && cd /d "%~dp0backend" && python app.py"
echo.
echo Waiting 2 seconds...
timeout /t 2 /nobreak > nul
echo.
echo Starting Frontend in new window...
start "Frontend Dev Server (Port 5173)" cmd /k "chcp 65001 >nul && cd /d "%~dp0react-app" && npm run dev"
echo.
echo ====================================
echo Both servers are running!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo ====================================
pause
