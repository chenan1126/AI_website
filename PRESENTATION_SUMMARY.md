# AI 旅遊行程規劃 — 簡報摘要

（1 頁式 PPT 內容，簡短、重點式）

---

## 專題宗旨
用 AI 與檢索增強（RAG）自動生成客製化旅遊行程，提供即時串流回饋與可視化日程，讓使用者以最少的手動操作得到高品質行程建議。

## 核心亮點
- 即時串流回應（SSE）：逐步反饋解析、天氣、生成、結果，提升使用者等待體驗
- RAG（Retrieval-Augmented Generation）：結合向量檢索與 LLM，降低幻覺、提高資訊可靠度
- 完整 UI：Landing Page（影片背景）、Planner（表單 + 結果）、響應式設計
- 使用 Supabase 做認證與資料儲存，支援向量搜尋（pgvector）

## 技術架構（簡報用視覺化）

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                   使用者                                            │
│                                     ↓                                               │
└────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐          ┌─────────────────────────────────────┐
│          前端層 (UI)             │          │        後端層 (API/Logic)            │
├─────────────────────────────────┤          ├─────────────────────────────────────┤
│  • React 19 + Vite              │  ←────→  │  • Vercel Serverless Functions      │
│  • Tailwind CSS (CDN)           │          │  • Server-Sent Events (SSE)         │
│  • React Router                 │          │  • 問題解析 & 意圖識別              │
│                                 │          │  • 天氣資料獲取                     │
│  頁面組件:                       │          │  • RAG 檢索器 (ragRetriever)        │
│  ├─ HomePage (Landing)          │          │  • 地理優化器 (geoOptimizer)        │
│  ├─ PlannerPage (行程規劃)      │          └─────────────────────────────────────┘
│  ├─ TripResults (結果展示)      │                          ↓
│  ├─ AuthForm (登入/註冊)        │          ┌─────────────────────────────────────┐
│  └─ Header (導航列)             │          │         AI 服務層                    │
└─────────────────────────────────┘          ├─────────────────────────────────────┤
                                              │  • OpenAI GPT-4 / GPT-3.5           │
                                              │  • 自然語言理解 (NLU)               │
                                              │  • 行程生成 (JSON Mode)             │
                                              │  • RAG 上下文增強                   │
                                              └─────────────────────────────────────┘
                                                             ↓
                                              ┌─────────────────────────────────────┐
                                              │      資料儲存層 (Database)           │
                                              ├─────────────────────────────────────┤
                                              │  • Supabase (PostgreSQL)            │
                                              │  • 使用者認證 (Auth)                │
                                              │  • 景點/餐廳資料表                  │
                                              │  • 向量搜尋 (pgvector)              │
                                              └─────────────────────────────────────┘
```

**核心技術棧**：
- **前端**：React 19 + Vite + Tailwind CSS v4 (PostCSS) + React Router
- **後端**：Vercel Serverless + Node.js + SSE 串流
- **AI**：OpenAI API + RAG (Retrieval-Augmented Generation)
- **資料庫**：Supabase (PostgreSQL + pgvector 向量擴充)

## 已完成（Demo 可展示）
1. 首頁：影片 Hero、透明 Header、CTA
2. 規劃表單：範例提示、生成按鈕、狀態回饋
3. 串流 & API：`/api/ask` 串流事件 (parsing, weather, generation, result)
4. 使用者系統：登入/註冊、Profile 編輯
5. RAG 與工具模組：向量檢索、geoOptimizer

## 近期/未來計畫（簡短）
- 日程標籤頁 + 時間軸視圖（優先）
- 行程儲存/分享功能
- 協作編輯與多人規劃
- AI 個人化推薦（學習使用者偏好）

## Demo 操作指引（2 分鐘）
1. 啟動 frontend：

```powershell
cd d:\大學專題\AI_website\react-app
npm install
npm run dev
```

2. 啟動後端（若本地）:

```powershell
# 在專案根目錄或 api 資料夾啟動 Node server
cd d:\大學專題\AI_website\api
node server.js # 或你們的啟動指令
```

3. 打開瀏覽器至 `http://localhost:5174`，點擊「開始規劃」，輸入範例或自訂需求，等待串流回饋並檢視結果。

---

如需我把這份摘要轉成 PPT 範本（PowerPoint 或 Google Slides），我可以幫您生成 5 張的簡報大綱與每張的要點。