# 本地開發環境啟動腳本
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "🚀 啟動本地開發環境" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 提示：" -ForegroundColor Yellow
Write-Host "- Backend API 將運行在 http://localhost:3000/api" -ForegroundColor Gray
Write-Host "- Frontend 將運行在 http://localhost:5173" -ForegroundColor Gray
Write-Host "- 所有修改都會即時生效，無需 push" -ForegroundColor Gray
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 .env 檔案
if (-not (Test-Path .env)) {
    Write-Host "⚠️  警告：找不到 .env 檔案" -ForegroundColor Red
    Write-Host "請確保已建立 .env 並設置以下變數：" -ForegroundColor Yellow
    Write-Host "- GEMINI_API_KEY" -ForegroundColor Gray
    Write-Host "- GOOGLE_MAPS_API_KEY" -ForegroundColor Gray
    Write-Host "- CWA_API_KEY" -ForegroundColor Gray
    Write-Host ""
    pause
    exit 1
}

Write-Host "🔧 啟動 Vercel Dev Server（後端 API）..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🔧 Vercel Dev Server (Backend)' -ForegroundColor Cyan; vercel dev --listen 3000"

Write-Host "⏳ 等待後端啟動..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "🎨 啟動 Frontend Dev Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🎨 Frontend Dev Server' -ForegroundColor Cyan; cd react-app; npm run dev"

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "✅ 本地開發環境已啟動！" -ForegroundColor Green
Write-Host ""
Write-Host "📍 訪問地址：" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend API: http://localhost:3000/api/ask" -ForegroundColor White
Write-Host ""
Write-Host "💡 開發提示：" -ForegroundColor Yellow
Write-Host "   1. 修改程式碼後會自動重新載入" -ForegroundColor Gray
Write-Host "   2. 檢查兩個視窗的 console 輸出" -ForegroundColor Gray
Write-Host "   3. 測試完成後再 git push" -ForegroundColor Gray
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意鍵關閉此視窗（不會停止服務器）..." -ForegroundColor Gray
pause
