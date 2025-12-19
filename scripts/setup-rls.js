import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA2Njc3NiwiZXhwIjoyMDgxNjQyNzc2fQ.OrKWBDpQc_eU5hLtinx7tiWo_8lUnZASMa7Ge6443Rs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tables = ['products', 'orders', 'order_items', 'customers', 'staff', 'inventory_logs'];

async function setupRLS() {
  console.log('Setting up RLS policies for all tables...\n');

  for (const table of tables) {
    console.log(`📋 Processing table: ${table}`);
    
    // Disable RLS first (allows all access)
    const { error: disableError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
    });

    if (disableError) {
      // Try alternative: create permissive policy
      console.log(`   ⚠️  Cannot disable RLS directly, trying to add policy...`);
      
      // Drop existing policies
      await supabase.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "Allow all for anon" ON ${table};`
      });
      
      // Create new permissive policy
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE POLICY "Allow all for anon" ON ${table}
          FOR ALL
          TO anon
          USING (true)
          WITH CHECK (true);
        `
      });
      
      if (policyError) {
        console.log(`   ❌ Error: ${policyError.message}`);
      } else {
        console.log(`   ✅ Policy created`);
      }
    } else {
      console.log(`   ✅ RLS disabled`);
    }
  }

  console.log('\n========== DONE ==========');
  console.log('Now testing with anon key...\n');

  // Test with anon key
  const anonClient = createClient(supabaseUrl, 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjY3NzYsImV4cCI6MjA4MTY0Mjc3Nn0.cItQN9-Pm0dLbOZfVKMwvAQA9mi-iS3MVM34jntTft8'
  );

  const { data, count } = await anonClient.from('products').select('*', { count: 'exact' }).limit(3);
  console.log(`Products accessible with anon key: ${count || data?.length || 0}`);
}

setupRLS().catch(console.error);
