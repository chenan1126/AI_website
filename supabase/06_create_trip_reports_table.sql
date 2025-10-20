-- 創建行程回報表，用於存儲用戶回報的行程問題
CREATE TABLE IF NOT EXISTS trip_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL, -- 用戶的原始查詢
  prompt TEXT NOT NULL, -- 生成行程時使用的完整prompt
  generated_result JSONB NOT NULL, -- AI生成的完整結果
  report_reason TEXT, -- 用戶回報的原因（可選）
  report_details TEXT, -- 用戶的詳細反饋（可選）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_trip_reports_user_id ON trip_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_reports_status ON trip_reports(status);
CREATE INDEX IF NOT EXISTS idx_trip_reports_created_at ON trip_reports(created_at DESC);

-- 啟用 RLS (Row Level Security)
ALTER TABLE trip_reports ENABLE ROW LEVEL SECURITY;

-- 創建政策：用戶只能查看自己的回報
CREATE POLICY "Users can view their own reports" ON trip_reports
  FOR SELECT USING (auth.uid() = user_id);

-- 用戶可以創建自己的回報
CREATE POLICY "Users can insert their own reports" ON trip_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用戶可以更新自己的回報（用於將來可能的編輯功能）
CREATE POLICY "Users can update their own reports" ON trip_reports
  FOR UPDATE USING (auth.uid() = user_id);

-- 管理員可以查看所有回報（假設有一個admin角色）
-- 注意：這個政策可能會導致權限問題，建議在管理員界面手動查詢
-- CREATE POLICY "Admins can view all reports" ON trip_reports
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE auth.users.id = auth.uid()
--       AND auth.users.raw_user_meta_data->>'role' = 'admin'
--     )
--   );

-- 管理員可以更新回報狀態
-- 注意：這個政策可能會導致權限問題，建議在管理員界面手動查詢
-- CREATE POLICY "Admins can update reports" ON trip_reports
--   FOR UPDATE USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE auth.users.id = auth.uid()
--       AND auth.users.raw_user_meta_data->>'role' = 'admin'
--     )
--   );

-- 創建更新時間的觸發器
CREATE TRIGGER update_trip_reports_updated_at
  BEFORE UPDATE ON trip_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();