// Create Supabase tables using service_role key
const supabaseUrl = 'https://hpndgfvzmgpmvoaynsvu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbmRnZnZ6bWdwbXZvYXluc3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA2Njc3NiwiZXhwIjoyMDgxNjQyNzc2fQ.OrKWBDpQc_eU5hLtinx7tiWo_8lUnZASMa7Ge6443Rs';

const sql = `
-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Khác',
  price_per_day DECIMAL(12,2) DEFAULT 0,
  total_owned INTEGER DEFAULT 0,
  current_physical_stock INTEGER DEFAULT 0,
  image_url TEXT,
  images JSONB DEFAULT '[]',
  location VARCHAR(255),
  specs TEXT,
  is_serialized BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  rental_start_date DATE NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status VARCHAR(50) DEFAULT 'BOOKED',
  total_amount DECIMAL(12,2) DEFAULT 0,
  final_amount DECIMAL(12,2),
  note TEXT,
  completed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
`;

async function createTables() {
  console.log('Creating tables via Supabase REST API...');
  
  const response = await fetch(\`\${supabaseUrl}/rest/v1/rpc/exec_sql\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': \`Bearer \${serviceRoleKey}\`
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    console.log('RPC not available, trying direct approach...');
    // Try using pg directly or show manual instructions
    console.log('\\n📋 Please run SQL manually in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/hpndgfvzmgpmvoaynsvu/sql');
  } else {
    console.log('✅ Tables created successfully!');
  }
}

createTables();
