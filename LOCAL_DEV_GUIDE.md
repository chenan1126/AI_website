# 本地開發指南

## 🚀 快速開始

### 方法 1：使用啟動腳本（推薦）

**Windows (PowerShell):**
```powershell
.\start-local-dev.ps1
```

**Windows (CMD):**
```cmd
start-local-dev.bat
```

### 方法 2：手動啟動

**終端 1 - 啟動後端 API（Vercel Dev）:**
```bash
vercel dev --listen 3000
```

**終端 2 - 啟動前端:**
```bash
cd react-app
npm run dev
```

## 📍 本地訪問地址

- **前端應用**: http://localhost:5173
- **後端 API**: http://localhost:3000/api/ask
- **測試天氣 API**: http://localhost:3000/api/weather

## 🔧 環境變數設置

確保專案根目錄有 `.env` 檔案，內容如下：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
GOOGLE_MAPS_API_KEY=你的_Google_Maps_API_Key
CWA_API_KEY=你的_氣象局_API_Key
```

## 💡 開發流程

### 1️⃣ 修改程式碼
- **後端**: 修改 `api/` 資料夾中的檔案
- **前端**: 修改 `react-app/src/` 資料夾中的檔案

### 2️⃣ 即時預覽
- 修改後會**自動重新載入**，立即看到效果
- 不需要重啟服務器（大部分情況下）

### 3️⃣ 查看除錯訊息
- **後端日誌**: 查看 Vercel Dev Server 的終端視窗
- **前端日誌**: 打開瀏覽器開發者工具 Console (F12)

### 4️⃣ 測試完成後提交
```bash
git add .
git commit -m "你的提交訊息"
git push origin main
```

## 🐛 除錯技巧

### 查看後端日誌
後端的所有 `console.log()` 會顯示在 Vercel Dev Server 的終端視窗中。

**範例輸出:**
```
[Weather API] 正在為城市「台中」獲取...
[Weather Parser] 紫外線指數: value = 9
```

### 查看前端日誌
在瀏覽器按 `F12` 打開開發者工具，查看 Console 標籤。

### 查看網路請求
在開發者工具的 Network 標籤可以看到所有 API 請求和回應。

## 🔄 常見問題

### Q: 修改程式碼後沒有更新？
**A**: 
- 前端：檢查終端是否顯示重新編譯訊息
- 後端：Vercel Dev 會自動重載，如果沒有，嘗試重啟

### Q: Port 已被占用？
**A**: 
```bash
# 關閉占用 3000 port 的程序
netstat -ano | findstr :3000
taskkill /PID <PID號碼> /F
```

### Q: 環境變數沒有生效？
**A**: 
1. 確認 `.env` 檔案在專案根目錄
2. 重啟 Vercel Dev Server
3. 檢查變數名稱是否正確

### Q: 如何停止服務器？
**A**: 
在各個終端視窗按 `Ctrl + C`

## 📊 本地 vs 生產環境

| 項目 | 本地開發 | 生產環境 (Vercel) |
|------|---------|------------------|
| **後端 URL** | http://localhost:3000 | https://你的網域.vercel.app |
| **前端 URL** | http://localhost:5173 | https://你的網域.vercel.app |
| **即時重載** | ✅ 是 | ❌ 否（需 push） |
| **除錯訊息** | ✅ 完整 | ⚠️ 需查看 Vercel 日誌 |
| **環境變數** | `.env` 檔案 | Vercel Dashboard 設置 |

## 🎯 推薦開發工作流程

```
1. 啟動本地開發環境
   ↓
2. 修改程式碼
   ↓
3. 在瀏覽器測試功能
   ↓
4. 查看 console 除錯訊息
   ↓
5. 修正問題（重複 2-4）
   ↓
6. 功能完成且測試通過
   ↓
7. git add → commit → push
   ↓
8. Vercel 自動部署到生產環境
```

## 🌟 額外工具

### 推薦的 VS Code 擴充功能
- **ES7+ React/Redux/React-Native snippets**: React 程式碼片段
- **ESLint**: JavaScript 程式碼檢查
- **Prettier**: 程式碼格式化
- **Thunder Client**: API 測試（類似 Postman）

### 快速測試 API
使用 Thunder Client 或 curl 測試後端 API：

```bash
# 測試 ask API
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"台中一日遊\"}"
```

---

**Happy Coding! 🎉**
