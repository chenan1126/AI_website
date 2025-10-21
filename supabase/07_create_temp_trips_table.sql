-- 創建臨時行程表（不需要登入即可訪問）
CREATE TABLE IF NOT EXISTS temp_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_data JSONB NOT NULL,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_temp_trips_session_id ON temp_trips(session_id);
CREATE INDEX IF NOT EXISTS idx_temp_trips_expires_at ON temp_trips(expires_at);

-- 啟用 RLS
ALTER TABLE temp_trips ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取臨時行程（用於分享）
CREATE POLICY "Anyone can view temp trips" ON temp_trips
  FOR SELECT USING (true);

-- 允許任何人插入臨時行程
CREATE POLICY "Anyone can insert temp trips" ON temp_trips
  FOR INSERT WITH CHECK (true);

-- 清理過期臨時行程的函數
CREATE OR REPLACE FUNCTION cleanup_expired_temp_trips()
RETURNS void AS $$
BEGIN
  DELETE FROM temp_trips WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 創建定時任務來清理過期數據（如果支持的話）
-- 否則可以通過 API 調用來清理