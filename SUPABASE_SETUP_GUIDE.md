# 📘 Supabase 完整設定教學

## 🎯 目標

設定 Supabase PostgreSQL 資料庫，建立向量搜尋功能，用於 RAG 系統。

---

## 📋 步驟總覽

1. ✅ 登入 Supabase（您已完成）
2. 🔧 在 SQL Editor 執行 3 個腳本
3. ✅ 驗證資料表建立成功
4. 🚀 準備導入資料

**預計時間**：5-10 分鐘

---

## 🔧 詳細步驟

### 步驟 1: 開啟 Supabase SQL Editor

1. 前往 https://app.supabase.com/
2. 點選您的專案：`hrpfgpvjxrwinpsgofoh`
3. 在左側選單找到 **SQL Editor** 圖示（看起來像 `</>`）
4. 點擊進入 SQL Editor

---

### 步驟 2: 執行第一個腳本 - 啟用擴展

#### 2.1 建立新查詢

- 點擊右上角 **+ New query** 按鈕
- 或使用快捷鍵 `Ctrl + Enter`

#### 2.2 複製並貼上腳本

打開專案中的 `supabase/01_enable_extensions.sql`，內容如下：

```sql
-- ================================================
-- Step 1: 啟用必要的 PostgreSQL 擴展
-- ================================================
-- 在 Supabase SQL Editor 中執行此腳本

-- 啟用 UUID 生成擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 啟用向量資料庫擴展 (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 驗證擴展是否安裝成功
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');

-- 如果看到兩行結果，表示擴展安裝成功 ✓
```

#### 2.3 執行腳本

- 點擊右下角 **Run** 按鈕（或按 `Ctrl + Enter`）
- 等待執行完成

#### 2.4 檢查結果

**成功的結果應該顯示**：

```
Success. No rows returned
```

或在下方看到查詢結果表格，顯示兩個擴展：
- `uuid-ossp`
- `vector`

✅ **如果看到這些，表示第一步完成！**

---

### 步驟 3: 執行第二個腳本 - 建立資料表

#### 3.1 建立新查詢

- 再次點擊 **+ New query**

#### 3.2 複製並貼上腳本

打開 `supabase/02_create_attractions_table.sql`，**完整內容**貼到 SQL Editor。

> 💡 提示：這個腳本會建立 `tourist_attractions` 資料表，包含：
> - 基本資訊欄位（名稱、地址、描述等）
> - Google Places 資料欄位
> - **768 維度的向量欄位**（用於 AI 搜尋）

#### 3.3 執行腳本

- 點擊 **Run** 按鈕

#### 3.4 檢查結果

成功後，您應該看到：

```
Success. No rows returned
```

最後會顯示資料表的所有欄位清單：

| table_name | column_name | data_type |
|------------|-------------|-----------|
| tourist_attractions | id | uuid |
| tourist_attractions | name | text |
| tourist_attractions | category | text |
| tourist_attractions | city | text |
| ... | ... | ... |
| tourist_attractions | embedding | USER-DEFINED |

✅ **如果看到 `embedding` 欄位（USER-DEFINED 類型），表示向量欄位建立成功！**

---

### 步驟 4: 執行第三個腳本 - 建立搜尋函數

#### 4.1 建立新查詢

- 點擊 **+ New query**

#### 4.2 複製並貼上腳本

打開 `supabase/03_create_search_function.sql`，**完整內容**貼到 SQL Editor。

> 💡 提示：這個函數 `match_attractions()` 用於：
> - 接收查詢向量（768 維度）
> - 計算與資料庫中所有景點的相似度
> - 返回最相似的景點

#### 4.3 執行腳本

- 點擊 **Run** 按鈕

#### 4.4 檢查結果

成功後會顯示：

```
Success. No rows returned
```

然後在最後看到測試查詢的結果（空表格，因為還沒有資料）。

✅ **如果沒有錯誤訊息，表示函數建立成功！**

---

## ✅ 驗證所有設定

### 在 Table Editor 檢查

1. 點擊左側選單的 **Table Editor** 圖示（表格圖示）
2. 您應該看到一個新的表：`tourist_attractions`
3. 點擊該表，應該看到空的資料表（還沒有資料）

### 在 SQL Editor 執行驗證查詢

建立新查詢，執行：

```sql
-- 檢查資料表結構
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tourist_attractions'
ORDER BY ordinal_position;

-- 檢查函數是否存在
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'match_attractions';

-- 檢查索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tourist_attractions';
```

**預期結果**：
- ✅ 第一個查詢：顯示所有欄位（包括 `embedding`）
- ✅ 第二個查詢：顯示 `match_attractions` 函數
- ✅ 第三個查詢：顯示 5-6 個索引（包括向量索引 `idx_attractions_embedding`）

---

## 🎉 完成！

如果以上都成功，您的 Supabase 資料庫已經準備好了！

### 接下來可以：

1. **導入資料**：
   ```powershell
   # 測試導入餐廳資料
   node scripts/import_data_to_supabase.js restaurants
   
   # 導入全部資料
   node scripts/import_data_to_supabase.js all
   ```

2. **預期結果**：
   - 約 40-60 分鐘完成導入
   - 10,000+ 筆景點和餐廳資料
   - 每筆資料都有 768 維度的向量

---

## ❌ 常見錯誤處理

### 錯誤 1: `extension "vector" does not exist`

**原因**：Supabase 專案未啟用 pgvector

**解決方法**：
1. 確認您使用的是 Supabase（不是自架的 PostgreSQL）
2. Supabase 應該預設支援 pgvector
3. 如果還是失敗，聯繫 Supabase 支援

### 錯誤 2: `permission denied`

**原因**：使用的 API Key 權限不足

**解決方法**：
- 確認您在 SQL Editor 中是以專案擁有者身份登入
- SQL Editor 會自動使用正確的權限

### 錯誤 3: `table already exists`

**原因**：之前已經建立過資料表

**解決方法**：
```sql
-- 刪除舊的資料表（⚠️ 會刪除所有資料）
DROP TABLE IF EXISTS tourist_attractions CASCADE;

-- 然後重新執行步驟 3 的腳本
```

### 錯誤 4: 向量索引建立失敗

**錯誤訊息**：`lists must be at least 1`

**原因**：資料表是空的，無法建立 IVFFlat 索引

**解決方法**：
- 這是正常的！索引會在有資料後自動建立
- 或者暫時註解掉 `CREATE INDEX idx_attractions_embedding` 那行
- 等資料導入後再執行：
  ```sql
  CREATE INDEX idx_attractions_embedding ON tourist_attractions 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
  ```

---

## 🆘 需要幫助？

如果遇到任何問題：

1. **截圖錯誤訊息**給我看
2. **複製完整的錯誤訊息**給我
3. 我會協助您解決！

---

## 📚 參考資料

- [Supabase Vector 官方文件](https://supabase.com/docs/guides/ai/vector-columns)
- [pgvector 使用指南](https://github.com/pgvector/pgvector)
- [Gemini Embedding API 文件](https://ai.google.dev/api/embeddings)

