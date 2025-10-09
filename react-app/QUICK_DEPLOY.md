# 🚀 快速部署到 Vercel

## ✅ 已完成的準備工作

- ✓ 刪除舊的 frontend 文件夾
- ✓ 創建 `vercel.json` 配置文件
- ✓ 修改 `App.jsx` 支持環境變量
- ✓ React 應用使用 Vite 構建工具

## 📝 部署步驟（3分鐘完成）

### 方法 1: 使用 Vercel CLI（最快）

1. **安裝 Vercel CLI**
   ```powershell
   npm install -g vercel
   ```

2. **進入 react-app 目錄**
   ```powershell
   cd react-app
   ```

3. **登入並部署**
   ```powershell
   vercel login
   vercel
   ```

4. **部署到生產環境**
   ```powershell
   vercel --prod
   ```

### 方法 2: 使用 GitHub + Vercel Dashboard（推薦）

1. **推送代碼到 GitHub**
   ```powershell
   git add .
   git commit -m "準備部署到 Vercel"
   git push
   ```

2. **連接 Vercel**
   - 訪問 [vercel.com/new](https://vercel.com/new)
   - 用 GitHub 登入
   - 選擇你的倉庫
   - **Root Directory** 設置為 `react-app`
   - 點擊 "Deploy"

3. **設置環境變量**（部署完成後）
   - 進入項目 Settings → Environment Variables
   - 添加：`VITE_API_URL` = `你的後端API地址`
   - 重新部署（Deployments → Redeploy）

## 🔧 後端 API 設置

你的後端需要：

1. **啟用 CORS**
   ```python
   # backend/app.py 已經有了
   app = cors(app)  # 啟用 CORS
   ```

2. **部署後端**（選項）
   - Railway: https://railway.app
   - Render: https://render.com
   - Heroku: https://heroku.com

3. **獲取後端 URL**
   - 例如：`https://your-backend.onrender.com`

4. **在 Vercel 設置環境變量**
   - `VITE_API_URL` = 後端 URL

## 🎯 部署後檢查清單

- [ ] 前端成功部署（獲得 Vercel URL）
- [ ] 後端 CORS 正確配置
- [ ] 在 Vercel 設置 `VITE_API_URL` 環境變量
- [ ] 測試 API 連接（查看瀏覽器 Console）
- [ ] 測試生成行程功能

## 📌 重要提醒

### 本地開發
不需要設置 `.env` 文件，代碼會自動使用 `http://localhost:5000`

### 生產環境
**必須**在 Vercel Dashboard 設置 `VITE_API_URL` 環境變量

## 🐛 常見問題

**Q: 部署後顯示「後端服務器未運行」？**
A: 檢查 Vercel 環境變量是否正確設置，後端是否運行中

**Q: API 請求被 CORS 阻擋？**
A: 確認後端的 `app = cors(app)` 已啟用

**Q: 修改代碼後如何更新？**
A: 推送到 GitHub，Vercel 會自動重新部署

## 📊 部署完成後

你會獲得：
- 🌐 Production URL: `https://your-project.vercel.app`
- 🔄 自動部署：每次 push 自動更新
- 📈 Analytics：訪問數據分析
- ⚡ CDN 加速：全球快速訪問

## 🎉 開始部署

選擇上面的方法 1 或方法 2，開始部署吧！

---

**需要幫助？** 查看完整文檔：[DEPLOYMENT.md](./DEPLOYMENT.md)
