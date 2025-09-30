# 🚀 Railway 雲端部署指南

## 快速部署步驟

### 1. 註冊 Railway 帳號
前往 [Railway.app](https://railway.app) 註冊帳號（支援 GitHub 登入）

### 2. 創建新專案
1. 點擊 "New Project"
2. 選擇 "Deploy from GitHub repo"
3. 連接您的 GitHub 帳號
4. 選擇 `AI_website` 倉庫

### 3. 設置環境變數
在 Railway 控制台中，前往專案的 "Variables" 頁面，添加以下變數：

```bash
GEMINI_API_KEY=你的_Gemini_API_金鑰
GOOGLE_MAPS_API_KEY=你的_Google_Maps_API_金鑰
OPENWEATHERMAP_API_KEY=你的_OpenWeather_API_金鑰
```

### 4. 部署完成
Railway 會自動檢測並部署您的應用。部署成功後，您會獲得一個公開的 URL。

## 🎯 重要提醒

- **免費額度**：Railway 提供每月 $5 的免費額度，足夠用於演示
- **冷啟動**：免費用戶可能會有冷啟動延遲（幾秒鐘）
- **API 金鑰**：確保所有必要的 API 金鑰都已正確設置

## 🔧 故障排除

如果部署失敗：
1. 檢查 Railway 的部署日誌
2. 確認所有環境變數都已設置
3. 確保 API 金鑰有效

## 📱 測試應用

部署成功後，訪問 Railway 提供的 URL，您就可以在網路上使用完整的 AI 旅遊規劃功能了！

---

**注意**：這是專為教授演示優化的快速部署方案。