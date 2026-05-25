import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export async function POST(req) {
  try {
    const { to, cc, subject, htmlContent } = await req.json();

    // Fetch the active settings from Supabase
    const { data: settingsList } = await supabase.from('global_settings').select('*').eq('id', 1);
    const settings = settingsList?.[0];

    if (!settings) {
      return NextResponse.json({ error: { message: "System settings not initialized in Supabase." } }, { status: 400 });
    }

    const toEmails = parseEmails(to);
    const ccEmails = cc ? parseEmails(cc) : [];

    if (toEmails.length === 0) {
      return NextResponse.json({ error: { message: "No valid recipient email address found." } }, { status: 400 });
    }

    // Dispatch via centralized helper (respecting either Resend or SMTP settings)
    const mailResult = await sendEmail({
      to: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : null,
      subject: subject,
      html: htmlContent,
      settings: settings
    });

    return NextResponse.json({ success: true, data: mailResult });
  } catch (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
