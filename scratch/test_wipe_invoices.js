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

  console.log('Querying invoices before wipe...');
  const { data: before } = await supabase.from('invoices').select('*');
  console.log('Invoices before wipe count:', before.length);
  console.log('Invoices IDs before wipe:', before.map(i => i.id));

  console.log('Wiping invoices...');
  const res = await supabase.from('invoices').delete().neq('id', 0);
  console.log('Wipe invoices response status:', res.status, res.statusText);
  console.log('Wipe invoices response error:', res.error);

  console.log('Querying invoices after wipe...');
  const { data: after } = await supabase.from('invoices').select('*');
  console.log('Invoices after wipe count:', after.length);
}

main().catch(console.error);
