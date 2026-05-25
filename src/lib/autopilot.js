import { createClient } from '@supabase/supabase-js';
import { fetchSheetsData } from '@/lib/sheets';
import { sendEmail } from './mail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const cleanAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0;
};

const formatCurrency = (amount) => {
  const numeric = typeof amount === 'number' ? amount : cleanAmount(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
};

function parseEmails(emailString) {
  if (!emailString || typeof emailString !== 'string') return [];
  return emailString
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

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
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Statement of Account</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em;">${companyName}</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          ${formattedTemplate}
        </div>
      </div>
    </div>
  `;

  return emailWrapper;
}

export async function runAutopilotReminders() {
  // Fetch configurations
  const { data: settingsList } = await supabase.from('global_settings').select('*').eq('id', 1);
  const settings = settingsList?.[0];
  
  if (!settings) {
    throw new Error('System settings not initialized');
  }

  if (!settings.auto_pilot) {
    return { success: true, message: 'Auto-pilot is disabled.' };
  }

  // Time & Day matching in Asia/Kolkata timezone
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const kolkataDate = new Date(kolkataStr);

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentWeekday = weekdays[kolkataDate.getDay()];
  const currentHour = kolkataDate.getHours().toString().padStart(2, '0');
  const currentMinute = kolkataDate.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;

  const scheduleDays = Array.isArray(settings.schedule_days) ? settings.schedule_days : ['Monday'];
  const scheduleTime = settings.schedule_time || '11:00';

  const isScheduledDay = scheduleDays.includes(currentWeekday);
  const isScheduledTime = currentTime === scheduleTime;

  const lastRunDateStr = settings.last_autopilot_run ? new Date(settings.last_autopilot_run).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }).split(',')[0] : null;
  const todayDateStr = kolkataStr.split(',')[0];
  const alreadyRunToday = lastRunDateStr === todayDateStr;

  if (!isScheduledDay || !isScheduledTime || alreadyRunToday) {
    return { success: true, message: 'Not scheduled for this minute or already run today.' };
  }

  console.log(`[Inbuilt Autopilot] Current scheduled slot matched! Day: ${currentWeekday}, Time: ${currentTime}. Triggering execution...`);

  // Fetch latest data from Google Sheets & Upsert
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

  // Fetch the templates from the database
  const [tempRes] = await Promise.all([
    supabase.from('email_templates').select('*').eq('id', 1)
  ]);

  const templates = tempRes.data?.[0];

  if (!templates) {
    throw new Error('Templates not initialized');
  }

  // Evaluate and process automated open invoice reminders
  const openInvoices = invoices.filter(i => i.status?.toLowerCase() === 'open');
  const groupedInvoices = {};
  
  openInvoices.forEach(inv => {
    if (!inv.Customer) return;
    if (!groupedInvoices[inv.Customer]) {
      groupedInvoices[inv.Customer] = [];
    }
    groupedInvoices[inv.Customer].push(inv);
  });

  const ccEmails = settings.cc_emails ? parseEmails(settings.cc_emails) : [];
  const sentEmails = [];

  for (const customerName of Object.keys(groupedInvoices)) {
    const customerData = customers.find(c => c['Customer Name'] === customerName);
    if (customerData) {
      const customerOpenInvoices = groupedInvoices[customerName];
      const toEmails = parseEmails(customerData['Email ID']);

      if (toEmails.length > 0) {
        const compiledHtml = compileEmailHtml(
          customerData, 
          customerOpenInvoices, 
          templates.first_notice, 
          null, 
          settings.company_name
        );

        try {
          // Send email using the unified mail helper (SMTP or Resend)
          await sendEmail({
            to: toEmails,
            cc: ccEmails.length > 0 ? ccEmails : null,
            subject: `Statement of Account - ${customerName}`,
            html: compiledHtml,
            settings: settings
          });

          // Log sent record
          const newRecord = {
            id: Math.random().toString(36).substr(2, 9),
            customer_name: customerName,
            email: customerData['Email ID'],
            type: 'Automated Reminder',
            sent_at: new Date().toISOString(),
            invoice_ids: customerOpenInvoices.map(i => i['Invoice number'])
          };
          await supabase.from('sent_history').insert(newRecord);
          sentEmails.push({ customer: customerName, email: customerData['Email ID'] });
        } catch (err) {
          console.error(`Autopilot email dispatch failed for ${customerName}:`, err);
        }

        // Wait 5 seconds before sending the next email to process them one-by-one
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.warn(`No valid emails resolved for customer: ${customerName}`);
      }
    } else {
      console.warn(`Customer contact not found for open invoices under client name: ${customerName}`);
    }
  }

  // Update last run timestamp in the database to mark this slot as successfully processed
  await supabase.from('global_settings').update({ last_autopilot_run: new Date().toISOString() }).eq('id', 1);

  return {
    success: true,
    emailsSent: sentEmails
  };
}
