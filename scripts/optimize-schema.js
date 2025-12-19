// Script tối ưu schema Supabase
// Chạy: node scripts/optimize-schema.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function optimizeSchema() {
  console.log('🔧 Bắt đầu tối ưu schema...\n');

  // Lưu ý: Supabase JS client không hỗ trợ ALTER TABLE trực tiếp
  // Bạn cần chạy SQL trong Supabase Dashboard > SQL Editor
  
  const sql = `
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
`;

  console.log('⚠️  Supabase JS client không hỗ trợ ALTER TABLE.');
  console.log('📋 Vui lòng copy SQL sau và chạy trong Supabase Dashboard > SQL Editor:\n');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  
  // Kiểm tra kết nối và hiển thị cấu trúc hiện tại
  console.log('\n📊 Kiểm tra cấu trúc bảng hiện tại...\n');
  
  const tables = ['products', 'orders', 'customers', 'staff', 'order_items', 'inventory_logs'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: OK`);
    }
  }
  
  console.log('\n✨ Hoàn tất kiểm tra!');
}

optimizeSchema().catch(console.error);
