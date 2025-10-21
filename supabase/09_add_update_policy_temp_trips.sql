-- 添加 UPDATE 政策到 temp_trips 表
CREATE POLICY "Anyone can update temp trips" ON temp_trips
  FOR UPDATE USING (true);