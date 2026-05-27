import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export async function fetchSheetsData() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: creds.client_email,
          private_key: creds.private_key.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } catch (e) {
      console.error("Failed to parse GOOGLE_CREDENTIALS env var", e);
    }
  }

  if (!auth) {
    const credentialsPath = path.join(process.cwd(), 'seo-dashboard.json');
    if (fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      throw new Error('Google Credentials are missing. Please add GOOGLE_CREDENTIALS environment variable in Vercel.');
    }
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1f9xXZY6Z8RCAEAux6QBYeMzYWMpeVZUQhjinpCZD_Rs';

  // 1. Fetch spreadsheet metadata to discover available tabs
  let sheetTitles = [];
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    sheetTitles = meta.data.sheets.map(s => s.properties.title.trim());
  } catch (err) {
    throw new Error(`Failed to access Google Spreadsheet (ID: ${spreadsheetId}). Please verify the spreadsheet ID and share permissions. Details: ${err.message}`);
  }

  // 2. Dynamically determine which invoice sheet to query
  let invoiceRange = "";
  if (sheetTitles.includes("Outstanding-detail")) {
    invoiceRange = "Outstanding-detail!A:K";
  } else if (sheetTitles.includes("Invoice Details")) {
    invoiceRange = "Invoice Details!A:F";
  } else {
    // Check if there is a close case-insensitive or spacing match
    const match = sheetTitles.find(t => t.toLowerCase().replace(/[\s-_]+/g, '') === "outstandingdetail");
    if (match) {
      invoiceRange = `${match}!A:K`;
    } else {
      throw new Error(`Could not find the 'Outstanding-detail' or 'Invoice Details' tab in your spreadsheet (ID: ${spreadsheetId}). The tabs found in your spreadsheet are: [${sheetTitles.join(", ")}]. Please rename your tab to 'Outstanding-detail' exactly.`);
    }
  }

  // 3. Dynamically determine which contacts sheet to query
  let customerRange = "";
  if (sheetTitles.includes("contacts")) {
    customerRange = "contacts!A:B";
  } else if (sheetTitles.includes("Customer Contacts")) {
    customerRange = "Customer Contacts!A:B";
  } else {
    const match = sheetTitles.find(t => t.toLowerCase().replace(/[\s-_]+/g, '') === "contacts" || t.toLowerCase().replace(/[\s-_]+/g, '') === "customercontacts");
    if (match) {
      customerRange = `${match}!A:B`;
    } else {
      throw new Error(`Could not find the 'contacts' or 'Customer Contacts' tab in your spreadsheet (ID: ${spreadsheetId}). The tabs found in your spreadsheet are: [${sheetTitles.join(", ")}]. Please rename your tab to 'contacts' exactly.`);
    }
  }

  // 4. Fetch datasets using the dynamically resolved ranges
  const [invoiceResponse, customerResponse] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: invoiceRange }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: customerRange })
  ]);

  const invoicesData = invoiceResponse.data.values;
  const customersData = customerResponse.data.values;

  if (!invoicesData || invoicesData.length === 0 || !customersData || customersData.length === 0) {
    throw new Error('Spreadsheet was fetched but contains empty datasets.');
  }

  const invoiceHeaders = invoicesData[0].map(h => (h || '').trim());
  const invoices = invoicesData.slice(1).map(row => {
    let obj = {};
    invoiceHeaders.forEach((header, index) => {
      obj[header] = (row[index] || '').trim();
    });
    
    // Unified backwards-compatible properties mapping
    obj['Invoice number'] = obj['Invoice No'] || obj['Invoice number'] || '';
    obj['Customer'] = obj['Particulars'] || obj['Customer'] || '';
    obj['Invoice amount'] = obj['Net Invoice Value'] || obj['Invoice amount'] || '0';
    obj['Invoice date'] = obj['Date'] || obj['Invoice date'] || '';
    obj['status'] = (obj['Notification'] || obj['status'] || 'open').toLowerCase();
    
    return obj;
  });

  const customerHeaders = customersData[0].map(h => (h || '').trim());
  const customers = customersData.slice(1).map(row => {
    let obj = {};
    customerHeaders.forEach((header, index) => {
      obj[header] = (row[index] || '').trim();
    });
    
    // Unified backwards-compatible customer mappings
    obj['Customer Name'] = obj['Customer Name'] || '';
    obj['Email ID'] = obj['Mail Id'] || obj['Email ID'] || '';
    
    return obj;
  });

  return { invoices, customers };
}

