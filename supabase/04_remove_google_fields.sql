-- ================================================
-- 移除不需要的 Google Places 欄位
-- ================================================
-- 如果您已經用舊的腳本建立了資料表，執行此腳本來移除不需要的欄位

-- 刪除不需要的欄位
ALTER TABLE tourist_attractions 
  DROP COLUMN IF EXISTS google_place_id,
  DROP COLUMN IF EXISTS google_rating,
  DROP COLUMN IF EXISTS google_user_ratings_total,
  DROP COLUMN IF EXISTS price_level,
  DROP COLUMN IF EXISTS business_status,
  DROP COLUMN IF EXISTS photos;

-- 刪除相關的索引
DROP INDEX IF EXISTS idx_attractions_status;
DROP INDEX IF EXISTS idx_attractions_google_place_id;

-- 新增名稱索引（加快搜尋）
CREATE INDEX IF NOT EXISTS idx_attractions_name ON tourist_attractions(name);

-- 驗證欄位已刪除
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tourist_attractions'
ORDER BY ordinal_position;

-- 如果看不到那些欄位，表示刪除成功 ✓
