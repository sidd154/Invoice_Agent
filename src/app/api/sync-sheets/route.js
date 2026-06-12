import { fetchSheetsData } from '@/lib/sheets';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { invoices, customers } = await fetchSheetsData();

    console.log(`[Server Sync] Fetched ${invoices.length} invoices and ${customers.length} customers. Syncing to DB...`);

    // 1. Wipe existing invoices and customers from Supabase (server-side, bypasses RLS)
    await Promise.all([
      supabase.from('invoices').delete().neq('id', 0),
      supabase.from('customers').delete().neq('id', 0)
    ]);

    // 2. Format and insert new authoritative invoice entries (Deduplicated)
    const uniqueInvoicesMap = new Map();
    invoices.forEach(inv => {
      if (inv['Invoice number']) {
        uniqueInvoicesMap.set(inv['Invoice number'], inv);
      }
    });

    const formattedInvoices = Array.from(uniqueInvoicesMap.values()).map(inv => ({
      invoice_number: inv['Invoice number'],
      customer: inv.Customer,
      amount: inv['Invoice amount'],
      status: inv.status,
      date: inv['Invoice date'] || inv.Date,
      raw_data: inv
    }));
    
    if (formattedInvoices.length > 0) {
      const { error: invErr } = await supabase.from('invoices').insert(formattedInvoices);
      if (invErr) {
        throw new Error(`Failed to insert invoices into Supabase: ${invErr.message}`);
      }
    }

    // 3. Format and insert new authoritative customer entries (Deduplicated)
    const uniqueCustomersMap = new Map();
    customers.forEach(c => {
      const nameVal = c['Customer Name'] || c.name || '';
      if (nameVal) {
        uniqueCustomersMap.set(nameVal, c);
      }
    });

    const formattedCustomers = Array.from(uniqueCustomersMap.values()).map(c => {
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

    if (formattedCustomers.length > 0) {
      const { error: custErr } = await supabase.from('customers').insert(formattedCustomers);
      if (custErr) {
        throw new Error(`Failed to insert customers into Supabase: ${custErr.message}`);
      }
    }

    console.log(`[Server Sync] Database sync completed successfully!`);

    return NextResponse.json({ success: true, invoices, customers });
  } catch (error) {
    console.error('[Server Sync] Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
