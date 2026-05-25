import { NextResponse } from 'next/server';
import { testSmtpConnection } from '@/lib/mail';

export async function POST(req) {
  try {
    const { host, port, secure, user, pass, fromEmail } = await req.json();

    if (!host || !port || !user || !pass) {
      return NextResponse.json({ 
        error: { message: "All SMTP parameters (Host, Port, Username, and Password) are required to perform a test." } 
      }, { status: 400 });
    }

    const result = await testSmtpConnection({
      host,
      port: parseInt(port),
      secure: secure === true || secure === 'true',
      user,
      pass,
      fromEmail
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[SMTP Tester API] Connection Test failed:", error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
