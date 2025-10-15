# Vercel 環境變數設定指南

## 問題診斷
如果在本地開發時有天氣資訊，但在 Vercel 部署後沒有天氣資訊，可能是以下原因：

### 1. 環境變數未設定
Vercel 需要在 Dashboard 中手動設定環境變數。

### 2. API 金鑰過期或無效
CWA（中央氣象署）API 金鑰可能已過期。

---

## 解決方案

### 步驟 1: 檢查 Vercel 環境變數

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案 `AI_website`
3. 前往 **Settings** → **Environment Variables**
4. 確認以下環境變數已設定：

```bash
# Google Maps API Key (必需)
GOOGLE_MAPS_API_KEY=你的_Google_Maps_API_金鑰

# Gemini API Key (必需)
GEMINI_API_KEY=你的_Gemini_API_金鑰

# CWA 天氣 API Key (選填，有預設值)
CWA_API_KEY=CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2
```

### 步驟 2: 測試 CWA API 金鑰是否有效

在瀏覽器中訪問以下 URL 測試：

```
https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-063?Authorization=CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2&format=JSON
```

**預期結果**：
- ✅ 如果返回 JSON 資料且 `"success": "true"`，表示金鑰有效
- ❌ 如果返回錯誤或 `"success": "false"`，需要申請新金鑰

### 步驟 3: 申請新的 CWA API 金鑰（如果需要）

1. 前往 [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/index)
2. 註冊/登入帳號
3. 前往 **會員中心** → **API 授權碼**
4. 複製您的 API 金鑰
5. 在 Vercel 設定 `CWA_API_KEY` 環境變數

### 步驟 4: 重新部署

設定環境變數後，需要重新部署：

**方法 1: 在 Vercel Dashboard 重新部署**
1. 前往 **Deployments** 頁面
2. 點選最新的部署
3. 點擊右上角的 **⋯** → **Redeploy**

**方法 2: 推送新的 commit**
```bash
git commit --allow-empty -m "Trigger redeploy for env vars"
git push origin main
```

---

## 檢查部署日誌

如果問題持續，檢查 Vercel 部署日誌：

1. 前往 **Deployments** 頁面
2. 點選最新的部署
3. 點擊 **Runtime Logs**
4. 搜尋 `[Weather API]` 關鍵字查看天氣 API 的日誌

常見錯誤訊息：
- `HTTP error! status: 401` → API 金鑰無效或過期
- `HTTP error! status: 403` → API 金鑰沒有權限
- `獲取天氣資料失敗` → 網路問題或 API 暫時無法使用

---

## 備用方案：硬編碼 API 金鑰

目前程式碼已經有備用金鑰：
```javascript
const CWA_AUTH = process.env.CWA_API_KEY || 'CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2';
```

如果這個備用金鑰失效，您可以：
1. 申請新的 CWA API 金鑰
2. 更新 `api/_utils.js` 第 44 行的備用金鑰
3. 推送更新到 GitHub

---

## 測試是否成功

1. 訪問您的 Vercel 網站
2. 輸入查詢：「明天去台北玩」
3. 檢查是否顯示天氣卡片和天氣資訊
4. 如果仍然沒有，打開瀏覽器開發者工具（F12）
5. 檢查 **Console** 和 **Network** 標籤的錯誤訊息

---

## 聯絡支援

如果以上方法都無法解決問題，請提供：
1. Vercel Runtime Logs 中的 `[Weather API]` 相關日誌
2. 瀏覽器 Console 的錯誤訊息
3. 測試的查詢內容

這樣可以更準確地診斷問題！
