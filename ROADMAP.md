# **智慧旅遊 AI 專案 - 功能開發藍圖 (V2 - 聚焦使用者認證)**

## **1. 總覽 (Overview)**

本文件為專案功能開發的 V2 版本，旨在反映最新的開發策略。我們將優先實作一個核心的**使用者認證系統**，以此作為所有未來個人化功能（如偏好設定、行程歷史紀錄）的穩固基礎。此舉遵循 MVP (最小可行性產品) 原則，確保在擴展複雜功能前，核心架構的穩定與安全。

### **開發階段規劃 (Phased Rollout)**

| 階段 | 優先級 | 核心功能 | 狀態 | 目標 |
| :--- | :--- | :--- | :--- | :--- |
| **第一階段** | 🚀 **立刻開始 (Now)** | 1. **RAG 向量資料庫系統 (Supabase + Gemini)**<br>2. 視覺化路線地圖 (Google Maps)<br>3. 預算規劃與成本估算 | ✅ **已完成** | **提升 AI 準確性**，建立台灣旅遊景點知識庫，消除 LLM 幻覺問題。 |
| **第二階段** | 🎯 **下一步 (Next)** | 4. **核心使用者認證 (Core User Authentication)** | 🔄 **進行中** | **建立使用者系統地基**，讓應用程式具備身份識別能力。 |
| **第三階段** | ✨ **未來目標 (Future)** | 5. 協同規劃<br>6. AI 旅行日誌生成 | ⏳ **待開發** | 從個人工具擴展至社交應用，並將服務生命週期延伸至旅程結束後。 |

-----

## **2. 功能詳解 (Feature Specifications)**

### **✅ F-01: RAG 向量資料庫系統 (已完成 - Supabase + Gemini Embeddings)**

  * **狀態**: ✅ **已完成並部署** (2025-01-16)
  
  * **實作成果**:
      * ✅ Supabase pgvector 向量資料庫
      * ✅ 11,078 筆真實景點資料 (tourist_attractions)
      * ✅ 2,500+ 筆餐廳資料 (restaurants)
      * ✅ Gemini text-embedding-004 向量化 (768 維度)
      * ✅ 雙模式生成：純 AI vs RAG 增強
      * ✅ 語意搜尋與相似度匹配
      * ✅ Google Maps 整合 (評分、評論數、營業狀態)
  
  * **技術文檔**:
      * 📄 [RAG_INTEGRATION_COMPLETE.md](./RAG_INTEGRATION_COMPLETE.md) - 整合完成報告
      * 📄 [RAG_SUMMARY.md](./RAG_SUMMARY.md) - 技術總結
      * 📄 [RAG_VS_AI_COMPARISON.md](./RAG_VS_AI_COMPARISON.md) - 性能比較
      * 📄 [QUICK_START_RAG.md](./QUICK_START_RAG.md) - 快速入門指南

  * **使用者故事 (User Story):**

    > 作為一位使用者，我希望 AI 推薦的景點都是真實存在且準確的台灣景點，不會出現虛構或錯誤的地點名稱，也不會推薦已經歇業的店家。

  * **為什麼需要 RAG？**

      * **問題現狀：** LLM（如 Gemini）會產生「幻覺」，推薦不存在的景點或已歇業的店家。
      * **解決方案：** 使用 RAG（檢索增強生成）技術，讓 AI 從真實的景點資料庫中檢索資訊，而非憑空想像。
      * **技術選擇：** Supabase pgvector + Gemini Embeddings，成本低、易整合、支援向量搜尋。

  * **技術分解 (Technical Breakdown):**

      * **資料庫 (Supabase):**
          * **[任務]** 在 Supabase 啟用 `pgvector` 擴展功能。
          * **[任務]** 建立 `tourist_attractions` 資料表：
            ```sql
            CREATE TABLE tourist_attractions (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              name TEXT NOT NULL,
              category TEXT, -- 景點類型（自然景觀、文化古蹟、美食等）
              city TEXT NOT NULL, -- 縣市
              district TEXT, -- 區域
              address TEXT,
              description TEXT, -- 景點描述
              features JSONB, -- 特色標籤（適合親子、網美景點等）
              google_place_id TEXT, -- Google Place ID
              rating NUMERIC,
              price_level INTEGER,
              business_status TEXT, -- 營業狀態
              embedding VECTOR(1536), -- 向量嵌入（OpenAI text-embedding-3-small）
              metadata JSONB, -- 其他元資料
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            CREATE INDEX ON tourist_attractions USING ivfflat (embedding vector_cosine_ops);
            ```
          * **[任務]** 建立 `match_attractions` 函數用於向量相似度搜尋：
            ```sql
            CREATE OR REPLACE FUNCTION match_attractions(
              query_embedding VECTOR(1536),
              match_threshold FLOAT,
              match_count INT,
              filter_city TEXT DEFAULT NULL
            )
            RETURNS TABLE (
              id UUID,
              name TEXT,
              category TEXT,
              city TEXT,
              address TEXT,
              description TEXT,
              similarity FLOAT
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
              RETURN QUERY
              SELECT
                t.id,
                t.name,
                t.category,
                t.city,
                t.address,
                t.description,
                1 - (t.embedding <=> query_embedding) AS similarity
              FROM tourist_attractions t
              WHERE (filter_city IS NULL OR t.city = filter_city)
                AND 1 - (t.embedding <=> query_embedding) > match_threshold
              ORDER BY t.embedding <=> query_embedding
              LIMIT match_count;
            END;
            $$;
            ```

      * **資料收集與向量化：**
          * **[任務]** 建立資料收集腳本 `scripts/collect_attractions.js`：
              * 從 Google Places API 收集台灣各縣市的熱門景點資料。
              * 從政府開放資料平台（data.gov.tw）匯入觀光景點資料。
              * 整合交通部觀光署的景點資料。
          * **[任務]** 建立向量化腳本 `scripts/create_embeddings.js`：
              * 使用 OpenAI Embeddings API（`text-embedding-3-small`）生成向量。
              * 將景點名稱 + 描述 + 特色組合成文本進行向量化。
              * 批次寫入 Supabase。

      * **後端 (LangChain Integration):**
          * **[任務]** 安裝必要套件：
            ```bash
            npm install langchain @langchain/community @langchain/openai @supabase/supabase-js
            ```
          * **[任務]** 建立 `api/utils/ragRetriever.js`：
            ```javascript
            import { createClient } from '@supabase/supabase-js';
            import { OpenAIEmbeddings } from '@langchain/openai';
            import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

            const supabase = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_KEY
            );

            const embeddings = new OpenAIEmbeddings({
              openAIApiKey: process.env.OPENAI_API_KEY,
              modelName: 'text-embedding-3-small'
            });

            const vectorStore = new SupabaseVectorStore(embeddings, {
              client: supabase,
              tableName: 'tourist_attractions',
              queryName: 'match_attractions'
            });

            export async function retrieveRelevantAttractions(query, city, limit = 10) {
              const retriever = vectorStore.asRetriever({
                k: limit,
                filter: city ? { city } : undefined
              });
              
              const docs = await retriever.getRelevantDocuments(query);
              return docs.map(doc => doc.pageContent);
            }
            ```
          * **[任務]** 修改 `api/ask.js` 的 `buildPrompt` 函數：
            ```javascript
            async function buildPrompt(question, location, days, dates, weatherData) {
              // 使用 RAG 檢索相關景點
              const relevantAttractions = await retrieveRelevantAttractions(
                `${question} ${location}`,
                location,
                20 // 檢索前 20 個相關景點
              );

              let prompt = `你是一位台灣的專業旅遊行程設計師。

            用戶需求：${question}
            目的地：${location}
            天數：${days}天
            日期：${dates.join(', ')}

            === 可用的真實景點資料 ===
            以下是經過驗證的真實景點列表，請優先從這些景點中選擇：
            ${relevantAttractions.join('\n')}
            ===============================

            重要規則：
            1. 必須優先使用上述「可用的真實景點資料」中的地點。
            2. 地點名稱必須與資料庫中的名稱完全一致。
            3. 絕對不要虛構或猜測景點名稱。
            ...
            `;
              
              return prompt;
            }
            ```

      * **前端 (React):**
          * **[任務]** 在結果頁面顯示「資料來源：真實景點資料庫 ✓」標記。
          * **[任務]** 當景點來自 RAG 資料庫時，顯示更多詳細資訊（評分、營業狀態等）。

  * **實作階段：**

      * **階段 1 - 資料庫設置（第 1 週）：**
          * 設置 Supabase pgvector
          * 建立資料表和搜尋函數
      
      * **階段 2 - 資料收集（第 2-3 週）：**
          * 收集台灣 22 縣市的景點資料（目標：每縣市至少 100 個景點）
          * 生成向量嵌入並寫入資料庫
      
      * **階段 3 - RAG 整合（第 4 週）：**
          * 整合 LangChain 到後端
          * 修改 Prompt 使用檢索到的景點
      
      * **階段 4 - 測試優化（第 5 週）：**
          * A/B 測試比較有無 RAG 的準確度
          * 調整檢索參數（相似度閾值、檢索數量）

  * **成功指標 (Success Metrics):**

      * **準確性提升：** 虛構景點比例從 20-30% 降至 < 5%
      * **資料覆蓋：** 資料庫至少包含 2000+ 個真實台灣景點
      * **回應速度：** RAG 檢索延遲 < 500ms
      * **用戶滿意度：** 推薦景點的實用性評分提升 30%+

  * **預期效益：**

      * ✅ 消除 LLM 幻覺問題
      * ✅ 確保推薦景點都真實存在
      * ✅ 自動過濾已歇業店家
      * ✅ 提供更詳細的景點資訊（評分、價位、營業時間）
      * ✅ 支援語意搜尋（例如「適合親子的台中景點」）

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