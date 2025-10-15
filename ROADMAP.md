# **智慧旅遊 AI 專案 - 功能開發藍圖 (V2 - 聚焦使用者認證)**

## **1. 總覽 (Overview)**

本文件為專案功能開發的 V2 版本，旨在反映最新的開發策略。我們將優先實作一個核心的**使用者認證系統**，以此作為所有未來個人化功能（如偏好設定、行程歷史紀錄）的穩固基礎。此舉遵循 MVP (最小可行性產品) 原則，確保在擴展複雜功能前，核心架構的穩定與安全。

### **開發階段規劃 (Phased Rollout)**

| 階段 | 優先級 | 核心功能 | 狀態 |
| :--- | :--- | :--- | :--- |
| **第一階段** | ✅ **已完成 (Done)** | 1. **RAG 向量資料庫系統 (Supabase + Gemini Embeddings)** | ✅ 已完成！建立了 11,078+ 台灣景點資料庫，使用 Gemini Embeddings，支援語意搜尋與雙模式生成（純 AI vs RAG）。 |
| **第二階段** | 🚀 **進行中 (In Progress)** | 2. **視覺化路線地圖**<br>3. 預算規劃與成本估算 | **當前目標**：實作互動式地圖顯示行程路線與景點位置，提升用戶體驗。 |
| **第三階段** | 🎯 **下一步 (Next)** | 4. **核心使用者認證 (Core User Authentication)** | **建立使用者系統地基**，讓應用程式具備身份識別能力，為儲存歷史行程做準備。 |
| **第四階段** | ✨ **未來目標 (Future)** | 5. 協同規劃<br>6. AI 旅行日誌生成 | 從個人工具擴展至社交應用，並將服務生命週期延伸至旅程結束後。 |

-----

## **2. 功能詳解 (Feature Specifications)**

### **✅ F-01: RAG 向量資料庫系統 (已完成 - Completed)**

  * **使用者故事 (User Story):**

    > 作為一位使用者，我希望 AI 推薦的景點都是真實存在且準確的台灣景點，不會出現虛構或錯誤的地點名稱，也不會推薦已經歇業的店家。

  * **實作成果 (Implementation Results):**

      * ✅ **資料庫完成：** 建立了 Supabase pgvector 資料庫，包含 11,078+ 筆台灣真實景點資料
      * ✅ **向量化完成：** 使用 Google Gemini Embeddings API (`text-embedding-004`) 生成 768 維向量
      * ✅ **RAG 整合完成：** 整合到 `api/ask.js`，支援語意搜尋與智能景點匹配
      * ✅ **雙模式生成：** 實作「純 AI」vs「RAG 增強」雙模式，讓使用者可以比較差異
      * ✅ **城市變體處理：** 解決台/臺、台北/臺北等城市名稱變體問題
      * ✅ **資料清理：** 修正景點名稱中的底線、空格等格式問題

  * **技術架構：**

      * **資料庫：** Supabase PostgreSQL + pgvector 擴展
      * **向量模型：** Google Gemini `text-embedding-004` (768 dimensions)
      * **搜尋函數：** `match_attractions_by_city()` - 支援城市過濾的向量相似度搜尋
      * **資料來源：** 政府開放資料平台的台灣景點與餐廳資料
      * **匯入工具：** `scripts/import_data_to_supabase.js` - 支援景點與餐廳批次匯入

  * **成功指標 (已達成):**

      * ✅ 虛構景點比例：從 20-30% 降至 < 5%
      * ✅ 資料覆蓋：11,078+ 個真實台灣景點
      * ✅ 回應速度：RAG 檢索延遲 < 500ms
      * ✅ 用戶體驗：雙模式讓使用者可以直接比較 RAG 的效果

-----

### **🚀 F-02: 視覺化路線地圖 (Visual Route Map)**

  * **使用者故事 (User Story):**

    > 作為一位使用者，當我審視 AI 生成的行程時，我希望能同時在一個互動式地圖上看到所有景點的地理位置與規劃路線，以便我能直觀地判斷行程的流暢度與合理性。

  * **技術分解 (Technical Breakdown):**

      * **前端 (React):**
          * **[任務]** 引入地圖函式庫，推薦 `react-leaflet` 或 `@vis.gl/react-google-maps`。
          * **[任務]** 改造 UI 佈局，採用「左側行程列表，右側地圖」的雙欄式設計。
          * **[任務]** 修改狀態管理邏輯，在接收到後端串流數據時，同步更新地圖上的標記點 (Marker) 與路線。
          * **[任務]** 實作地圖與列表的互動（例如滑鼠懸停高亮效果）。
      * **後端 (Serverless Function):**
          * **[確認]** 確保回傳的行程物件中，每個地點都包含精確的 `latitude` 和 `longitude` 欄位。

  * **成功指標 (Success Metrics):**

      * 使用者可以在行程結果頁面看到地圖，並且行程中的所有地點都有對應的標記點。
      * 地圖上會根據每日的行程順序，繪製出路線。

-----

### **🚀 F-03: 預算規劃與成本估算 (Budget Planning)**

  * **使用者故事 (User Story):**

    > 作為一位有預算考量的使用者，我希望在規劃行程時能設定我的預算等級，並讓 AI 告訴我這趟行程的預估總花費，以便我能更好地控制開銷。

  * **技術分解 (Technical Breakdown):**

      * **資料庫 (Supabase):**
          * **[任務]** 修改 `locations` 資料表，新增 `price_level` (INTEGER) 和 `estimated_cost` (NUMERIC) 欄位。
          * **[任務]** 為現有資料回填這兩個欄位的值。
      * **前端 (React):**
          * **[任務]** 在輸入表單中，新增「預算選擇」元件。
          * **[任務]** 在結果顯示區塊，新增「預估總花費」欄位。
      * **後端 (Serverless Function):**
          * **[任務]** `handler` 函式需接收新的 `budget` 參數。
          * **[任務]** 在 Prompt Template 中加入新指令，要求 LLM 根據 `estimated_cost` 進行加總與回報。

  * **成功指標 (Success Metrics):**

      * 使用者可以選擇預算等級，且 AI 生成的行程會反映此選擇。
      * 最終的行程規劃中，會包含清晰的費用估算。

-----

### **🎯 F-04: 核心使用者認證 (Core User Authentication)**

  * **使用者故事 (User Story):**

    > 作為一位使用者，我希望能創建一個帳號並登入，以便系統能識別我的身份，為未來儲存我的行程歷史與個人偏好做好準備。

  * **技術分解 (Technical Breakdown):**

      * **後端 (Supabase):**
          * **[任務]** 在 Supabase 後台的 **Authentication -\> Providers** 區塊，啟用 **Email** 供應商。
      * **前端 (React):**
          * **[任務]** 安裝 Supabase Auth 相關套件：`@supabase/auth-ui-react`, `@supabase/auth-ui-shared`。
          * **[任務]** 建立 `src/supabaseClient.js` 檔案，用於初始化並導出 Supabase 客戶端實例。
          * **[任務]** 修改 `App.jsx` 主元件，使用 `useEffect` 搭配 `supabase.auth.onAuthStateChange` 來監聽並管理使用者的登入狀態 (`session`)。
          * **[任務]** 實作條件渲染邏輯：
              * 如果使用者**未登入** (`session` 為 `null`)，則顯示 Supabase 官方提供的 `<Auth>` 登入/註冊元件。
              * 如果使用者**已登入**，則顯示原本的行程規劃主介面，並在頁首顯示使用者 email 及登出按鈕。
          * **[任務]** 確保環境變數 (`.env.local`) 中的 Supabase URL 和 Key 已加上 `VITE_` 前綴。

  * **成功指標 (Success Metrics):**

      * 使用者可以透過 Email 和密碼成功註冊新帳號。
      * 使用者可以成功登入與登出。
      * 應用程式的介面會根據使用者的登入狀態，正確地顯示登入頁面或主應用程式頁面。

-----

### **✨ F-05: 協同規劃 (Collaborative Planning)**

  * **使用者故事 (User Story):**

    > 作為一位與朋友共同規劃旅行的使用者，我希望能分享一個行程連結給我的旅伴，讓我們可以同時查看甚至共同編輯這份行程。

  * **技術分解 (Technical Breakdown):**

      * **資料庫 (Supabase):**
          * **[任務]** 需重新設計資料庫結構，建立 `itineraries` 表和 `itinerary_collaborators` 中間表來管理權限。
      * **前端 (React):**
          * **[任務]** 在行程頁面加入「分享」按鈕。
          * **[任務]** 引入 Supabase Realtime SDK，訂閱當前行程的變更。

  * **成功指標 (Success Metrics):**

      * 行程可以被分享給其他使用者。
      * 多個使用者可以同時查看同一份行程。

-----

### **✨ F-06: AI 旅行日誌生成 (AI Travel Journal)**

  * **使用者故事 (User Story):**

    > 在旅程結束後，我希望能輕鬆地將我的照片和一些心情筆記，與原有的行程結合，讓 AI 自動幫我生成一篇圖文並茂的旅行日誌草稿。

  * **技術分解 (Technical Breakdown):**

      * **儲存 (Supabase Storage):**
          * **[任務]** 設定 Supabase Storage，用來儲存使用者上傳的照片。
      * **前端 (React):**
          * **[任務]** 提供「生成日誌」的介面，並實作照片上傳功能。
      * **後端 (Serverless Function):**
          * **[任務]** 建立新的 API 端點 `api/generateJournal`，用來處理日誌生成任務。

  * **成功指標 (Success Metrics):**

      * 使用者可以為已完成的行程上傳照片和筆記。
      * 系統能生成一篇包含使用者內容的、有故事性的日誌。