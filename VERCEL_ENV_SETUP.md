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
# Supabase 雲端資料庫 (必需)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Maps API Key (必需)
GOOGLE_MAPS_API_KEY=你的_Google_Maps_API_金鑰

# Gemini API Key (必需)
GEMINI_API_KEY=你的_Gemini_API_金鑰

# CWA 天氣 API Key (選填，有預設值)
CWA_API_KEY=CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2
```

### 步驟 1.5: 獲取 Supabase 環境變數

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 前往 **Settings** → **API**
4. 複製以下資訊：
   - **Project URL** → 設定為 `SUPABASE_URL`
   - **service_role** (secret) → 設定為 `SUPABASE_SERVICE_ROLE_KEY`

### 步驟 2: 創建 trip_reports 表

在 Supabase Dashboard 中：

1. 前往 **SQL Editor**
2. 執行以下 SQL 語句來創建回報表：

```sql
-- 創建行程回報表，用於存儲用戶回報的行程問題
CREATE TABLE IF NOT EXISTS trip_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL, -- 用戶的原始查詢
  prompt TEXT NOT NULL, -- 生成行程時使用的完整prompt
  generated_result JSONB NOT NULL, -- AI生成的完整結果
  report_reason TEXT, -- 用戶回報的原因（可選）
  report_details TEXT, -- 用戶的詳細反饋（可選）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_trip_reports_user_id ON trip_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_reports_status ON trip_reports(status);
CREATE INDEX IF NOT EXISTS idx_trip_reports_created_at ON trip_reports(created_at DESC);

-- 啟用 RLS (Row Level Security)
ALTER TABLE trip_reports ENABLE ROW LEVEL SECURITY;

-- 創建政策：用戶只能查看自己的回報
CREATE POLICY "Users can view their own reports" ON trip_reports
  FOR SELECT USING (auth.uid() = user_id);

-- 用戶可以創建自己的回報
CREATE POLICY "Users can insert their own reports" ON trip_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 管理員可以查看所有回報（假設有一個admin角色）
CREATE POLICY "Admins can view all reports" ON trip_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 管理員可以更新回報狀態
CREATE POLICY "Admins can update reports" ON trip_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 創建更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trip_reports_updated_at
  BEFORE UPDATE ON trip_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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
