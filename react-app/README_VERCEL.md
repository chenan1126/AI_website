ㄏ# ✅ 代碼已上傳到 GitHub！

## 🎉 下一步：在 Vercel 上自動部署

### 步驟 1: 登入 Vercel

1. 訪問 **https://vercel.com**
2. 點擊 **Sign Up** 或 **Log In**
3. 選擇 **Continue with GitHub**（使用 GitHub 帳號登入）
4. 授權 Vercel 訪問你的 GitHub 倉庫

### 步驟 2: 導入專案

1. 登入後，點擊 **Add New...** → **Project**
2. 或直接訪問：**https://vercel.com/new**
3. 你會看到你的 GitHub 倉庫列表
4. 找到 **AI_website** 倉庫
5. 點擊 **Import**

### 步驟 3: 配置專案

在配置頁面：

**Project Name（專案名稱）:**
- 可以使用預設或改成 `ai-travel-planner`

**Framework Preset（框架預設）:**
- Vercel 會自動偵測到 **Vite**（如果沒有，手動選擇）

**Root Directory（根目錄）:**
- ⚠️ **重要！** 點擊 **Edit**
- 選擇 **react-app** 文件夾
- 或輸入：`react-app`

**Build and Output Settings（構建和輸出設置）:**
- Build Command: `npm run build`（自動填寫）
- Output Directory: `dist`（自動填寫）
- Install Command: `npm install`（自動填寫）

### 步驟 4: 部署

1. 檢查設置無誤後，點擊 **Deploy**
2. 等待 2-3 分鐘，Vercel 會自動：
   - 安裝依賴 (`npm install`)
   - 構建專案 (`npm run build`)
   - 部署到 CDN

### 步驟 5: 獲取網址

部署成功後，你會看到：
- 🎊 恭喜畫面
- 🌐 你的網站 URL：`https://your-project.vercel.app`
- 點擊 **Visit** 查看你的網站

### 步驟 6: 設置後端 API 地址（重要！）

因為前端需要連接後端，所以需要設置環境變量：

1. 在 Vercel 專案頁面，點擊 **Settings**
2. 左側選單點擊 **Environment Variables**
3. 添加新變量：
   - **Name**: `VITE_API_URL`
   - **Value**: 你的後端 API 地址
     - 例如：`http://localhost:5000`（本地測試）
     - 或：`https://your-backend.onrender.com`（如果後端已部署）
4. 點擊 **Save**
5. 回到 **Deployments** 頁面
6. 點擊最新的部署，選擇 **Redeploy**（重新部署）

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

## 📱 查看部署狀態

在 Vercel Dashboard：
- **Deployments**: 查看所有部署歷史
- **Analytics**: 查看訪問統計
- **Logs**: 查看構建和運行日誌

## ⚠️ 注意事項

1. **後端連接**
   - 如果後端還在本地（localhost），線上網站無法訪問
   - 需要將後端也部署到雲端（Render、Railway 等）
   - 然後在 Vercel 設置 `VITE_API_URL`

2. **CORS 設置**
   - 確保後端的 CORS 允許你的 Vercel 域名
   - 後端 `app.py` 已經有 `app = cors(app)`

3. **環境變量**
   - 必須以 `VITE_` 開頭才能在前端使用
   - 修改環境變量後需要重新部署

## 🎯 完成檢查清單

- [ ] Vercel 專案創建成功
- [ ] Root Directory 設置為 `react-app`
- [ ] 部署成功，獲得 Vercel URL
- [ ] 設置 `VITE_API_URL` 環境變量
- [ ] 重新部署使環境變量生效
- [ ] 測試網站是否正常運行

## 🆘 需要幫助？

如果遇到問題：
1. 查看 Vercel 的 **Logs** 頁面
2. 檢查 **Environment Variables** 是否正確
3. 確認 **Root Directory** 是 `react-app`
4. 查看瀏覽器 Console 的錯誤訊息

---

**你的網站即將上線！** 🚀
