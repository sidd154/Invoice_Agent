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

  // Fetch Invoices with adaptive fallbacks
  let invoicesData;
  try {
    const invoiceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Outstanding-detail'!A:K",
    });
    invoicesData = invoiceResponse.data.values;
  } catch (e1) {
    try {
      console.log("Outstanding-detail tab not found, attempting fallback to 'Invoice Details'...");
      const invoiceResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Invoice Details!A:F",
      });
      invoicesData = invoiceResponse.data.values;
    } catch (e2) {
      throw new Error(`Unable to find 'Outstanding-detail' or 'Invoice Details' tab in Spreadsheet ID: ${spreadsheetId}. Details: ${e1.message}`);
    }
  }

  // Fetch Customers with adaptive fallbacks
  let customersData;
  try {
    const customerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'contacts'!A:B",
    });
    customersData = customerResponse.data.values;
  } catch (e1) {
    try {
      console.log("contacts tab not found, attempting fallback to 'Customer Contacts'...");
      const customerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Customer Contacts!A:B",
      });
      customersData = customerResponse.data.values;
    } catch (e2) {
      throw new Error(`Unable to find 'contacts' or 'Customer Contacts' tab in Spreadsheet ID: ${spreadsheetId}. Details: ${e1.message}`);
    }
  }

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

