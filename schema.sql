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
  auto_pilot BOOLEAN DEFAULT FALSE,
  cc_emails VARCHAR(255),
  email_service_provider VARCHAR(50) DEFAULT 'resend',
  smtp_host VARCHAR(255),
  smtp_port INT,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,
  smtp_secure BOOLEAN DEFAULT TRUE,
  smtp_from_email VARCHAR(255),
  schedule_days JSONB DEFAULT '["Monday"]'::jsonb,
  schedule_time VARCHAR(10) DEFAULT '11:00',
  last_autopilot_run TIMESTAMP WITH TIME ZONE
);

-- 5. Create Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id INT PRIMARY KEY,
  first_notice TEXT,
  follow_up TEXT
);

-- 6. Create Agent Mappings Table
CREATE TABLE IF NOT EXISTS agent_mappings (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(255) UNIQUE NOT NULL,
  agent_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Insert Default Settings
INSERT INTO global_settings (id, follow_up_interval, company_name, auto_pilot)
VALUES (1, 10, 'PixelSoft Finance', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Default Agent Mappings
INSERT INTO agent_mappings (agent_name, agent_email)
VALUES 
  ('Baiju', 'baiju@pixel-studios.com'),
  ('Charan', 'charan@pixel-studios.com')
ON CONFLICT (agent_name) DO NOTHING;

-- 9. Insert Default Templates
INSERT INTO email_templates (id, first_notice, follow_up)
VALUES (
  1, 
  'Dear {{customer_name}},\n\nPlease find below the summary of your current outstanding invoices:\n\n{{invoice_table}}\n\nTotal Outstanding: {{total_pending}}\n\nFor any clarification or reconciliation, feel free to reach out.\n\nRegards,\nFinance Team\n{{company_name}}', 
  'Dear {{customer_name}},\n\nPlease find below the summary of your current outstanding invoices:\n\n{{invoice_table}}\n\nTotal Outstanding: {{total_pending}}\n\nFor any clarification or reconciliation, feel free to reach out.\n\nRegards,\nFinance Team\n{{company_name}}'
)
ON CONFLICT (id) DO NOTHING;

