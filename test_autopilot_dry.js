const { fetchSheetsData } = require('./src/lib/sheets');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = 'https://acbymfzwsugaxrnvqrsh.supabase.co';
  const supabaseKey = 'sb_publishable_cMhDmhVTjD9EJGRAIEKfnw_ykY5gKVa';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching sheets data...');
  const { invoices, customers } = await fetchSheetsData();
  console.log('Total invoices from sheets:', invoices.length);
  console.log('Total customers from sheets:', customers.length);

  const openInvoices = invoices.filter(i => i.status?.toLowerCase() === 'open');
  console.log('Total open invoices:', openInvoices.length);

  const groupedInvoices = {};
  openInvoices.forEach(inv => {
    if (!inv.Customer) return;
    if (!groupedInvoices[inv.Customer]) {
      groupedInvoices[inv.Customer] = [];
    }
    groupedInvoices[inv.Customer].push(inv);
  });

  console.log('Grouped Customers Count:', Object.keys(groupedInvoices).length);
  console.log('Grouped Customer Names:', Object.keys(groupedInvoices).slice(0, 5));

  for (const customerName of Object.keys(groupedInvoices)) {
    const customerData = customers.find(c => c['Customer Name'] === customerName);
    if (customerData) {
      console.log(`Match found for: "${customerName}". Email resolved: "${customerData['Email ID']}"`);
    } else {
      console.log(`No match in contacts for: "${customerName}"`);
    }
  }
}

main().catch(console.error);
