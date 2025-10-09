# Python 後端至 Node.js 遷移計畫

本文件闡述了將 Vercel Serverless Function 後端從 Python 遷移至 Node.js (JavaScript) 的詳細步驟。

## 🚀 計畫

### 步驟 1：設定 Node.js 環境與初始檔案

- **動作：** 建立 `api/ask.js` 作為新的進入點。
- **動作：** 建立 `api/_utils.js` 用於存放輔助函式。
- **動作：** 安裝必要的 npm 套件：
  - `@google/generative-ai`：用於與 Gemini API 互動。
- **驗證：** 確保基本檔案已建立，且依賴項已加入 `package.json`。

### 步驟 2：移植輔助函式

- **動作：** 將 `_utils.py` 中的解析函式 (`parse_trip_days`, `extract_city_name`, `calculate_trip_dates`) 轉換為 JavaScript，並放入 `_utils.js`。
- **動作：** 使用 `fetch` 在 `_utils.js` 中重新實現天氣和 Google Maps API 的呼叫 (`get_multi_day_weather_sync`, `get_place_details_sync`, `calculate_route_distance_and_time_sync`)。
- **驗證：** 獨立測試每個輔助函式，確保其正確性。

### 步驟 3：在 `ask.js` 中實現核心 API 邏輯

- **動作：** 重新實現 `ask.py` 中的主要請求處理邏輯。
- **動作：** 在 Node.js 中實現 Server-Sent Events (SSE) 串流，以符合原始 Python 實現。
- **動作：** 整合從 `_utils.js` 移植過來的輔助函式。
- **動作：** 使用 `@google/generative-ai` 函式庫建構 Gemini 提示詞並進行 API 呼叫。
- **動作：** 處理 Gemini 的回應，使用地圖資料豐富化內容，並計算旅遊統計數據。
- **驗證：** `api/ask.js` 端點應能處理 POST 請求並以串流方式回傳 SSE 事件。

### 步驟 4：本地測試

- **動作：** 使用 `vercel dev` 在本地運行新的 Node.js 後端。
- **動作：** 使用前端進行完整的端到端測試，確保兩個行程都能正確生成且所有資料都已顯示。
- **驗證：** 應用程式應能以 JavaScript 後端完全正常運作。

### 步驟 5：清理

- **動作：** 在確認 Node.js 後端運作正常後，刪除舊的 Python 檔案：
  - `api/ask.py`
  - `api/_utils.py`
  - `api/__pycache__/`
- **動作：** 從 `requirements.txt` 中移除 Python 相關的依賴項，或如果不再需要該檔案則直接刪除。
- **驗證：** 專案現在完全運行在 JavaScript/Node.js 技術棧上。

