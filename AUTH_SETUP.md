# 使用者認證系統設置說明

## 📋 已完成的功能

✅ **前端功能**
- 建立了 `AuthForm.jsx` 認證元件，支援註冊和登入
- **Email/密碼認證**（註冊時**必須**設定顯示名稱）
- **Google OAuth 登入**（自動使用 Google 帳號名稱）
- **個人資料編輯**（可隨時修改顯示名稱）
- 在 `App.jsx` 右上角添加了「登入/註冊」按鈕
- 用戶登入後顯示**名字**（而非 email）和登出按鈕
- 點擊名字可以編輯個人資料
- 未登入時也可以正常使用應用程式
- 使用彈窗（Modal）設計，不會干擾主要功能

✅ **樣式設計**
- 現代化的認證表單 UI
- 彈窗遮罩和動畫效果
- 錯誤和成功訊息提示
- 響應式設計支援手機版

## 🔧 需要在 Supabase 後台設置

請按照以下步驟在 Supabase 後台啟用 Email 和 Google 認證：

### 1. 啟用 Email Provider

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 在左側菜單選擇 **Authentication** → **Providers**
4. 找到 **Email** 供應商
5. 確保它是 **啟用（Enabled）** 狀態

### 2. 啟用 Google Provider

1. 在 **Authentication** → **Providers** 頁面
2. 找到 **Google** 供應商並點擊
3. 啟用 Google 登入
4. 填入 Google OAuth 憑證：
   - **Client ID**: 從 Google Cloud Console 獲取
   - **Client Secret**: 從 Google Cloud Console 獲取

#### 如何獲取 Google OAuth 憑證：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 **Google+ API**
4. 前往 **APIs & Services** → **Credentials**
5. 點擊 **Create Credentials** → **OAuth 2.0 Client ID**
6. 應用程式類型選擇 **Web application**
7. 設定授權的重新導向 URI：
   - 從 Supabase 的 Google Provider 設定頁面複製 **Callback URL**
   - 通常格式為：`https://your-project.supabase.co/auth/v1/callback`
8. 複製 **Client ID** 和 **Client Secret** 並貼到 Supabase

### 3. 設定 Email 確認選項（可選）

在 **Authentication** → **Providers** → **Email** 中，您可以設定：

- **Confirm email**: 
  - 🔴 如果啟用：用戶註冊後需要點擊郵件中的確認連結才能登入
  - 🟢 如果停用：用戶註冊後可以立即登入（開發環境建議）

建議開發階段**停用**「Confirm email」，這樣測試更方便。

### 4. 設定 Site URL 和 Redirect URLs

在 **Authentication** → **URL Configuration** 中設定：

- **Site URL**: 
  - 開發環境：`http://localhost:5173`
  - 生產環境：您的實際網域
  
- **Redirect URLs**（加入以下 URL）:
  - `http://localhost:5173/**`
  - 您的生產環境網域 `https://yourdomain.com/**`

## 📝 環境變數檢查

確認 `react-app/.env.local` 檔案中有以下設定：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 測試步驟

### 1. 測試註冊功能
1. 點擊右上角「登入 / 註冊」按鈕
2. 切換到「註冊」頁面
3. **第一個欄位是「顯示名稱」，必須填寫（標記紅色星號 *）**
4. 輸入您的名字（例如：王小明）
5. 輸入 email 和密碼（至少 6 個字元）
6. 點擊「註冊」按鈕
7. 如果啟用了 Email 確認，需要檢查郵箱並點擊確認連結
8. 如果停用了 Email 確認，會顯示成功訊息並自動切換到登入頁面
9. 登入後，右上角應該顯示您剛才輸入的名字

### 2. 測試登入功能
1. 在登入頁面輸入已註冊的 email 和密碼
2. 點擊「登入」按鈕
3. 登入成功後，彈窗會自動關閉
4. 右上角會顯示使用者的 email 和「登出」按鈕

### 3. 測試登出功能
1. 點擊右上角的「登出」按鈕
2. 頁面會自動更新，右上角變回「登入 / 註冊」按鈕

### 4. 測試未登入狀態
1. 確認未登入時仍可以使用旅遊規劃功能
2. 可以輸入問題並生成行程
3. 只是右上角顯示的是「登入 / 註冊」按鈕

## 🔍 偵錯技巧

### 查看瀏覽器控制台（Console）

程式碼中已加入詳細的日誌輸出：

- `✅ 當前 session:` - 顯示當前登入狀態
- `🔄 認證狀態變化:` - 當登入/登出時觸發
- `✅ 登入成功:` / `✅ 註冊成功:` - 認證操作成功
- `❌ 認證錯誤:` - 顯示錯誤訊息
- `✅ 登出成功` / `❌ 登出失敗:` - 登出操作結果

### 常見問題

**Q: 註冊後無法登入？**
A: 檢查 Supabase 是否啟用了「Confirm email」，如果是，需要先確認郵箱。

**Q: 顯示 "Invalid login credentials"？**
A: 確認 email 和密碼是否正確，或者帳號是否已經確認。

**Q: Google 登入沒有反應？**
A: 
1. 確認 Supabase 後台已啟用 Google Provider
2. 確認已正確設定 Google OAuth Client ID 和 Secret
3. 檢查 Redirect URLs 是否正確設定

**Q: Google 登入後顯示錯誤？**
A: 檢查瀏覽器控制台的錯誤訊息，通常是 Redirect URL 設定問題。

**Q: 彈窗無法關閉？**
A: 點擊彈窗外的灰色區域或右上角的 X 按鈕即可關閉。

## 🎯 未來擴展

當基礎認證系統運作正常後，可以考慮加入：

1. **忘記密碼功能** - 使用 `supabase.auth.resetPasswordForEmail()`
2. **個人資料管理** - 顯示和編輯使用者資料
3. **儲存行程歷史** - 將生成的行程與使用者帳號綁定
4. **偏好設定** - 儲存使用者的旅遊偏好

## 📚 相關文件

- [Supabase Auth 文檔](https://supabase.com/docs/guides/auth)
- [Supabase Auth with React](https://supabase.com/docs/guides/auth/quickstarts/react)
