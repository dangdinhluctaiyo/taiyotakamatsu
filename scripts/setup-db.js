import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA2Njc3NiwiZXhwIjoyMDgxNjQyNzc2fQ.OrKWBDpQc_eU5hLtinx7tiWo_8lUnZASMa7Ge6443Rs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setup() {
  console.log('Setting up database...\n');

  // Insert default staff
  const { data: existingStaff } = await supabase.from('staff').select('username').eq('username', 'admin');
  
  if (!existingStaff || existingStaff.length === 0) {
    console.log('Inserting default admin user...');
    await supabase.from('staff').insert([
      { username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin', active: true },
      { username: 'nhanvien1', password: '123456', name: 'Nhân viên 1', role: 'staff', active: true }
    ]);
  }

  // Test connection
  const { data, error } = await supabase.from('staff').select('*');
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('\n⚠️  Tables not created yet. Please run SQL in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/hpndgfvzmgpmvoaynsvu/sql\n');
  } else {
    console.log('✅ Database ready! Staff users:', data.length);
    data.forEach(s => console.log(`   - ${s.username} (${s.role})`));
  }
}

setup();
