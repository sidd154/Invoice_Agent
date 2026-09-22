const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = 'https://acbymfzwsugaxrnvqrsh.supabase.co';
  const supabaseKey = 'sb_publishable_cMhDmhVTjD9EJGRAIEKfnw_ykY5gKVa';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Querying invoices...');
  const { data: invoices, error: invErr } = await supabase.from('invoices').select('*');
  console.log('Total invoices in database:', invoices ? invoices.length : 0);
  if (invoices && invoices.length > 0) {
    console.log('Sample invoice:', invoices[0]);
    console.log('Open Invoices:', invoices.filter(i => i.status?.toLowerCase() === 'open').map(i => ({ number: i.invoice_number, customer: i.customer, amount: i.amount, status: i.status })));
  }
}

main().catch(console.error);
