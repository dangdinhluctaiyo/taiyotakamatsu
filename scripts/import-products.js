import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA2Njc3NiwiZXhwIjoyMDgxNjQyNzc2fQ.OrKWBDpQc_eU5hLtinx7tiWo_8lUnZASMa7Ge6443Rs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DEFAULT_STOCK = 10;

async function importProducts() {
  console.log('Reading Excel file...');
  
  const filePath = '/Users/dangdinhluc/Downloads/shikoku_products_2025-12-18 (5).xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Found ${data.length} products in Excel\n`);

  // Map Excel columns to database fields
  const products = data.map((row, index) => {
    const code = row['Mã SP'] || row['Code'] || row['code'] || `SP${String(index + 1).padStart(4, '0')}`;
    const name = row['Tên SP'] || row['Name'] || row['name'] || row['Tên sản phẩm'] || `Sản phẩm ${index + 1}`;
    const category = row['Danh mục'] || row['Category'] || row['category'] || 'Khác';
    const price = parseFloat(row['Giá thuê/ngày'] || row['Price'] || row['price'] || 0) || 0;
    const imageUrl = row['Hình ảnh'] || row['Image'] || row['image'] || '';
    const specs = row['Thông số'] || row['Specs'] || row['specs'] || '';
    const location = row['Vị trí'] || row['Location'] || row['location'] || '';

    return {
      code: String(code).trim(),
      name: String(name).trim(),
      category: String(category).trim(),
      price_per_day: price,
      total_owned: DEFAULT_STOCK,
      current_physical_stock: DEFAULT_STOCK,
      image_url: imageUrl ? String(imageUrl).trim() : null,
      specs: specs ? String(specs).trim() : null,
      location: location ? String(location).trim() : null,
      images: []
    };
  });

  console.log('Sample products:');
  products.slice(0, 3).forEach(p => console.log(`  - ${p.code}: ${p.name} (${p.category})`));
  console.log('');

  // Insert products
  let inserted = 0, skipped = 0;
  
  for (const product of products) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('code', product.code)
      .single();

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${product.code}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('products').insert(product);
    
    if (error) {
      console.log(`❌ Error ${product.code}: ${error.message}`);
    } else {
      console.log(`✅ Inserted: ${product.code} - ${product.name}`);
      inserted++;
    }
  }

  console.log(`\n========== DONE ==========`);
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📦 Total stock per item: ${DEFAULT_STOCK}`);
}

importProducts().catch(console.error);
