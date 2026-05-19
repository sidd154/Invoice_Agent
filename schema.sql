-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  customer VARCHAR(255),
  amount VARCHAR(255),
  status VARCHAR(255),
  date VARCHAR(255),
  raw_data JSONB
);

-- 2. Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  raw_data JSONB
);

-- 3. Create Sent History Table
CREATE TABLE IF NOT EXISTS sent_history (
  id VARCHAR(255) PRIMARY KEY,
  customer_name VARCHAR(255),
  email VARCHAR(255),
  type VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE,
  invoice_ids JSONB
);

-- 4. Create Global Settings Table
CREATE TABLE IF NOT EXISTS global_settings (
  id INT PRIMARY KEY,
  follow_up_interval INT,
  company_name VARCHAR(255),
  auto_pilot BOOLEAN DEFAULT FALSE
);

-- 5. Create Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id INT PRIMARY KEY,
  first_notice TEXT,
  follow_up TEXT
);

-- 6. Insert Default Settings
INSERT INTO global_settings (id, follow_up_interval, company_name, auto_pilot)
VALUES (1, 10, 'PixelSoft Finance', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Default Templates
INSERT INTO email_templates (id, first_notice, follow_up)
VALUES (
  1, 
  '<p style="font-family: sans-serif; color: #111;">Dear <strong>{{customer_name}}</strong>,</p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">This is a friendly reminder regarding pending invoices on your account. Below is a detailed summary of your outstanding payments:</p>\n\n{{invoice_table}}\n\n<p style="font-family: sans-serif; color: #111; font-size: 16px;"><strong>Total Pending Amount: <span style="color: #dc2626;">{{total_pending}}</span></strong></p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">Please arrange for payment at your earliest convenience to keep your account in good standing.</p>\n<br>\n<p style="font-family: sans-serif; color: #555;">Best regards,<br><strong style="color: #111;">{{company_name}}</strong></p>', 
  '<p style="font-family: sans-serif; color: #111;">Dear <strong>{{customer_name}}</strong>,</p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">This is an urgent follow-up regarding your outstanding balance. We previously reached out on <strong>{{last_sent_date}}</strong>.</p>\n\n{{invoice_table}}\n\n<p style="font-family: sans-serif; color: #111; font-size: 16px;"><strong>Total Pending Amount: <span style="color: #dc2626;">{{total_pending}}</span></strong></p>\n<p style="font-family: sans-serif; color: #333; line-height: 1.5;">If you have already processed this payment, please reply to this email with the transaction details.</p>\n<br>\n<p style="font-family: sans-serif; color: #555;">Best regards,<br><strong style="color: #111;">{{company_name}}</strong></p>'
)
ON CONFLICT (id) DO NOTHING;
