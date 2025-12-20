// Xóa toàn bộ dữ liệu trong Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function clearAllData() {
  console.log('⚠️  XÓA TOÀN BỘ DỮ LIỆU SUPABASE...\n');

  // Xóa theo thứ tự để tránh lỗi foreign key
  const tables = [
    'inventory_logs',
    'order_items', 
    'orders',
    'products',
    'customers',
    // Giữ lại staff để có thể đăng nhập
  ];

  for (const table of tables) {
    console.log(`🗑️  Đang xóa ${table}...`);
    const { error } = await supabase.from(table).delete().neq('id', 0);
    if (error) {
      console.log(`   ❌ Lỗi: ${error.message}`);
    } else {
      console.log(`   ✅ Đã xóa`);
    }
  }

  // Kiểm tra kết quả
  console.log('\n📊 Kiểm tra sau khi xóa:');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id');
    const count = data ? data.length : 0;
    console.log(`   ${table}: ${count} records`);
  }

  // Kiểm tra staff
  const { data: staffData } = await supabase.from('staff').select('id, username, name');
  console.log(`   staff: ${staffData?.length || 0} records`);
  if (staffData && staffData.length > 0) {
    console.log('   📋 Staff còn lại:', staffData.map(s => s.username).join(', '));
  }

  console.log('\n✨ Hoàn tất!');
}

clearAllData().catch(console.error);
