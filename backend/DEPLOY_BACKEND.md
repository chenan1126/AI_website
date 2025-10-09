# 後端部署指南 - Render.com（免費）

## 為什麼要部署後端？

Vercel 只能部署**前端**（React 應用）。你的 Python 後端需要另外部署到支援 Python 的平台。

## 推薦：Render.com（免費方案）

### 優點
- ✅ 完全免費（有限制但夠用）
- ✅ 支援 Python
- ✅ 自動從 GitHub 部署
- ✅ 提供 HTTPS
- ⚠️ 缺點：閒置 15 分鐘後會休眠，第一次請求需要等待 30-60 秒

---

## 🚀 快速部署步驟

### 步驟 1: 準備後端文件

需要在 `backend` 文件夾創建這些文件：

#### 1.1 創建 `requirements.txt`
```txt
quart
quart-cors
google-generativeai
python-dotenv
requests
aiohttp
```

#### 1.2 創建 `render.yaml`（可選，但推薦）
```yaml
services:
  - type: web
    name: ai-travel-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python app.py
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: GOOGLE_MAPS_API_KEY
        sync: false
      - key: OPENWEATHERMAP_API_KEY
        sync: false
```

#### 1.3 修改 `app.py` 啟動設置
在 `app.py` 最後添加：
```python
if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

### 步驟 2: 推送到 GitHub

```bash
cd backend
# 確保 requirements.txt 存在
git add .
git commit -m "準備後端部署"
git push
```

### 步驟 3: 在 Render 部署

1. **訪問 Render**
   - 網址：https://render.com
   - 點擊 **Get Started** 或 **Sign Up**
   - 使用 GitHub 帳號登入

2. **創建 Web Service**
   - 點擊 **New +** → **Web Service**
   - 選擇你的 `AI_website` 倉庫
   - 點擊 **Connect**

3. **配置服務**
   - **Name**: `ai-travel-backend`
   - **Region**: Singapore（離台灣最近）
   - **Branch**: `main`
   - **Root Directory**: `backend` ⚠️ **重要！**
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Instance Type**: `Free`

4. **設置環境變量**
   點擊 **Advanced** → **Add Environment Variable**
   
   添加以下變量：
   - `GEMINI_API_KEY` = 你的 Gemini API Key
   - `GOOGLE_MAPS_API_KEY` = 你的 Google Maps API Key
   - `OPENWEATHERMAP_API_KEY` = 你的 OpenWeather API Key（如果有）
   - `PORT` = `10000`（Render 預設）

5. **部署**
   - 點擊 **Create Web Service**
   - 等待 5-10 分鐘（第一次部署較慢）

### 步驟 4: 獲取後端 URL

部署成功後，你會獲得一個 URL：
```
https://ai-travel-backend.onrender.com
```

### 步驟 5: 更新 Vercel 前端環境變量

1. 進入 Vercel Dashboard
2. 選擇你的前端專案
3. Settings → Environment Variables
4. 添加/更新：
   - `VITE_API_URL` = `https://ai-travel-backend.onrender.com`
5. 重新部署前端

---

## 🔄 自動部署

設置完成後，每次你推送代碼到 GitHub：
- Render 會自動重新部署後端
- Vercel 會自動重新部署前端

---

## ⚠️ Render 免費方案限制

1. **休眠機制**
   - 閒置 15 分鐘後自動休眠
   - 下次請求需要等待 30-60 秒喚醒
   - 解決方案：使用 cron job 定期 ping（可選）

2. **每月限制**
   - 750 小時免費運行時間
   - 對於個人專題足夠使用

3. **性能**
   - 共享 CPU
   - 512MB RAM
   - 適合輕量應用

---

## 🎯 其他免費替代方案

### Railway.app
- 免費方案：每月 $5 額度
- 優點：不會休眠
- 缺點：額度用完需付費
- 網址：https://railway.app

### Fly.io
- 免費方案：3 個小型應用
- 優點：效能好，不休眠
- 缺點：配置較複雜
- 網址：https://fly.io

### PythonAnywhere
- 免費方案有限制
- 優點：專門為 Python 設計
- 缺點：功能受限
- 網址：https://www.pythonanywhere.com

---

## ✅ 完整部署檢查清單

- [ ] 在 `backend/` 創建 `requirements.txt`
- [ ] 修改 `app.py` 添加 `if __name__ == '__main__'`
- [ ] 推送到 GitHub
- [ ] 在 Render 創建 Web Service
- [ ] 設置 Root Directory 為 `backend`
- [ ] 添加所有環境變量（API Keys）
- [ ] 等待部署完成
- [ ] 獲取後端 URL
- [ ] 在 Vercel 設置 `VITE_API_URL`
- [ ] 測試前後端連接

---

## 🐛 常見問題

**Q: 部署失敗？**
A: 檢查 Render 的 Logs，確認 `requirements.txt` 正確

**Q: 前端連不到後端？**
A: 檢查 CORS 設置，確認 Vercel 環境變量正確

**Q: 太慢？**
A: 免費方案第一次請求會慢，之後會快一些

**Q: 想避免休眠？**
A: 可以用 GitHub Actions 定期 ping，或考慮付費方案

---

需要我幫你創建 `requirements.txt` 和修改 `app.py` 嗎？
