// Setup Supabase tables
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjY3NzYsImV4cCI6MjA4MTY0Mjc3Nn0.cItQN9-Pm0dLbOZfVKMwvAQA9mi-iS3MVM34jntTft8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // Test by trying to select from a table
  const { data, error } = await supabase.from('staff').select('*').limit(1);
  
  if (error) {
    console.log('Tables not found or error:', error.message);
    console.log('\n⚠️  Please run the SQL schema manually in Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/hpndgfvzmgpmvoaynsvu/sql');
    console.log('2. Copy content from supabase/schema.sql');
    console.log('3. Paste and run in SQL Editor');
  } else {
    console.log('✅ Connection successful! Tables exist.');
    console.log('Staff data:', data);
  }
}

testConnection();
