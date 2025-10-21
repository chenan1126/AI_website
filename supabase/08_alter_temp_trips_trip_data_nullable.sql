-- 修改 temp_trips 表的 trip_data 列，允許 NULL 值
ALTER TABLE temp_trips ALTER COLUMN trip_data DROP NOT NULL;