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
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { fetchSheetsData } = require('../src/lib/sheets');
  const { invoices } = await fetchSheetsData();

  console.log(`Fetched ${invoices.length} invoices. Trying to insert first 3...`);
  const sampleInvoices = invoices.slice(0, 3).map(inv => ({
    invoice_number: inv['Invoice number'],
    customer: inv.Customer,
    amount: inv['Invoice amount'],
    status: inv.status,
    date: inv['Invoice date'] || inv.Date,
    raw_data: inv
  }));

  console.log('Sample Invoices Payload:', sampleInvoices);

  const res = await supabase.from('invoices').insert(sampleInvoices);
  console.log('Supabase API Response status:', res.status, res.statusText);
  console.log('Supabase API Response error:', res.error);
  console.log('Supabase API Response data:', res.data);
}

main().catch(console.error);
