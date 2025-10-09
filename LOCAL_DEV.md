# 本地開發指南

## 🔧 本地測試環境設置

### 方法 1：使用 Vercel CLI（推薦）

這是測試 Vercel Serverless Functions 的正確方法。

#### 步驟 1：安裝 Vercel CLI

```powershell
npm install -g vercel
```

#### 步驟 2：登入 Vercel

```powershell
vercel login
```

#### 步驟 3：創建 .env 文件

在專案根目錄創建 `.env` 文件：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
GOOGLE_MAPS_API_KEY=你的_Google_Maps_Key（可選）
CWA_API_KEY=CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2
```

#### 步驟 4：運行開發服務器

```powershell
vercel dev
```

這會：
- ✅ 啟動本地開發服務器（通常在 http://localhost:3000）
- ✅ 模擬 Vercel Serverless Functions
- ✅ 自動處理路由和環境變量
- ✅ 支援熱重載

#### 步驟 5：訪問應用

打開瀏覽器訪問：`http://localhost:3000`

---

### 方法 2：分離開發（前後端分開）

如果不想使用 Vercel CLI，可以分別運行前後端：

#### 後端：使用 Python HTTP Server

創建 `dev_server.py`：

```python
from http.server import HTTPServer
import sys
import os

# 添加 api 目錄到路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

from ask import handler as ask_handler
from index import handler as index_handler

class DevServer(HTTPServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

if __name__ == '__main__':
    from http.server import BaseHTTPRequestHandler
    
    class Router(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path == '/api/ask':
                ask_handler().do_POST(self)
            else:
                self.send_error(404)
        
        def do_GET(self):
            if self.path == '/api' or self.path == '/api/':
                index_handler().do_GET(self)
            else:
                self.send_error(404)
        
        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
    
    server = HTTPServer(('localhost', 5000), Router)
    print('🚀 Dev server running on http://localhost:5000')
    server.serve_forever()
```

然後運行：

```powershell
# Terminal 1: 啟動後端
python dev_server.py

# Terminal 2: 啟動前端
cd react-app
npm run dev
```

前端訪問：`http://localhost:5173`

#### 修改前端 API URL（僅開發時）

修改 `react-app/src/App.jsx`：

```javascript
// 開發環境使用 localhost:5000，生產環境使用 /api
const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';
```

---

## ⚠️ 常見問題

### 問題 1：404 錯誤

**原因**：
- 本地沒有運行 Vercel CLI
- 或者前端 API URL 指向錯誤

**解決**：
- 使用 `vercel dev` 運行本地服務器
- 或者使用分離開發模式

### 問題 2：CORS 錯誤

**解決**：
在 `api/ask.py` 和 `api/index.py` 中已經設置了 CORS 頭：
```python
self.send_header('Access-Control-Allow-Origin', '*')
```

### 問題 3：環境變量未生效

**解決**：
- 創建 `.env` 文件在專案根目錄
- 重啟 `vercel dev`

---

## 🚀 推薦開發流程

### 最佳實踐：

1. **本地開發**：使用 `vercel dev`
   ```powershell
   vercel dev
   ```

2. **測試完成後**：推送到 GitHub
   ```powershell
   git add .
   git commit -m "update"
   git push
   ```

3. **自動部署**：Vercel 自動部署到生產環境

---

## 📝 .gitignore 更新

確保 `.env` 不被提交到 Git：

```.gitignore
.env
.vercel
node_modules/
dist/
*.pyc
__pycache__/
```

---

**總結**：
- ✅ 本地測試用 `vercel dev`
- ✅ 或者分離開發（前端 5173，後端 5000）
- ✅ 生產環境直接推送到 GitHub，Vercel 自動部署
