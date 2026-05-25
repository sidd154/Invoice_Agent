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
  if (isNaN(numeric)) return amount;
  return 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
};

function parseEmails(emailString) {
  if (!emailString || typeof emailString !== 'string') return [];
  return emailString
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .filter(email => {
      const lower = email.toLowerCase();
      return !lower.includes('example.com') && !lower.includes('recipient@');
    });
}

function generateTypeTableHtml(type, invoices) {
  if (!invoices || invoices.length === 0) return '';
  
  let html = `<div style="margin-top: 24px; margin-bottom: 28px;">`;
  html += `<h3 style="font-size: 15px; font-weight: 700; color: #1e3a8a; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.025em;">${type}s</h3>`;
  html += `<table style="width:100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;
  
  // Table Headers
  html += `<tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
    <th style="padding: 10px 12px;">Date</th>
    <th style="padding: 10px 12px;">Invoice No</th>
    <th style="padding: 10px 12px; text-align: right;">Gross Invoice</th>
    <th style="padding: 10px 12px; text-align: right;">GST</th>
    <th style="padding: 10px 12px; text-align: right;">Net Value</th>
    <th style="padding: 10px 12px;">Category</th>
  </tr>`;
  
  // Table Rows
  let subtotal = 0;
  invoices.forEach(inv => {
    const gross = cleanAmount(inv['Gross Invoice']);
    const gst = cleanAmount(inv['GST']);
    const net = cleanAmount(inv['Net Invoice Value'] || inv['Invoice amount']);
    subtotal += net;
    
    html += `<tr style="border-bottom: 1px solid #e2e8f0; color: #0f172a;">
      <td style="padding: 10px 12px; white-space: nowrap;">${inv['Date'] || inv['Invoice date'] || inv.Date}</td>
      <td style="padding: 10px 12px; font-weight: 600; color: #2563eb;">${inv['Invoice No'] || inv['Invoice number']}</td>
      <td style="padding: 10px 12px; text-align: right;">${formatCurrency(gross)}</td>
      <td style="padding: 10px 12px; text-align: right; color: #475569;">${formatCurrency(gst)}</td>
      <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-weight: 700;">${formatCurrency(net)}</td>
      <td style="padding: 10px 12px; color: #475569;">${inv['Category'] || ''}</td>
    </tr>`;
  });
  
  html += `</table>`;
  
  // Specific Subtotal Below Table
  html += `<div style="text-align: right; margin-top: 10px; font-size: 13px; color: #0f172a; font-weight: 700;">
    Subtotal ${type} Net: <span style="color: #dc2626; font-size: 14px;">${formatCurrency(subtotal)}</span>
  </div>`;
  html += `</div>`;
  
  return html;
}

function compileEmailHtml(customer, customerInvoices, templateStr, lastSentDate = null, companyName = "Enterprise Finance") {
  const pendingAmount = customerInvoices.reduce((acc, curr) => acc + cleanAmount(curr['Net Invoice Value'] || curr['Invoice amount']), 0);
  
  // Group by Invoice Type
  const groupedByType = {};
  customerInvoices.forEach(inv => {
    let type = (inv['Invoice Type'] || 'Tax Invoice').trim();
    if (!groupedByType[type]) {
      groupedByType[type] = [];
    }
    groupedByType[type].push(inv);
  });
  
  // Generate HTML for each type
  let tablesHtml = '';
  Object.keys(groupedByType).sort().forEach(type => {
    tablesHtml += generateTypeTableHtml(type, groupedByType[type]);
  });
  
  // Replace placeholders
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
    .replace(/\{\{invoice_table_placeholder\}\}/g, tablesHtml);

  // Wrap in a stunning, premium HTML email wrapper with dynamic styling
  const emailWrapper = `
    <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background-color: #1e3a8a; padding: 28px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;">Outstanding Balance Reminder</h2>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${companyName}</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px; color: #334155; font-size: 15px; line-height: 1.6;">
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

  const todayDateStr = kolkataStr.split(',')[0];
  
  let alreadyRunThisSlot = false;
  if (settings.last_autopilot_run) {
    const lastRunKolkata = new Date(settings.last_autopilot_run).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const lastRunDateStr = lastRunKolkata.split(',')[0];
    
    // Parse time in 24hr format
    const timePart = lastRunKolkata.split(', ')[1]; // e.g. "5:30:00 PM"
    if (timePart) {
      const parts = timePart.split(' ')[0].split(':');
      let hr = parseInt(parts[0]);
      const min = parts[1];
      const period = timePart.split(' ')[1]; // AM or PM
      if (period === 'PM' && hr < 12) hr += 12;
      if (period === 'AM' && hr === 12) hr = 0;
      const lastRunTime = `${hr.toString().padStart(2, '0')}:${min}`;
      
      alreadyRunThisSlot = (lastRunDateStr === todayDateStr) && (lastRunTime === currentTime);
    }
  }

  if (!isScheduledDay || !isScheduledTime || alreadyRunThisSlot) {
    return { success: true, message: 'Not scheduled for this minute or already run this slot.' };
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

  // Fetch templates and agent mappings
  const [tempRes, mappingsRes] = await Promise.all([
    supabase.from('email_templates').select('*').eq('id', 1),
    supabase.from('agent_mappings').select('*')
  ]);

  const templates = tempRes.data?.[0];
  const mappingsList = mappingsRes.data || [];

  if (!templates) {
    throw new Error('Templates not initialized');
  }

  // Create quick lookup map for agent name to email
  const agentEmails = {};
  mappingsList.forEach(m => {
    if (m.agent_name && m.agent_email) {
      agentEmails[m.agent_name.toLowerCase().trim()] = m.agent_email.trim();
    }
  });

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

  const globalCcEmails = settings.cc_emails ? parseEmails(settings.cc_emails) : [];
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

        // Resolve custom agent CC emails based on "me" column
        const uniqueAgents = [...new Set(
          customerOpenInvoices
            .map(inv => (inv.me || inv.raw_data?.me || '').trim())
            .filter(Boolean)
        )];
        const agentCcs = uniqueAgents.map(a => agentEmails[a.toLowerCase()]).filter(Boolean);
        const mergedCcs = [...new Set([...globalCcEmails, ...agentCcs])];

        try {
          // Send email using the unified mail helper (SMTP or Resend)
          await sendEmail({
            to: toEmails,
            cc: mergedCcs.length > 0 ? mergedCcs : null,
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

