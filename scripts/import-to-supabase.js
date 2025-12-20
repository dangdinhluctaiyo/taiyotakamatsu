import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Supabase config
const SUPABASE_URL = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjY3NzYsImV4cCI6MjA4MTY0Mjc3Nn0.cItQN9-Pm0dLbOZfVKMwvAQA9mi-iS3MVM34jntTft8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importProducts() {
  console.log('🗑️  Xóa dữ liệu cũ trong bảng products...');
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .neq('id', 0); // Xóa tất cả records
  
  if (deleteError) {
    console.error('❌ Lỗi xóa dữ liệu:', deleteError.message);
    return;
  }
  console.log('✅ Đã xóa dữ liệu cũ');

  console.log('📖 Đọc file Excel...');
  const workbook = XLSX.readFile('shikoku_products_2025-12-19 (1).xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header, filter rows with product code
  const products = data.slice(1).filter(row => row[1]);
  console.log(`📦 Tìm thấy ${products.length} sản phẩm`);

  // Track used codes để tránh trùng trong file Excel
  const usedCodes = new Set();

  // Transform to Supabase format với xử lý trùng mã
  const records = products.map(row => {
    let baseCode = row[1] || '';
    let code = baseCode;
    let suffix = 1;

    // Nếu mã đã tồn tại, thêm -1, -2, -3...
    while (usedCodes.has(code)) {
      code = `${baseCode}-${suffix}`;
      suffix++;
    }
    usedCodes.add(code);

    if (code !== baseCode) {
      console.log(`   🔄 Đổi mã: ${baseCode} → ${code}`);
    }

    return {
      code,
      name: row[2] || '',
      category: row[0] || 'Khác',
      image_url: row[3] || null,
      price_per_day: 0,
      total_owned: 0,
      current_physical_stock: 0,
      images: [],
      location: null,
      specs: null
    };
  });

  console.log('🚀 Bắt đầu import vào Supabase...');
  
  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { data: result, error } = await supabase
      .from('products')
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ Lỗi batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += result?.length || 0;
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${result?.length || 0} sản phẩm`);
    }
  }

  console.log('\n📊 Kết quả:');
  console.log(`   ✅ Đã thêm: ${inserted}`);
  console.log(`   ❌ Lỗi: ${errors}`);
}

importProducts().catch(console.error);
