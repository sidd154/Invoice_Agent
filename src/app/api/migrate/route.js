import { Client } from 'pg';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:221001154%40Siddhanth@db.acbymfzwsugaxrnvqrsh.supabase.co:5432/postgres";
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Create Agent Mappings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_mappings (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(255) UNIQUE NOT NULL,
        agent_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert Default Agent Mappings
    await client.query(`
      INSERT INTO agent_mappings (agent_name, agent_email)
      VALUES 
        ('Baiju', 'baiju@pixel-studios.com'),
        ('Charan', 'charan@pixel-studios.com')
      ON CONFLICT (agent_name) DO NOTHING;
    `);

    // Update Default Email templates
    const firstNotice = `<p style="font-family: sans-serif; color: #111;">Dear <strong>{{customer_name}}</strong>,</p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">This is a statement of outstanding invoices on your account. As of today, your total outstanding net balance is <strong>{{total_pending}}</strong>.</p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">Below is the detailed breakdown of your outstanding payments, split by invoice type:</p>\n\n{{invoice_table}}\n\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">Please arrange for payment at your earliest convenience to keep your account in good standing.</p>\n<br>\n<p style="font-family: sans-serif; color: #555;">Best regards,<br><strong style="color: #111;">{{company_name}}</strong></p>`;
    
    await client.query(`
      UPDATE email_templates 
      SET first_notice = $1 
      WHERE id = 1;
    `, [firstNotice]);

    // Ensure the customer email column type is text to handle long lists of email addresses
    await client.query(`
      ALTER TABLE customers ALTER COLUMN email TYPE TEXT;
    `);

    return NextResponse.json({ success: true, message: 'Database migrated, agent mappings table initialized, and customer email column altered to TEXT successfully!' });
  } catch (error) {
    console.error('Migration Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
