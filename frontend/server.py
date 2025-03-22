from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()

    def do_GET(self):
        return SimpleHTTPRequestHandler.do_GET(self)

# 確保工作目錄是前端文件所在的目錄
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 啟動服務器
PORT = 8000
print(f"啟動服務器在 http://localhost:{PORT}")
httpd = HTTPServer(('localhost', PORT), CORSRequestHandler)
httpd.serve_forever() 