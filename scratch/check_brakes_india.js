const { fetchSheetsData } = require('../src/lib/sheets');

async function checkBrakesIndia() {
  console.log('Fetching Google Sheets data...');
  try {
    const { invoices, customers } = await fetchSheetsData();
    
    const brakesInvoices = invoices.filter(i => i.Customer === 'Brakes India');
    const brakesContact = customers.find(c => c['Customer Name'] === 'Brakes India');
    
    console.log('\n--- Brakes India Contact Details ---');
    console.log(brakesContact);
    
    console.log('\n--- Brakes India Open Invoices ---');
    console.log(brakesInvoices.filter(i => i.status.toLowerCase() === 'open'));
    
  } catch (err) {
    console.error('Error fetching sheets:', err.message);
  }
}

checkBrakesIndia();
