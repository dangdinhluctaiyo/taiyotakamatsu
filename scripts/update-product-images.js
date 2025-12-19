import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA2Njc3NiwiZXhwIjoyMDgxNjQyNzc2fQ.OrKWBDpQc_eU5hLtinx7tiWo_8lUnZASMa7Ge6443Rs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function updateProductImages() {
  console.log('Reading Excel file...');
  
  const filePath = 'services/shikoku_products_2025-12-18 (5).xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Found ${data.length} products in Excel\n`);

  let updated = 0, notFound = 0, errors = 0;

  for (const row of data) {
    const name = row['Tên sản phẩm'];
    const imageUrl = row['Link ảnh'];

    if (!name || !imageUrl) {
      console.log(`⏭️  Skipped (missing data): ${name || 'No name'}`);
      continue;
    }

    // Find product by name
    const { data: products, error: findError } = await supabase
      .from('products')
      .select('id, name, image_url')
      .eq('name', name.trim());

    if (findError) {
      console.log(`❌ Error finding ${name}: ${findError.message}`);
      errors++;
      continue;
    }

    if (!products || products.length === 0) {
      console.log(`⚠️  Not found: ${name}`);
      notFound++;
      continue;
    }

    // Update image_url
    const { error: updateError } = await supabase
      .from('products')
      .update({ image_url: imageUrl.trim() })
      .eq('id', products[0].id);

    if (updateError) {
      console.log(`❌ Error updating ${name}: ${updateError.message}`);
      errors++;
    } else {
      console.log(`✅ Updated: ${name}`);
      updated++;
    }
  }

  console.log(`\n========== DONE ==========`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚠️  Not found: ${notFound}`);
  console.log(`❌ Errors: ${errors}`);
}

updateProductImages().catch(console.error);
