-- Run these commands in your Supabase SQL Editor to disable Row Level Security (RLS)
-- This will allow your app's frontend client to successfully save and read invoices, customers, and sent history.

ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sent_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;
