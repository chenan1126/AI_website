@echo off
chcp 65001 >nul
echo ====================================
echo 🚀 啟動本地開發環境
echo ====================================
echo.
echo 📝 提示：
echo - Backend API 將運行在 http://localhost:3000/api
echo - Frontend 將運行在 http://localhost:5173
echo - 所有修改都會即時生效，無需 push
echo.
echo ====================================
echo.

REM 檢查 .env 檔案
if not exist .env (
    echo ⚠️  警告：找不到 .env 檔案
    echo 請確保已建立 .env 並設置以下變數：
    echo - GEMINI_API_KEY
    echo - GOOGLE_MAPS_API_KEY
    echo - CWA_API_KEY
    echo.
    pause
    exit /b 1
)

echo 🔧 啟動 Vercel Dev Server（後端 API）...
start "Vercel Dev - Backend API" cmd /k "vercel dev --listen 3000"

echo ⏳ 等待後端啟動...
timeout /t 5 /nobreak > nul

echo 🎨 啟動 Frontend Dev Server...
start "Vite Dev - Frontend" cmd /k "cd react-app && npm run dev"

echo.
echo ====================================
echo ✅ 本地開發環境已啟動！
echo.
echo 📍 訪問地址：
echo    Frontend: http://localhost:5173
echo    Backend API: http://localhost:3000/api/ask
echo.
echo 💡 開發提示：
echo    1. 修改程式碼後會自動重新載入
echo    2. 檢查兩個視窗的 console 輸出
echo    3. 測試完成後再 git push
echo ====================================
echo.
pause
