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

  console.log('Testing Supabase Connection...');
  
  // Try fetching invoices from sheets data locally first
  const { fetchSheetsData } = require('../src/lib/sheets');
  const { invoices, customers } = await fetchSheetsData();

  console.log(`Fetched ${invoices.length} invoices and ${customers.length} customers from Google Sheets.`);

  // Try wiping customers
  console.log('Wiping customers from Supabase...');
  const wipeCustRes = await supabase.from('customers').delete().neq('id', 0);
  if (wipeCustRes.error) {
    console.error('Wipe customers failed:', wipeCustRes.error);
  } else {
    console.log('Wiped customers successfully.');
  }

  // Try insert customers
  const formattedCustomers = customers.map(c => {
    const emailVal = c['Email ID'] || c['Mail Id'] || c.email || '';
    const nameVal = c['Customer Name'] || c.name || '';
    return {
      name: nameVal,
      email: emailVal,
      raw_data: {
        ...c,
        'Customer Name': nameVal,
        'Email ID': emailVal,
        'Mail Id': emailVal
      }
    };
  });

  console.log('Inserting customers into Supabase...');
  const insertCustRes = await supabase.from('customers').insert(formattedCustomers);
  if (insertCustRes.error) {
    console.error('Insert customers failed:', insertCustRes.error);
  } else {
    console.log('Inserted customers successfully.');
  }

  // Try wiping invoices
  console.log('Wiping invoices from Supabase...');
  const wipeInvRes = await supabase.from('invoices').delete().neq('id', 0);
  if (wipeInvRes.error) {
    console.error('Wipe invoices failed:', wipeInvRes.error);
  } else {
    console.log('Wiped invoices successfully.');
  }

  // Try insert invoices
  const formattedInvoices = invoices.map(inv => ({
    invoice_number: inv['Invoice number'],
    customer: inv.Customer,
    amount: inv['Invoice amount'],
    status: inv.status,
    date: inv['Invoice date'] || inv.Date,
    raw_data: inv
  }));

  console.log('Inserting invoices into Supabase...');
  const insertInvRes = await supabase.from('invoices').insert(formattedInvoices);
  if (insertInvRes.error) {
    console.error('Insert invoices failed:', insertInvRes.error);
  } else {
    console.log('Inserted invoices successfully.');
  }
}

main().catch(console.error);
