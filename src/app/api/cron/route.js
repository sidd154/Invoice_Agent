import { createClient } from '@supabase/supabase-js';
import { fetchSheetsData } from '@/lib/sheets';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY || 're_7yMQUyLv_75aMdQZ9GT2WcMyp2kZPg58e');

const cleanAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0;
};

const formatCurrency = (amount) => {
  const numeric = typeof amount === 'number' ? amount : cleanAmount(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
};

function compileEmailHtml(customer, customerInvoices, templateStr, lastSentDate = null, companyName = "Enterprise Finance") {
  const pendingAmount = customerInvoices.reduce((acc, curr) => acc + cleanAmount(curr['Invoice amount']), 0);
  
  // 1. Compile the invoice table HTML beautifully
  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;
  tableHtml += `<tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; font-weight: 700;">
    <th style="padding: 12px 16px;">Date</th>
    <th style="padding: 12px 16px;">Invoice Number</th>
    <th style="padding: 12px 16px; text-align: right;">Amount</th>
  </tr>`;
  
  customerInvoices.forEach(inv => {
    tableHtml += `<tr style="border-bottom: 1px solid #e2e8f0; color: #0f172a;">
      <td style="padding: 12px 16px;">${inv['Invoice date'] || inv.Date}</td>
      <td style="padding: 12px 16px; font-weight: 600; color: #2563eb;">${inv['Invoice number']}</td>
      <td style="padding: 12px 16px; text-align: right; color: #dc2626; font-weight: 700;">${formatCurrency(inv['Invoice amount'])}</td>
    </tr>`;
  });
  tableHtml += `</table>`;

  // 2. Escape HTML and format the plain text template to HTML by replacing newlines with <br>
  let formattedTemplate = templateStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{\{customer_name\}\}/g, `<strong>${customer['Customer Name']}</strong>`)
    .replace(/\{\{company_name\}\}/g, `<strong>${companyName}</strong>`)
    .replace(/\{\{total_pending\}\}/g, `<strong style="color: #dc2626; font-size: 16px;">${formatCurrency(pendingAmount)}</strong>`)
    .replace(/\{\{last_sent_date\}\}/g, lastSentDate ? `<strong>${new Date(lastSentDate).toLocaleDateString()}</strong>` : '')
    .replace(/\{\{invoice_table\}\}/g, '{{invoice_table_placeholder}}')
    .replace(/\n/g, '<br>')
    .replace(/\{\{invoice_table_placeholder\}\}/g, tableHtml);

  // 3. Wrap in a stunning, premium HTML email wrapper with dynamic styling
  const emailWrapper = `
    <div style="background-color: #f3f4f6; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-w: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
        <!-- Header -->
        <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Outstanding Balance Notice</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em;">${companyName}</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          ${formattedTemplate}
        </div>
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.5;">
          This is an automated transaction message from the billing department of <strong>${companyName}</strong>.<br>
          If you have any questions or have already made this payment, please feel free to reply directly to this email.
        </div>
      </div>
    </div>
  `;

  return emailWrapper;
}

export async function GET(req) {
  try {
    // 1. Authorization check for Vercel Cron
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch configurations
    const { data: settingsList } = await supabase.from('global_settings').select('*').eq('id', 1);
    const settings = settingsList?.[0];
    
    if (!settings) {
      return NextResponse.json({ error: 'System settings not initialized' }, { status: 500 });
    }

    if (!settings.auto_pilot) {
      return NextResponse.json({ message: 'Auto-pilot is disabled in settings. Skipping cron run.' });
    }

    // 3. Fetch latest data from Google Sheets & Upsert
    const { invoices, customers } = await fetchSheetsData();

    const formattedInvoices = invoices.map(inv => ({
      invoice_number: inv['Invoice number'],
      customer: inv.Customer,
      amount: inv['Invoice amount'],
      status: inv.status,
      date: inv['Invoice date'] || inv.Date,
      raw_data: inv
    }));
    await supabase.from('invoices').upsert(formattedInvoices, { onConflict: 'invoice_number' });

    const formattedCustomers = customers.map(c => ({
      name: c['Customer Name'],
      email: c['Email ID'],
      raw_data: c
    }));
    await supabase.from('customers').upsert(formattedCustomers, { onConflict: 'name' });

    // 4. Fetch the database state for sent history and templates
    const [histRes, tempRes] = await Promise.all([
      supabase.from('sent_history').select('*').order('sent_at', { ascending: false }),
      supabase.from('email_templates').select('*').eq('id', 1)
    ]);

    const sentHistory = histRes.data || [];
    const templates = tempRes.data?.[0];

    if (!templates) {
      return NextResponse.json({ error: 'Templates not initialized' }, { status: 500 });
    }

    // 5. Evaluate and process automated follow-ups
    const now = new Date().getTime();
    const thresholdMs = (settings.follow_up_interval || 10) * 24 * 60 * 60 * 1000;
    const sentEmails = [];

    for (const record of sentHistory) {
      const elapsed = now - new Date(record.sent_at).getTime();
      
      // If a standard notice has been sent, and the threshold of days has passed
      if (elapsed > thresholdMs) {
        // Find if they have open invoices
        const customerOpenInvoices = invoices.filter(i => i.Customer === record.customer_name && i.status?.toLowerCase() === 'open');
        
        if (customerOpenInvoices.length > 0) {
          // Check if we've already sent an automated follow-up for this customer in this cycle
          const alreadyFollowedUp = sentHistory.some(h => h.customer_name === record.customer_name && h.type === 'Follow-Up' && new Date(h.sent_at).getTime() > new Date(record.sent_at).getTime());
          
          if (!alreadyFollowedUp) {
            const customerData = customers.find(c => c['Customer Name'] === record.customer_name);
            if (customerData) {
              const compiledHtml = compileEmailHtml(customerData, customerOpenInvoices, templates.follow_up, record.sent_at, settings.company_name);
              
              // Send email using Resend
              const mailRes = await resend.emails.send({
                from: `${settings.company_name || 'Billing Department'} <billing@pixelsoft.in>`,
                to: [customerData['Email ID']],
                subject: `URGENT: Follow-up on Overdue Invoices - ${record.customer_name}`,
                html: compiledHtml,
              });

              if (!mailRes.error) {
                // Log sent record
                const newRecord = {
                  id: Math.random().toString(36).substr(2, 9),
                  customer_name: record.customer_name,
                  email: customerData['Email ID'],
                  type: 'Follow-Up',
                  sent_at: new Date().toISOString(),
                  invoice_ids: customerOpenInvoices.map(i => i['Invoice number'])
                };
                await supabase.from('sent_history').insert(newRecord);
                sentEmails.push({ customer: record.customer_name, email: customerData['Email ID'] });
              } else {
                console.error(`Resend failed for ${record.customer_name}:`, mailRes.error);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed automated cron run successfully.`,
      emailsSent: sentEmails
    });

  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
