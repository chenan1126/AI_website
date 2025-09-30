# AI 旅遊行程規劃系統

一個基於 Google Gemini AI 的智慧旅遊行程規劃應用，提供個人化的台灣旅遊建議。

## 🌟 功能特色

- 🤖 **AI 智慧規劃**：使用 Google Gemini AI 生成個人化行程
- 🌤️ **天氣整合**：自動獲取目的地天氣資訊並調整行程建議
- 🗺️ **地點資訊**：整合 Google Maps 提供景點詳細資訊和評價
- 📱 **響應式設計**：支援桌面和行動裝置
- 🎯 **多天行程**：支援1-4天的行程規劃
- 🚫 **智慧過濾**：自動避免無意義的行程項目

## 🚀 線上演示

訪問 [GitHub Pages 演示版本](https://chenan1126.github.io/AI_website/) 來查看介面設計。

> **注意**：GitHub Pages 版本僅供展示介面，無法使用完整的AI功能。如需體驗完整功能，請按照以下步驟本地部署。

## 📋 本地部署指南

### 環境需求

- Python 3.8+
- Node.js (可選，用於前端開發)

### 1. 下載專案

```bash
git clone https://github.com/chenan1126/AI_website.git
cd AI_website
```

### 2. 安裝 Python 依賴

```bash
# 創建虛擬環境（推薦）
python -m venv venv
venv\Scripts\activate  # Windows
# 或 source venv/bin/activate  # macOS/Linux

# 安裝依賴
pip install -r requirements.txt
```

### 3. 設置環境變數

創建 `.env` 文件並添加以下 API 金鑰：

```env
GEMINI_API_KEY=你的_Gemini_API_金鑰
GOOGLE_MAPS_API_KEY=你的_Google_Maps_API_金鑰
OPENWEATHERMAP_API_KEY=你的_OpenWeather_API_金鑰
```

#### 如何獲取 API 金鑰

1. **Google Gemini API**：
   - 訪問 [Google AI Studio](https://makersuite.google.com/app/apikey)
   - 創建新的 API 金鑰

2. **Google Maps API**：
   - 訪問 [Google Cloud Console](https://console.cloud.google.com/)
   - 啟用 Maps JavaScript API 和 Places API
   - 創建 API 金鑰

3. **OpenWeatherMap API**：
   - 訪問 [OpenWeatherMap](https://openweathermap.org/api)
   - 註冊帳號並獲取 API 金鑰

### 4. 運行應用

```bash
# 啟動後端服務器
python backend/app.py

# 開啟瀏覽器訪問
# http://localhost:5000
```

## 📖 使用說明

1. **輸入需求**：在文字框中描述您的旅遊需求
   - 例如："這個週末想去台南玩三天"
   - 包含目的地、時間、人數等資訊

2. **AI 分析**：系統會自動分析您的需求並提取關鍵資訊

3. **生成行程**：AI 會根據天氣、地點資訊生成個人化行程

4. **查看結果**：系統會顯示完整的行程規劃，包含：
   - 詳細的時間安排
   - 景點介紹和建議
   - 天氣資訊
   - 交通距離估計

## 🏗️ 專案結構

```
AI_website/
├── backend/
│   ├── app.py          # 主應用程式
│   ├── weather.py      # 天氣API整合
│   └── __pycache__/
├── frontend/
│   ├── index.html      # 主頁面
│   ├── app.js          # 前端邏輯
│   └── styles.css      # 樣式表
├── requirements.txt    # Python 依賴
├── .env               # 環境變數（需自行創建）
└── README.md          # 說明文件
```

## 🔧 技術棧

### 後端

- **Quart**：異步 Web 框架
- **Google Gemini AI**：AI 行程生成
- **Google Maps API**：地點資訊和路線規劃
- **OpenWeatherMap API**：天氣資料

### 前端

- **HTML5/CSS3**：響應式設計
- **Vanilla JavaScript**：前端邏輯
- **Font Awesome**：圖示庫

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 此專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 授權

此專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件

## 🙏 致謝

- Google Gemini AI 提供強大的 AI 能力
- Google Maps 提供精準的地圖服務
- OpenWeatherMap 提供可靠的天氣資料

---

**開發者**：Chen An
**GitHub**：[chenan1126](https://github.com/chenan1126)
