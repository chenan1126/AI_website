# 🚨 Railway 部署故障排除指南

## 當部署成功但服務無法訪問時

### 1. 檢查部署狀態
在 Railway 控制台檢查：
- 部署狀態是否為 "SUCCESS"
- 應用是否正在運行（有綠色指示器）

### 2. 檢查環境變數
在 Railway 的 "Variables" 頁面確認：
```
GEMINI_API_KEY=你的實際金鑰
GOOGLE_MAPS_API_KEY=你的實際金鑰
OPENWEATHERMAP_API_KEY=你的實際金鑰
```

### 3. 檢查部署日誌
查看 Railway 的部署日誌，尋找：
- ✅ "啟動後端服務器，監聽埠號: [數字]"
- ✅ "Railway PORT 環境變數: [數字]"
- ✅ "Running on http://0.0.0.0:[數字]"

### 4. 測試端點
部署成功後，測試這些 URL：
- 主頁：`https://your-app-url.railway.app/`
- 健康檢查：`https://your-app-url.railway.app/health`

### 5. 常見問題與解決方案

#### 問題：服務啟動但無法訪問
**原因**：工作目錄或啟動命令問題
**解決**：已修復 - 現在使用 `cd /app && python backend/app.py`

#### 問題：API 金鑰錯誤
**原因**：環境變數未設定或金鑰無效
**解決**：檢查 Railway Variables 頁面

#### 問題：埠號問題
**原因**：應用未讀取 PORT 環境變數
**解決**：已修復 - 應用現在動態讀取 PORT

### 6. 手動重新部署
如果問題持續：
1. 前往 Railway 控制台
2. 點擊 "Deploy" 按鈕手動重新部署
3. 等待新部署完成（約 3-5 分鐘）

### 7. 聯絡支援
如果以上都無法解決：
- 提供 Railway 的部署日誌
- 說明具體的錯誤現象
- 我會進一步協助診斷問題