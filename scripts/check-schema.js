// Kiểm tra cấu trúc bảng Supabase
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

async function checkSchema() {
  console.log('📊 Kiểm tra cấu trúc bảng Supabase...\n');

  const tables = {
    products: ['id', 'code', 'name', 'category', 'price_per_day', 'total_owned', 'current_physical_stock', 'image_url', 'images', 'location', 'specs'],
    orders: ['id', 'customer_id', 'rental_start_date', 'expected_return_date', 'actual_return_date', 'status', 'total_amount', 'final_amount', 'note', 'completed_by'],
    order_items: ['id', 'order_id', 'product_id', 'quantity', 'is_external', 'supplier_id', 'exported_quantity', 'returned_quantity', 'note'],
    customers: ['id', 'name', 'phone'],
    staff: ['id', 'username', 'password', 'name', 'role', 'active'],
    inventory_logs: ['id', 'product_id', 'order_id', 'action_type', 'quantity', 'staff_id', 'staff_name', 'note', 'timestamp']
  };

  for (const [table, expectedCols] of Object.entries(tables)) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
      continue;
    }

    const actualCols = data && data[0] ? Object.keys(data[0]) : [];
    const extraCols = actualCols.filter(c => !expectedCols.includes(c));
    const missingCols = expectedCols.filter(c => !actualCols.includes(c));

    console.log(`\n📋 ${table.toUpperCase()}`);
    console.log(`   Cột hiện có: ${actualCols.join(', ') || '(trống)'}`);
    
    if (extraCols.length > 0) {
      console.log(`   ⚠️  Cột thừa: ${extraCols.join(', ')}`);
    }
    if (missingCols.length > 0) {
      console.log(`   ⚠️  Cột thiếu: ${missingCols.join(', ')}`);
    }
    if (extraCols.length === 0 && missingCols.length === 0) {
      console.log(`   ✅ OK - Đúng cấu trúc`);
    }
  }

  console.log('\n✨ Hoàn tất kiểm tra!');
}

checkSchema().catch(console.error);
