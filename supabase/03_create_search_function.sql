-- ================================================
-- Step 3: 建立向量相似度搜尋函數
-- ================================================
-- 在 Supabase SQL Editor 中執行此腳本

-- 建立向量搜尋函數
CREATE OR REPLACE FUNCTION match_attractions(
  query_embedding VECTOR(768),           -- 查詢的向量（Gemini 768維度）
  match_threshold FLOAT DEFAULT 0.7,     -- 相似度閾值（0.0-1.0）
  match_count INT DEFAULT 10,            -- 返回結果數量
  filter_city TEXT DEFAULT NULL,         -- 城市過濾（可選）
  filter_category TEXT DEFAULT NULL      -- 類別過濾（可選）
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  description TEXT,
  features TEXT[],
  phone TEXT,
  website TEXT,
  similarity FLOAT                       -- 相似度分數
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.city,
    t.district,
    t.address,
    t.description,
    t.features,
    t.phone,
    t.website,
    -- 計算餘弦相似度（1 - 餘弦距離）
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tourist_attractions t
  WHERE 
    -- 城市過濾（如果提供）
    (filter_city IS NULL OR t.city = filter_city)
    -- 類別過濾（如果提供）
    AND (filter_category IS NULL OR t.category = filter_category)
    -- 相似度必須高於閾值
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding  -- 按相似度排序
  LIMIT match_count;
END;
$$;

-- 測試函數（先建立一個假的向量來測試）
-- 注意：這只是測試函數是否能執行，實際使用時會傳入真實的向量
SELECT match_attractions(
  array_fill(0, ARRAY[768])::VECTOR(768),  -- 假的零向量（768維度）
  0.0,      -- 閾值設為 0 以便測試
  5,        -- 返回 5 個結果
  NULL,     -- 不過濾城市
  NULL      -- 不過濾類別
);

-- 如果沒有錯誤，函數建立成功 ✓
-- （現在還沒有資料，所以會返回空結果）
