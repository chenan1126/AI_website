/**
 * 本地開發服務器
 * 包裝 Vercel Serverless Function 以便在本地測試
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import handler from './api/ask.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // 設置 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS preflight 請求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 路由處理
  if (req.url.startsWith('/api/ask')) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        // 解析請求 body
        if (body) {
          req.body = JSON.parse(body);
        }
        
        // 調用 Vercel Function handler
        await handler(req, res);
      } catch (error) {
        console.error('❌ 服務器錯誤:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    // 404 未找到
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                                                  ║');
  console.log('║  🚀 本地開發服務器已啟動！                      ║');
  console.log('║                                                  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  📍 後端 API: http://localhost:${PORT}/api/ask    ║`);
  console.log('║  📍 前端: 請在另一個終端運行 npm run dev       ║');
  console.log('║                                                  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  💡 提示:                                        ║');
  console.log('║  - 修改代碼會自動重載（需重啟）                ║');
  console.log('║  - 查看此終端獲取後端日誌                      ║');
  console.log('║  - 按 Ctrl+C 停止服務器                        ║');
  console.log('║                                                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ 環境變數狀態:`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ 已設定' : '✗ 未設定'}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ 已設定' : '✗ 未設定'}`);
  console.log(`   SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✓ 已設定' : '✗ 未設定'}`);
  console.log('');
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n\n👋 正在關閉服務器...');
  server.close(() => {
    console.log('✅ 服務器已關閉');
    process.exit(0);
  });
});
