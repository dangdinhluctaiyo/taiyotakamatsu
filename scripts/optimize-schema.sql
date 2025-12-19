-- Script tối ưu schema Supabase
-- Chạy trong Supabase Dashboard > SQL Editor

-- Xóa cột không dùng trong bảng customers
ALTER TABLE customers DROP COLUMN IF EXISTS email;
ALTER TABLE customers DROP COLUMN IF EXISTS address;
ALTER TABLE customers DROP COLUMN IF EXISTS created_at;

-- Xóa cột không dùng trong bảng products  
ALTER TABLE products DROP COLUMN IF EXISTS is_serialized;
ALTER TABLE products DROP COLUMN IF EXISTS created_at;

-- Xóa cột không dùng trong bảng orders
ALTER TABLE orders DROP COLUMN IF EXISTS created_at;

-- Xóa cột không dùng trong bảng staff
ALTER TABLE staff DROP COLUMN IF EXISTS created_at;

-- Xóa bảng suppliers nếu không dùng (cẩn thận!)
-- DROP TABLE IF EXISTS suppliers;

-- Verify kết quả
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'orders', 'order_items', 'customers', 'staff', 'inventory_logs')
ORDER BY table_name, ordinal_position;
