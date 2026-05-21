import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_7yMQUyLv_75aMdQZ9GT2WcMyp2kZPg58e');

function parseEmails(emailString) {
  if (!emailString || typeof emailString !== 'string') return [];
  return emailString
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export async function POST(req) {
  try {
    const { to, cc, subject, htmlContent, companyName } = await req.json();

    const senderName = companyName || 'Billing Department';
    const toEmails = parseEmails(to);
    const ccEmails = cc ? parseEmails(cc) : [];

    if (toEmails.length === 0) {
      return NextResponse.json({ error: { message: "No valid recipient email address found." } }, { status: 400 });
    }

    const emailPayload = {
      from: `${senderName} <billing@pixelsoft.in>`,
      to: toEmails,
      subject: subject,
      html: htmlContent,
    };

    if (ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const data = await resend.emails.send(emailPayload);

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
