# PowerShell 啟動腳本
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "正在啟動前端和後端伺服器..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 獲取腳本所在目錄
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 啟動後端
Write-Host "啟動後端伺服器..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptPath "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python app.py" -WindowStyle Normal

# 等待2秒
Write-Host "等待2秒..." -ForegroundColor Gray
Start-Sleep -Seconds 2

# 啟動前端
Write-Host "啟動前端開發伺服器..." -ForegroundColor Yellow
$frontendPath = Join-Path $scriptPath "react-app"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "兩個伺服器已啟動完成!" -ForegroundColor Green
Write-Host "後端: http://localhost:5000" -ForegroundColor White
Write-Host "前端: http://localhost:5173" -ForegroundColor White
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "按任意鍵關閉此視窗..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
