import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_7yMQUyLv_75aMdQZ9GT2WcMyp2kZPg58e');

export async function POST(req) {
  try {
    const { to, subject, htmlContent, companyName } = await req.json();

    const senderName = companyName || 'Billing Department';

    const data = await resend.emails.send({
      from: `${senderName} <billing@pixelsoft.in>`,
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
