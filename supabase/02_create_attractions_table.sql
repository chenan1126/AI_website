-- ================================================
-- Step 2: 建立景點資料表
-- ================================================
-- 在 Supabase SQL Editor 中執行此腳本

-- 建立景點資料表
CREATE TABLE tourist_attractions (
  -- 基本資訊
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- 景點名稱
  category TEXT,                          -- 景點類型（自然景觀、文化古蹟、美食等）
  city TEXT NOT NULL,                     -- 縣市
  district TEXT,                          -- 區域
  address TEXT,                           -- 地址
  description TEXT,                       -- 景點描述
  features TEXT[],                        -- 特色標籤（適合親子、網美景點等）
  
  -- 聯絡資訊（來自 CSV）
  phone TEXT,                             -- 電話
  website TEXT,                           -- 網站
  opening_hours JSONB,                    -- 營業時間（JSON格式，來自 CSV）
  
  -- RAG 向量資料
  embedding VECTOR(768),                 -- Gemini text-embedding-004 的向量（768維度）
  
  -- 元資料
  metadata JSONB,                        -- 其他元資料
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- 建立時間
  updated_at TIMESTAMPTZ DEFAULT NOW()   -- 更新時間
);

-- 建立索引以提升查詢效能
CREATE INDEX idx_attractions_city ON tourist_attractions(city);
CREATE INDEX idx_attractions_category ON tourist_attractions(category);
CREATE INDEX idx_attractions_name ON tourist_attractions(name);

-- 建立向量搜尋索引（IVFFlat 索引）
-- lists = 100 適合中小型資料集（< 10000 筆）
CREATE INDEX idx_attractions_embedding ON tourist_attractions 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_attractions_updated_at 
    BEFORE UPDATE ON tourist_attractions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 驗證資料表是否建立成功
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tourist_attractions'
ORDER BY ordinal_position;

-- 如果看到資料表的所有欄位，表示建立成功 ✓
