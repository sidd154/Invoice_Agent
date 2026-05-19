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
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '18jBPpZ2gLvQ1wHakmpZetf4n4TxHJGCDNWe6iqcBHuo';

  // Fetch Invoices
  const invoiceResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Invoice Details!A:F',
  });

  // Fetch Customers
  const customerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Customer Contacts!A:B',
  });

  const invoicesData = invoiceResponse.data.values;
  const customersData = customerResponse.data.values;

  if (!invoicesData || invoicesData.length === 0 || !customersData || customersData.length === 0) {
    throw new Error('Spreadsheet is empty or tabs not found.');
  }

  const invoiceHeaders = invoicesData[0];
  const invoices = invoicesData.slice(1).map(row => {
    let obj = {};
    invoiceHeaders.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    if(!obj.status) obj.status = 'open';
    return obj;
  });

  const customerHeaders = customersData[0];
  const customers = customersData.slice(1).map(row => {
    let obj = {};
    customerHeaders.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });

  return { invoices, customers };
}
