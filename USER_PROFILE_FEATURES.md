# 使用者名稱顯示功能 - 實作說明

## ✅ 已完成的功能

### 1. **註冊時設定名字**
- 在註冊表單中加入「顯示名稱」欄位（**必填**）
- 名字欄位放在最前面，強調其重要性
- 所有必填欄位都有紅色星號 (*) 標記
- 名字會儲存在 Supabase 的 `user_metadata.display_name` 中

### 2. **Google 登入自動使用名字**
- 使用 Google 登入時，自動獲取 Google 帳號的全名
- 顯示在右上角，而不是 email
- 名字來自 `user_metadata.full_name`

### 3. **個人資料編輯**
- 新增 `ProfileEditor.jsx` 元件
- 點擊右上角的名字即可編輯個人資料
- 可以隨時修改顯示名稱
- 修改後立即生效

### 4. **智慧名稱顯示邏輯**
系統會按照以下優先順序顯示使用者名稱：
1. `user_metadata.display_name` - 使用者註冊或編輯時設定的名字
2. `user_metadata.full_name` - Google 登入提供的全名
3. Email 前綴 - 作為後備選項（僅用於舊帳號）
4. "使用者" - 最後的預設值

## 📁 相關檔案

### 新增檔案
- `react-app/src/components/ProfileEditor.jsx` - 個人資料編輯元件
- `react-app/src/components/ProfileEditor.css` - 個人資料編輯樣式

### 修改檔案
- `react-app/src/components/AuthForm.jsx` - 加入名字欄位
- `react-app/src/components/AuthForm.css` - 加入欄位提示樣式
- `react-app/src/App.jsx` - 加入名稱顯示和編輯功能
- `react-app/src/App.css` - 更新使用者名稱樣式

## 🎨 使用者體驗

### 註冊流程
1. 使用者點擊「登入 / 註冊」
2. 切換到「註冊」頁籤
3. **第一個欄位是「顯示名稱」，必須填寫**
4. 看到紅色星號 (*) 標記表示必填
5. 輸入名字、email 和密碼
6. 完成註冊

### Google 登入流程
1. 使用者點擊「使用 Google 登入」
2. 完成 Google 授權
3. 自動使用 Google 帳號的名字
4. 顯示在右上角

### 編輯名字流程
1. 使用者點擊右上角的名字
2. 彈出「編輯個人資料」視窗
3. 修改顯示名稱
4. 點擊「儲存變更」
5. 名字立即更新

## 💡 技術實作細節

### 1. 註冊時儲存名字
```javascript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: displayName, // 必填欄位
    }
  }
})
```

### 2. 更新使用者資料
```javascript
const { data, error } = await supabase.auth.updateUser({
  data: {
    display_name: displayName
  }
})
```

### 3. 取得顯示名稱
```javascript
const getUserDisplayName = () => {
  if (!session?.user) return '';
  
  // 優先使用自訂名字
  if (session.user.user_metadata?.display_name) {
    return session.user.user_metadata.display_name;
  }
  
  // Google 登入的全名
  if (session.user.user_metadata?.full_name) {
    return session.user.user_metadata.full_name;
  }
  
  // 使用 email 前綴
  if (session.user.email) {
    return session.user.email.split('@')[0];
  }
  
  return '使用者';
};
```

## 🔒 資料儲存位置

使用者名稱儲存在 Supabase Auth 的 `user_metadata` 中：

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "user_metadata": {
      "display_name": "使用者設定的名字",
      "full_name": "Google 提供的全名"
    }
  }
}
```

## 🎯 優點

1. **強制個人化** - 所有使用者註冊時必須提供名字
2. **更好的體驗** - 使用者從一開始就有個人化的稱呼
3. **清楚的 UI** - 必填欄位有紅色星號標記
4. **Google 整合** - 自動使用 Google 名字
5. **隨時編輯** - 點擊即可修改
6. **智慧後備** - 對於舊帳號仍有 email 前綴作為後備

## 📱 UI/UX 特點

- ✅ 註冊時的名字欄位為**必填**，有紅色星號標記
- ✅ 名字欄位放在第一位，強調其重要性
- ✅ 所有必填欄位都有統一的 (*) 標記
- ✅ 清楚的提示文字：「此名字將顯示在您的個人資料中」
- ✅ 右上角的名字可點擊，有懸停效果
- ✅ 編輯視窗與登入視窗風格一致
- ✅ 修改後立即反映在 UI 上
- ✅ Google 登入自動顯示完整名字

## 🧪 測試建議

1. **Email 註冊時必須填寫名字** - 嘗試不填名字提交，應該顯示驗證錯誤
2. **填寫名字後註冊** - 確認顯示正確
3. **Google 登入** - 確認顯示 Google 名字
4. **編輯個人資料** - 確認可以修改且立即生效
5. **重新登入** - 確認名字有被保存

## 🚀 未來擴展建議

1. **上傳頭像** - 在個人資料中加入頭像上傳功能
2. **更多個人資訊** - 電話、地址等
3. **旅遊偏好** - 喜歡的景點類型、預算範圍等
4. **行程歷史** - 顯示過去生成的行程
5. **社交功能** - 好友系統、分享行程
