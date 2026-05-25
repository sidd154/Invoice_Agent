import { Resend } from 'resend';
import nodemailer from 'nodemailer';

/**
 * Centered email dispatching utility that dynamically selects between Resend and SMTP
 */
export async function sendEmail({ to, cc, subject, html, settings }) {
  const provider = settings?.email_service_provider || 'resend';
  
  if (provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: settings.smtp_secure === true || settings.smtp_secure === 'true',
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
      tls: {
        rejectUnauthorized: false // Bypasses self-signed certificate constraints for custom domains
      }
    });

    const mailOptions = {
      from: `${settings.company_name || 'Billing Department'} <${settings.smtp_from_email || settings.smtp_user}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      replyTo: 'accounts@pixel-studios.com',
      subject: subject,
      html: html,
    };

    if (cc) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } else {
    // Fallback to Resend
    const resend = new Resend(process.env.RESEND_API_KEY || 're_7yMQUyLv_75aMdQZ9GT2WcMyp2kZPg58e');
    
    const emailPayload = {
      from: `${settings?.company_name || 'Billing Department'} <billing@pixelsoft.in>`,
      to: Array.isArray(to) ? to : [to],
      reply_to: 'accounts@pixel-studios.com',
      subject: subject,
      html: html,
    };

    if (cc) {
      emailPayload.cc = Array.isArray(cc) ? cc : [cc];
    }

    const data = await resend.emails.send(emailPayload);
    if (data.error) {
      throw new Error(data.error.message || 'Resend API error occurred');
    }
    return { success: true, data };
  }
}

/**
 * Tests SMTP credentials and sends a confirmation test email to the user
 */
export async function testSmtpConnection({ host, port, secure, user, pass, fromEmail }) {
  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port) || 587,
    secure: secure === true || secure === 'true',
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify connection handshake
  await transporter.verify();

  // Dispatch live confirmation test email to the authenticated user
  const mailOptions = {
    from: `SMTP Tester <${fromEmail || user}>`,
    to: user,
    subject: 'SMTP Connection Test - Success! 🎉',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; margin: 30px auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background-color: #d1fae5; color: #065f46; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 12px; border-radius: 9999px;">
            Connection Success
          </span>
        </div>
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 10px; margin-bottom: 8px; text-align: center;">SMTP Configuration Active!</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 24px;">Your SMTP credentials have been authenticated successfully. The Invoice Agent is now ready to dispatch automated statement summaries.</p>
        <div style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; font-size: 13px; color: #334155; line-height: 1.8;">
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 6px;"><strong>SMTP Host:</strong> <code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${host}</code></div>
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 6px;"><strong>SMTP Port:</strong> <code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${port}</code></div>
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 6px;"><strong>Secure (SSL/TLS):</strong> <code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${secure ? 'Yes' : 'No'}</code></div>
          <div><strong>Sender Identity:</strong> <code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${fromEmail || user}</code></div>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px; margin-bottom: 0;">This email was sent automatically to verify your SMTP connection.</p>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}
