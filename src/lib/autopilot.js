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
  
  // 1. DESKTOP ONLY 6-COLUMN TABLE (spacious and clear on wide screens)
  html += `<table class="desktop-only-table" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">`;
  html += `<thead>
    <tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
      <th width="15%" style="padding: 10px 8px; border-bottom: 1px solid #cbd5e1;">Date</th>
      <th width="18%" style="padding: 10px 8px; border-bottom: 1px solid #cbd5e1;">Invoice No</th>
      <th width="17%" style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #cbd5e1;">Gross Invoice</th>
      <th width="14%" style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #cbd5e1;">GST</th>
      <th width="18%" style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #cbd5e1;">Net Value</th>
      <th width="18%" style="padding: 10px 8px; border-bottom: 1px solid #cbd5e1;">Category</th>
    </tr>
  </thead>`;
  html += `<tbody>`;
  
  let subtotal = 0;
  invoices.forEach(inv => {
    const gross = cleanAmount(inv['Gross Invoice']);
    const gst = cleanAmount(inv['GST']);
    const net = cleanAmount(inv['Net Invoice Value'] || inv['Invoice amount']);
    subtotal += net;
    
    html += `<tr style="border-bottom: 1px solid #e2e8f0; color: #0f172a;">
      <td width="15%" style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; word-break: break-word;">${inv['Date'] || inv['Invoice date'] || inv.Date}</td>
      <td width="18%" style="padding: 10px 8px; font-weight: 600; color: #2563eb; border-bottom: 1px solid #e2e8f0; word-break: break-all;">${inv['Invoice No'] || inv['Invoice number']}</td>
      <td width="17%" style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${formatCurrency(gross)}</td>
      <td width="14%" style="padding: 10px 8px; text-align: right; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${formatCurrency(gst)}</td>
      <td width="18%" style="padding: 10px 8px; text-align: right; color: #dc2626; font-weight: 700; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${formatCurrency(net)}</td>
      <td width="18%" style="padding: 10px 8px; color: #475569; border-bottom: 1px solid #e2e8f0; word-break: break-word;">${inv['Category'] || ''}</td>
    </tr>`;
  });
  html += `</tbody>`;
  html += `</table>`;
  
  // 2. MOBILE ONLY 3-COLUMN "DOUBLE-DECKER" TABLE (hidden on desktop, beautiful on mobile screens)
  html += `<table class="mobile-only-table" cellpadding="0" cellspacing="0" border="0" style="display: none; width: 100%; max-height: 0; overflow: hidden; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px;">`;
  html += `<thead>
    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; color: #1e293b; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
      <th width="35%" style="padding: 10px 8px; border-bottom: 1px solid #cbd5e1;">Invoice / Date</th>
      <th width="30%" style="padding: 10px 8px; border-bottom: 1px solid #cbd5e1;">Cat / GST</th>
      <th width="35%" style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #cbd5e1;">Gross / Net</th>
    </tr>
  </thead>`;
  html += `<tbody>`;
  
  let rowIndex = 0;
  invoices.forEach(inv => {
    const gross = cleanAmount(inv['Gross Invoice']);
    const gst = cleanAmount(inv['GST']);
    const net = cleanAmount(inv['Net Invoice Value'] || inv['Invoice amount']);
    const rowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
    rowIndex++;
    
    html += `<tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0; color: #0f172a;">
      <td width="35%" style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <div style="margin-bottom: 4px;">
          <span style="display: inline-block; padding: 2px 6px; background-color: #eff6ff; color: #1e40af; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid #dbeafe; word-break: break-all;">${inv['Invoice No'] || inv['Invoice number']}</span>
        </div>
        <div style="font-size: 10px; color: #64748b; font-weight: 500;">${inv['Date'] || inv['Invoice date'] || inv.Date}</div>
      </td>
      <td width="30%" style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <div style="margin-bottom: 4px; line-height: 1.2;">
          <span style="display: inline-block; width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; margin-right: 4px; vertical-align: middle;"></span>
          <span style="font-weight: 600; color: #334155; vertical-align: middle; font-size: 11px; word-break: break-word;">${inv['Category'] || 'General'}</span>
        </div>
        <div style="font-size: 10px; color: #64748b;">GST: ${formatCurrency(gst)}</div>
      </td>
      <td width="35%" style="padding: 12px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <div style="font-size: 10px; color: #64748b;">Gross: ${formatCurrency(gross)}</div>
        <div style="font-weight: 800; color: #b91c1c; font-size: 13px; margin-top: 4px; white-space: nowrap;">${formatCurrency(net)}</div>
      </td>
    </tr>`;
  });
  html += `</tbody>`;
  html += `</table>`;
  
  // Specific Subtotal Below Table
  html += `<div class="subtotal-container" style="text-align: right; margin-top: 10px; font-size: 13px; color: #0f172a; font-weight: 700;">
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

  // Wrap in a stunning, premium HTML email wrapper with dynamic styling and Outlook MSO support
  const emailWrapper = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style type="text/css">
          .mobile-only-table {
            display: none !important;
            mso-hide: all !important; /* Outlook Desktop hide */
            overflow: hidden !important;
            width: 0 !important;
            max-height: 0 !important;
          }
          @media only screen and (max-width: 599px) {
            .desktop-only-table {
              display: none !important;
              mso-hide: all !important;
              overflow: hidden !important;
              width: 0 !important;
              max-height: 0 !important;
            }
            .mobile-only-table {
              display: table !important;
              width: 100% !important;
              max-height: none !important;
              overflow: visible !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0;">
        <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <!--[if (gte mso 9)|(IE)]>
          <table width="600" align="center" style="border-spacing:0;font-family:sans-serif;color:#333333;" >
          <tr>
          <td style="padding:0;" >
          <![endif]-->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <div style="background-color: #1e3a8a; padding: 28px 24px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;">Outstanding Balance Reminder</h2>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${companyName}</p>
            </div>
            <!-- Body -->
            <div style="padding: 32px 24px; color: #334155; font-size: 15px; line-height: 1.6;">
              ${formattedTemplate}
              
              <!-- Footer unique block to prevent Gmail quoting/thread collapse -->
              <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Statement Ref: STAT-${Math.random().toString(36).substr(2, 9).toUpperCase()} &nbsp;•&nbsp; Generated: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})}
              </div>
            </div>
          </div>
          <!--[if (gte mso 9)|(IE)]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </div>
      </body>
    </html>
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

