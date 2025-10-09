# 🚀 Vercel 全棧部署指南（串流版本）

## ✨ 架構說明

### 技術棧
- **前端**：React 19 + Vite
- **後端**：Python Serverless Functions (Vercel)
- **AI**：Google Gemini 2.0 Flash (串流模式)
- **部署**：Vercel (全棧)

### 關鍵特性
✅ **串流式響應** - 使用 Server-Sent Events (SSE) 實現即時反饋  
✅ **繞過超時限制** - 持續的資料流動避免 10 秒超時  
✅ **更好的用戶體驗** - 即時顯示進度，不再盯著載入圈圈  
✅ **單域名部署** - 前後端統一在 Vercel，無需 CORS 配置  

---

## 📋 部署步驟

### 步驟 1：登入 Vercel

1. 訪問 **https://vercel.com**
2. 點擊 **Sign Up** 或 **Log In**
3. 選擇 **Continue with GitHub**
4. 授權 Vercel 訪問你的 GitHub 倉庫

### 步驟 2：導入專案

1. 登入後，點擊 **Add New...** → **Project**
2. 或直接訪問：**https://vercel.com/new**
3. 找到 **AI_website** 倉庫
4. 點擊 **Import**

### 步驟 3：配置專案

在配置頁面：

**Project Name（專案名稱）:**
- 建議：`ai-travel-planner` 或保持預設

**Framework Preset（框架預設）:**
- Vercel 會自動偵測到 **Vite**

**Root Directory（根目錄）:**
- ⚠️ **保持為根目錄**（不要選擇 react-app）
- 因為我們有 `vercel.json` 配置文件會自動處理

**Build Settings:**
- Build Command: `cd react-app && npm install && npm run build`
- Output Directory: `react-app/dist`
- Install Command: `npm install`

### 步驟 4：配置環境變量 ⚠️ 重要！

在 **Environment Variables** 區塊添加：

| Variable Name | Value | 說明 |
|--------------|-------|------|
| `GEMINI_API_KEY` | 你的 Gemini API Key | 從 Google AI Studio 獲取 |
| `GOOGLE_MAPS_API_KEY` | 你的 Google Maps API Key | （可選）用於地點搜索 |
| `CWA_API_KEY` | `CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2` | 台灣中央氣象署 API |

**如何獲取 API Keys:**

**Gemini API Key:**
1. 訪問 https://aistudio.google.com/app/apikey
2. 點擊 **Get API Key** 或 **Create API Key**
3. 複製 Key（格式：`AIza...`）

**Google Maps API Key:**
1. 訪問 https://console.cloud.google.com/
2. 啟用 Maps JavaScript API 和 Places API
3. 創建 API Key
4. （可選）如果不使用，留空即可

### 步驟 5：開始部署

1. 檢查所有設置無誤
2. 點擊 **Deploy**
3. 等待 3-5 分鐘（首次部署較慢）

Vercel 會自動：
- ✅ 安裝 Python 依賴
- ✅ 編譯 React 前端
- ✅ 部署 Serverless Functions
- ✅ 設置 CDN 和路由

---

## 🎯 部署後測試

### 1. 檢查部署狀態

部署成功後你會看到：
- 🎊 恭喜畫面
- 🌐 你的網站 URL：`https://your-project.vercel.app`

### 2. 測試健康檢查

訪問：
```
https://your-project.vercel.app/api
```

應該看到：
```json
{
  "status": "running",
  "message": "AI Travel Planner Backend API",
  "version": "2.0.0",
  "platform": "Vercel Serverless Functions"
}
```

### 3. 測試完整功能

1. 訪問首頁：`https://your-project.vercel.app`
2. 輸入測試查詢：`明天去嘉義玩兩天`
3. 觀察串流效果：
   - ✅ 應該立即看到「正在規劃...」提示
   - ✅ 接著顯示「正在獲取天氣資訊...」
   - ✅ 然後「AI 正在生成行程...」
   - ✅ 最後顯示完整行程

---

## 🔧 串流技術說明

### 後端實作（Python Serverless Function）

```python
# api/ask.py

# 1. 設置 SSE 響應頭
self.send_header('Content-Type', 'text/event-stream')
self.send_header('Cache-Control', 'no-cache')
self.send_header('Connection', 'keep-alive')

# 2. 發送事件
def send_sse_event(self, event_type, data):
    message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    self.wfile.write(message.encode('utf-8'))
    self.wfile.flush()

# 3. 使用 Gemini 串流 API
response = model.generate_content(prompt, stream=True)
for chunk in response:
    self.send_sse_event('chunk', {'text': chunk.text})
```

### 前端實作（React）

```javascript
// react-app/src/App.jsx

// 1. 使用 fetch + ReadableStream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // 2. 解析 SSE 事件
  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split('\n\n');
  
  // 3. 處理不同事件類型
  if (eventType === 'chunk') {
    accumulatedText += eventData.text;
    setStreamingStatus('接收中...');
  }
}
```

---

## 🔄 自動部署設置

現在你的專案已經連接到 GitHub，以後：

✅ **每次推送到 `main` 分支** → Vercel 自動部署到生產環境  
✅ **每次推送到其他分支** → Vercel 自動創建預覽部署  
✅ **每個 Pull Request** → 自動生成預覽 URL  

### 如何更新網站

只需要：
```bash
git add .
git commit -m "更新內容"
git push
```

Vercel 會自動：
1. 偵測到新的推送
2. 自動構建
3. 自動部署
4. 發送通知（可選）

---

## ⚙️ 進階配置

### 自訂域名

1. 在 Vercel Dashboard 點擊 **Settings** → **Domains**
2. 添加你的域名（例如：`travel.yourdomain.com`）
3. 在 DNS 服務商添加 CNAME 記錄：
   ```
   CNAME: travel -> cname.vercel-dns.com
   ```

### 效能優化

`vercel.json` 已經配置：
- **Memory**: 1024 MB（1 GB）
- **Max Duration**: 60 秒（Pro 計畫可達 300 秒）
- **Build Command**: 優化的構建流程

### 監控與日誌

在 Vercel Dashboard：
- **Deployments**: 查看所有部署歷史
- **Analytics**: 查看訪問統計（需升級）
- **Logs**: 查看 Serverless Functions 日誌

---

## 🐛 常見問題排查

### 問題 1：部署失敗

**症狀**：Build 階段失敗

**解決方案**：
1. 檢查 Vercel 部署日誌
2. 確認 `package.json` 中的依賴正確
3. 確認 Python 依賴在 `requirements.txt` 中

### 問題 2：API 返回 500 錯誤

**症狀**：前端顯示「生成行程失敗」

**解決方案**：
1. 檢查 Vercel Functions 日誌
2. 確認環境變量 `GEMINI_API_KEY` 已設置
3. 測試 Gemini API Key 是否有效：
   ```bash
   curl https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY
   ```

### 問題 3：串流響應中斷

**症狀**：載入一半就停止了

**解決方案**：
1. 檢查網路連接
2. 確認 `vercel.json` 中 `maxDuration` 設置為 60
3. 如果使用免費計畫，考慮升級到 Pro

### 問題 4：CORS 錯誤

**症狀**：瀏覽器 Console 顯示 CORS 錯誤

**解決方案**：
- ✅ 前後端在同一個域名下，不應該有 CORS 問題
- ✅ 檢查 `api/ask.py` 和 `api/index.py` 中的 CORS 頭設置

---

## 📊 效能基準

**預期效能**：
- **首次連接**：< 500ms
- **解析查詢**：< 1s
- **獲取天氣**：< 2s
- **生成行程（串流）**：5-15s（但用戶立即看到進度）
- **總體感知時間**：~2-3s（因為有即時反饋）

**與傳統模式對比**：
- ❌ 傳統：等待 15 秒 → 突然顯示結果
- ✅ 串流：2 秒開始顯示 → 逐步完成 → 15 秒完成

---

## 🎓 技術細節

### 為什麼串流能繞過 10 秒限制？

Vercel 的 10 秒超時是針對**「無響應」的函數**。

在串流模式下：
1. 後端每收到 Gemini 的文字塊，就立即發送給前端
2. 這形成了**持續的資料流動**
3. Vercel 偵測到連線活躍，不會終止函數
4. 只要保持資料流動，可以運行到 `maxDuration` 限制（60 秒）

### 文件結構

```
AI_website/
├── api/                     # Python Serverless Functions
│   ├── index.py            # 健康檢查 GET /api
│   ├── ask.py              # 主要 API POST /api/ask (串流)
│   └── _utils.py           # 共用工具（天氣 API）
├── react-app/              # React 前端
│   ├── src/
│   │   ├── App.jsx         # 主應用（支援串流）
│   │   └── components/
│   └── dist/               # 構建輸出
├── vercel.json             # Vercel 配置
└── requirements.txt        # Python 依賴
```

---

## 🚀 你的網站已上線！

**下一步：**
1. ✅ 分享你的網站 URL 給朋友測試
2. ✅ 在 Vercel Dashboard 監控使用情況
3. ✅ 根據需求調整 Gemini prompt
4. ✅ 考慮添加更多功能（地圖整合、用戶評論等）

**需要幫助？**
- Vercel 文檔：https://vercel.com/docs
- Gemini API：https://ai.google.dev/docs
- 專案 GitHub：https://github.com/chenan1126/AI_website

---

**恭喜！你的 AI 旅遊規劃助手現在完全運行在 Vercel 上了！** 🎉
