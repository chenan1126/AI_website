# 🌏 智慧旅遊 AI 行程規劃系統

使用 AI 和 RAG 技術打造的台灣旅遊行程規劃系統，提供個人化的旅遊建議。

## ✨ 核心功能

### 🎯 智能行程規劃
- **雙模式生成**：純 AI 模式 vs RAG 增強模式
- **真實景點資料**：11,078 個景點 + 2,500+ 間餐廳
- **智能評分系統**：Wilson 信賴區間評分 + Google Maps 評價
- **天氣整合**：中央氣象署 API 即時天氣預報
- **地理優化**：K-Means 聚類自動分組，最短路徑排序

### 🗺️ 地圖視覺化
- **Google Maps 整合**：互動式地圖顯示
- **景點標記**：多天行程顏色編碼
- **路線規劃**：自動計算距離與時間
- **交通模式**：智能判斷開車/大眾運輸

### 🎨 用戶體驗
- **響應式設計**：適配各種螢幕尺寸
- **即時串流**：SSE 即時顯示生成進度
- **方案比較**：並排比較兩種生成模式

## 🚀 快速開始

### 環境需求
- Node.js 18+
- npm 或 yarn
- Supabase 帳號
- Google API Keys (Gemini + Maps)

### 安裝步驟

1. **克隆專案**
```bash
git clone https://github.com/chenan1126/AI_website.git
cd AI_website
```

2. **安裝依賴**
```bash
# 安裝後端依賴
npm install

# 安裝前端依賴
cd react-app
npm install
cd ..
```

3. **設定環境變數**

複製 `.env.example` 為 `.env`：
```bash
cp .env.example .env
```

編輯 `.env` 填入您的 API Keys：
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
CWA_API_KEY=your_cwa_api_key_here
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
```

4. **設定資料庫**

參考 [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md) 設置 Supabase：
- 啟用 pgvector 擴展
- 執行 SQL 腳本建立資料表
- 匯入景點和餐廳資料

5. **啟動開發伺服器**

**方法一：使用啟動腳本**
```powershell
# Windows PowerShell
.\start-local-dev.ps1

# 或使用批次檔
.\start-local-dev.bat
```

**方法二：手動啟動**
```bash
# 終端機 1 - 啟動後端
npm run dev

# 終端機 2 - 啟動前端
cd react-app
npm run dev
```

6. **開啟瀏覽器**
```
前端: http://localhost:5173
後端: http://localhost:3000
```

## 📁 專案結構

```
AI_website/
├── api/                          # Serverless Functions (Vercel)
│   ├── ask.js                    # 主要 API 端點
│   ├── _utils.js                 # 工具函數
│   └── utils/
│       └── ragRetriever.js       # RAG 檢索邏輯
│
├── react-app/                    # 前端 React 應用
│   ├── src/
│   │   ├── App.jsx               # 主應用組件
│   │   └── components/
│   │       ├── MapView.jsx       # Google Maps 地圖
│   │       ├── TripResults.jsx   # 行程結果顯示
│   │       └── WeatherCard.jsx   # 天氣卡片
│   └── package.json
│
├── data/                         # 原始資料
│   ├── all_spot.csv              # 11,078 筆景點資料
│   └── allRestaurant.csv         # 2,500+ 筆餐廳資料
│
├── scripts/                      # 資料處理腳本
│   └── import_data_to_supabase.js # 資料匯入工具
│
├── supabase/                     # Supabase SQL 腳本
│   ├── 01_enable_extensions.sql
│   ├── 02_create_attractions_table.sql
│   └── 03_create_search_function.sql
│
├── .env.example                  # 環境變數範本
├── README.md                     # 本文件
├── ROADMAP.md                    # 開發藍圖
├── RAG_SUMMARY.md                # RAG 技術文檔
├── SUPABASE_SETUP_GUIDE.md       # 資料庫設置指南
└── VERCEL_ENV_SETUP.md           # 部署指南
```

## �️ 技術棧

### 後端
- **運行環境**: Vercel Serverless Functions
- **語言**: Node.js (ES Modules)
- **AI 模型**: Google Gemini 2.0 Flash
- **向量搜尋**: Supabase pgvector + Gemini Embeddings
- **API 整合**: Google Maps, 中央氣象署

### 前端
- **框架**: React 18 + Vite
- **地圖**: Google Maps API (`@vis.gl/react-google-maps`)
- **樣式**: CSS Modules
- **狀態管理**: React Hooks

### 資料庫
- **服務**: Supabase (PostgreSQL)
- **向量搜尋**: pgvector 擴展
- **資料表**: tourist_attractions, restaurants

## 📊 功能亮點

### RAG 向量資料庫系統
- ✅ **11,078 個真實景點**：涵蓋台灣 22 縣市
- ✅ **2,500+ 間餐廳**：Google Maps 驗證資料
- ✅ **向量語意搜尋**：Gemini text-embedding-004
- ✅ **多維度匹配**：地點、類型、特色、評價
- ✅ **地理聚類優化**：K-Means 演算法自動分組景點
- ✅ **最短路徑排序**：貪婪最近鄰演算法優化行程順序

### 智能交通規劃
- ✅ **自動模式檢測**：開車 vs 大眾運輸
- ✅ **精準距離計算**：Google Maps Directions API
- ✅ **時間估算**：考慮交通狀況
- ✅ **路線優化**：減少旅行時間佔比
- ✅ **地理約束**：每日行程範圍不超過 30 公里

### 評分機制
- **Wilson 信賴區間**：統計學上更準確的評分
- **旅行時間懲罰**：超過 25% 旅行時間自動降分
- **Google Maps 評價**：整合真實用戶評論

## 🌐 部署

### Vercel 部署

1. **推送到 GitHub**
```bash
git push origin main
```

2. **連接 Vercel**
- 前往 [Vercel Dashboard](https://vercel.com/dashboard)
- Import GitHub Repository
- 選擇 `AI_website` 專案

3. **設定環境變數**

參考 [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md) 在 Vercel 設定以下變數：
```
GEMINI_API_KEY
GOOGLE_MAPS_API_KEY
CWA_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

4. **部署**
- Vercel 會自動偵測 `react-app` 目錄
- 自動部署後端 API 到 `/api/*`

## 📚 文檔

- [開發藍圖 (ROADMAP.md)](./ROADMAP.md) - 功能規劃與開發進度
- [RAG 技術文檔 (RAG_SUMMARY.md)](./RAG_SUMMARY.md) - RAG 系統詳細說明
- [Supabase 設置 (SUPABASE_SETUP_GUIDE.md)](./SUPABASE_SETUP_GUIDE.md) - 資料庫設置教學
- [Vercel 部署 (VERCEL_ENV_SETUP.md)](./VERCEL_ENV_SETUP.md) - 部署配置指南

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## � 授權

MIT License

## 👥 團隊

大學專題開發團隊

---

**最後更新**: 2025-01-16
**版本**: v2.0.0 (RAG 系統完成)
