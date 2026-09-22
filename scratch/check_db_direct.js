const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && val) {
          process.env[key] = val;
        }
      }
    });
  }
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Querying invoices directly with SERVICE_ROLE_KEY...');
  const { data: invoices, error } = await supabase.from('invoices').select('*');
  if (error) {
    console.error('Error querying invoices:', error);
  } else {
    console.log('Total invoices found in DB:', invoices.length);
    if (invoices.length > 0) {
      console.log('Sample Invoice in DB:', invoices[0]);
    }
  }

  console.log('Querying customers directly with SERVICE_ROLE_KEY...');
  const { data: customers, error: custErr } = await supabase.from('customers').select('*');
  if (custErr) {
    console.error('Error querying customers:', custErr);
  } else {
    console.log('Total customers found in DB:', customers.length);
  }
}

main().catch(console.error);
