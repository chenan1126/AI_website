# 部署到 Vercel 指南

## 前置準備

1. **確保你有 Vercel 帳號**
   - 訪問 https://vercel.com
   - 使用 GitHub 帳號登入

## 部署步驟

### 方法 1: 使用 Vercel CLI（推薦）

1. **安裝 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登入 Vercel**
   ```bash
   vercel login
   ```

3. **進入 react-app 目錄**
   ```bash
   cd react-app
   ```

4. **部署**
   ```bash
   vercel
   ```
   
   第一次部署時，CLI 會詢問幾個問題：
   - Set up and deploy? → **Y**
   - Which scope? → 選擇你的帳號
   - Link to existing project? → **N**
   - What's your project's name? → **ai-travel-planner** (或其他名稱)
   - In which directory is your code located? → **./** (按 Enter)
   - Want to override the settings? → **N**

5. **生產環境部署**
   ```bash
   vercel --prod
   ```

### 方法 2: 使用 Vercel Dashboard

1. 訪問 https://vercel.com/new
2. 選擇 "Import Git Repository"
3. 選擇你的 GitHub 倉庫
4. 配置項目：
   - **Framework Preset**: Vite
   - **Root Directory**: `react-app`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. 點擊 "Deploy"

## 環境變量設置（重要！）

由於前端需要連接到後端 API，你需要設置環境變量：

1. 在 Vercel Dashboard 中，進入你的項目
2. 點擊 "Settings" → "Environment Variables"
3. 添加以下變量：
   - `VITE_API_URL`: 你的後端 API 地址（例如：`https://your-backend.onrender.com`）

## 更新前端代碼以使用環境變量

需要修改 `App.jsx` 中的 API 請求地址：

```javascript
// 將
const response = await fetch('http://localhost:5000/ask', {

// 改為
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const response = await fetch(`${apiUrl}/ask`, {
```

## 部署後

部署成功後，Vercel 會提供：
- **Production URL**: `https://your-project.vercel.app`
- **Preview URLs**: 每次 push 都會自動創建預覽部署

## 自動部署

連接 GitHub 倉庫後：
- 每次推送到 `main` 分支 → 自動部署到生產環境
- 每次推送到其他分支 → 自動創建預覽部署

## 常見問題

### Q: 部署後 API 請求失敗？
A: 確保設置了正確的 `VITE_API_URL` 環境變量，並且後端啟用了 CORS。

### Q: 頁面刷新後 404？
A: `vercel.json` 中的 rewrites 配置已經處理了這個問題。

### Q: 如何回滾部署？
A: 在 Vercel Dashboard 的 Deployments 頁面，找到之前的部署，點擊 "Promote to Production"。

## 本地測試生產構建

在部署前，可以本地測試生產構建：

```bash
npm run build
npm run preview
```

## 監控和分析

Vercel 提供：
- **Analytics**: 訪問統計
- **Logs**: 運行日誌
- **Speed Insights**: 性能分析

訪問項目 Dashboard 查看這些功能。
