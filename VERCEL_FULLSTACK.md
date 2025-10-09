# Vercel 全棧部署方案

## 🎯 方案說明

我們可以把前端和後端**都部署到 Vercel**，使用 Vercel 的 Serverless Functions。

### 優點
- ✅ 全部在一個平台管理
- ✅ 自動 HTTPS
- ✅ 全球 CDN 加速
- ✅ 前後端自動同步部署
- ✅ 免費額度充足

### 注意事項
- ⚠️ Vercel Serverless Functions 有**執行時間限制**（免費版 10 秒）
- ⚠️ 如果 AI 生成時間超過 10 秒，需要改用 Render 等平台
- ✅ 建議：先試試看，如果超時再換方案

---

## 📁 專案結構調整

需要將後端改造為 Vercel Serverless Functions：

```
AI_website/
├── react-app/           # 前端 (保持不變)
│   ├── src/
│   ├── public/
│   └── ...
├── api/                 # 後端 API (新建)
│   └── ask.py          # Serverless Function
└── vercel.json         # Vercel 配置 (根目錄)
```

---

## 🚀 實作步驟

### 步驟 1: 創建 API 目錄結構

在**專案根目錄**創建 `api/` 文件夾，並將後端邏輯轉換為 Serverless Function。

### 步驟 2: 創建根目錄 vercel.json

```json
{
  "buildCommand": "cd react-app && npm install && npm run build",
  "outputDirectory": "react-app/dist",
  "devCommand": "cd react-app && npm run dev",
  "installCommand": "cd react-app && npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/react-app/dist/$1"
    }
  ],
  "functions": {
    "api/*.py": {
      "runtime": "python3.9"
    }
  }
}
```

### 步驟 3: 創建 requirements.txt (根目錄)

```txt
google-generativeai
requests
python-dotenv
```

### 步驟 4: 創建 api/ask.py

Vercel Serverless Functions 需要特定格式：

```python
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# 初始化 Gemini
api_key = os.environ.get('GEMINI_API_KEY')
if api_key:
    genai.configure(api_key=api_key)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        # 讀取請求數據
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        question = data.get('question', '')
        
        # 調用 Gemini API
        try:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(question)
            
            result = {
                'status': 'success',
                'data': {
                    'itineraries': [{
                        'title': '生成的行程',
                        'sections': []
                    }]
                }
            }
            
            self.wfile.write(json.dumps(result).encode('utf-8'))
        except Exception as e:
            error_result = {
                'status': 'error',
                'message': str(e)
            }
            self.wfile.write(json.dumps(error_result).encode('utf-8'))
    
    def do_OPTIONS(self):
        # 處理 CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
```

---

## ⚠️ 重要限制

### Vercel Serverless Functions 限制

1. **執行時間**
   - 免費版：10 秒
   - Pro 版：60 秒
   - 如果 AI 生成超過 10 秒會**超時失敗**

2. **冷啟動**
   - 第一次請求可能較慢（1-2 秒）

3. **無狀態**
   - 每次請求都是獨立的
   - 無法維持長連接

---

## 🤔 建議方案

### 方案 A: 全部用 Vercel（簡單但有限制）

**適合情況：**
- AI 生成速度快（< 10 秒）
- 專題展示用途
- 不需要複雜後端邏輯

**缺點：**
- 超時風險
- 功能受限

### 方案 B: 前端 Vercel + 後端 Render（推薦）

**適合情況：**
- AI 生成時間不確定
- 需要穩定服務
- 完整功能

**優點：**
- 前端快速（Vercel CDN）
- 後端穩定（Render 無超時限制）
- 各自獨立擴展

---

## 💡 我的建議

基於你的專案特性（使用 Gemini AI 生成行程），我建議：

### 🎯 使用方案 B：前端 Vercel + 後端 Render

**理由：**
1. **AI 生成時間不可控**：Gemini 可能需要 5-30 秒生成行程
2. **Google Maps API 查詢**：增加額外時間
3. **天氣 API 查詢**：也需要時間
4. **總計可能超過 10 秒**：超過 Vercel 免費版限制

**部署步驟：**
1. ✅ 前端部署到 Vercel（已準備好）
2. ✅ 後端部署到 Render（已準備好）
3. ✅ 在 Vercel 設置環境變量連接後端

---

## 🚀 快速決策

### 如果你想試試 Vercel 全棧：
我可以幫你創建 Serverless Functions 版本

### 如果你想穩定可靠：
使用現有方案（前端 Vercel + 後端 Render）

**你想選哪個方案？**
1. 全部 Vercel（可能超時）
2. 前端 Vercel + 後端 Render（推薦，穩定）

告訴我你的選擇，我會幫你完成部署！
