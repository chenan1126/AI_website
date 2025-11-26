
-- ================================================
-- 修復 RAG 搜尋問題
-- ================================================
-- 問題原因：
-- 目前的 IVFFlat 索引導致搜尋時遺漏了高相關性的結果（如嘉義市立博物館）。
-- 對於目前的資料量（約 3000 筆），使用索引反而可能降低召回率，且沒有顯著的效能提升。
-- 
-- 解決方案：
-- 1. 刪除向量索引，改用全表掃描（Sequential Scan）。
--    對於 < 10,000 筆資料，全表掃描通常比 IVFFlat 更準確且速度極快。
-- 2. 更新搜尋函數，確保邏輯正確。

-- 1. 刪除向量索引
DROP INDEX IF EXISTS idx_attractions_embedding;

-- 2. 更新搜尋函數 (確保使用最新的邏輯)
CREATE OR REPLACE FUNCTION match_attractions(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5, -- 稍微降低預設閾值
  match_count INT DEFAULT 10,
  filter_city TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
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
  similarity FLOAT
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
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tourist_attractions t
  WHERE 
    (filter_city IS NULL OR TRIM(t.city) LIKE TRIM(filter_city) || '%' OR TRIM(t.city) = TRIM(filter_city))
    AND (filter_category IS NULL OR TRIM(t.category) = TRIM(filter_category))
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC -- 確保按相似度降序排列
  LIMIT match_count;
END;
$$;
