const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Simple helper to parse env file
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
  
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } else {
    const credentialsPath = path.join(__dirname, '..', 'seo-dashboard.json');
    if (fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      throw new Error('Google Credentials file not found.');
    }
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1f9xXZY6Z8RCAEAux6QBYeMzYWMpeVZUQhjinpCZD_Rs';
  
  console.log('Using Spreadsheet ID:', spreadsheetId);

  // 1. Fetch metadata
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitles = meta.data.sheets.map(s => s.properties.title.trim());
  console.log('Available sheet titles:', sheetTitles);

  // 2. Fetch Invoice data
  let invoiceRange = "";
  if (sheetTitles.includes("Outstanding-detail")) {
    invoiceRange = "Outstanding-detail!A:K";
  } else if (sheetTitles.includes("Invoice Details")) {
    invoiceRange = "Invoice Details!A:F";
  }
  
  console.log('Resolved invoice range:', invoiceRange);

  if (invoiceRange) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: invoiceRange });
    console.log('Total rows found in invoice range:', res.data.values ? res.data.values.length : 0);
    if (res.data.values && res.data.values.length > 0) {
      console.log('Invoice Headers:', res.data.values[0]);
      console.log('Sample Invoice Row 1:', res.data.values[1]);
    }
  }

  // 3. Fetch Customer data
  let customerRange = "";
  if (sheetTitles.includes("contacts")) {
    customerRange = "contacts!A:B";
  } else if (sheetTitles.includes("Customer Contacts")) {
    customerRange = "Customer Contacts!A:B";
  }
  console.log('Resolved customer range:', customerRange);

  if (customerRange) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: customerRange });
    console.log('Total rows found in customer range:', res.data.values ? res.data.values.length : 0);
    if (res.data.values && res.data.values.length > 0) {
      console.log('Customer Headers:', res.data.values[0]);
      console.log('Sample Customer Row 1:', res.data.values[1]);
    }
  }
}

main().catch(console.error);
