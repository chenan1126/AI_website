-- 創建用戶行程表
CREATE TABLE IF NOT EXISTS user_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_data JSONB NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_user_trips_user_id ON user_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trips_created_at ON user_trips(created_at DESC);

-- 啟用 RLS (Row Level Security)
ALTER TABLE user_trips ENABLE ROW LEVEL SECURITY;

-- 創建政策：用戶只能訪問自己的行程
CREATE POLICY "Users can view their own trips" ON user_trips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trips" ON user_trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips" ON user_trips
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips" ON user_trips
  FOR DELETE USING (auth.uid() = user_id);

-- 創建更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_trips_updated_at
  BEFORE UPDATE ON user_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();