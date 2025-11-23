-- ================================================
-- Step 5: 建立景點回報資料表
-- ================================================

-- 建立回報資料表
CREATE TABLE attraction_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attraction_name TEXT NOT NULL,          -- 景點名稱
  report_type TEXT NOT NULL,              -- 回報類型 (closed, wrong_info, other)
  description TEXT,                       -- 詳細說明
  status TEXT DEFAULT 'pending',          -- 處理狀態 (pending, reviewed, rejected, approved)
  created_at TIMESTAMPTZ DEFAULT NOW()    -- 回報時間
);

-- 建立索引
CREATE INDEX idx_reports_attraction_name ON attraction_reports(attraction_name);
CREATE INDEX idx_reports_status ON attraction_reports(status);

-- 驗證資料表是否建立成功
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'attraction_reports';
