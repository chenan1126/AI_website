-- ================================================
-- Step 1: 啟用必要的 PostgreSQL 擴展
-- ================================================
-- 在 Supabase SQL Editor 中執行此腳本

-- 啟用 UUID 擴展（用於自動生成 ID）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 啟用 pgvector 擴展（用於向量搜尋）
CREATE EXTENSION IF NOT EXISTS vector;

-- 驗證擴展是否已啟用
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');

-- 如果看到兩行結果，表示擴展已成功啟用 ✓
