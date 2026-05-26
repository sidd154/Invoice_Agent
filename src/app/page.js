'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, LogIn, LayoutDashboard, FileText, Users, Send, History, 
  Clock, Settings, Briefcase, ChevronRight, Search, DollarSign, 
  AlertCircle, Activity, Plus, CheckCircle2, Bell, Eye, LogOut,
  SendHorizontal
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const cleanAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0;
};

const DEFAULT_TEMPLATES = {
  firstNotice: `Dear {{customer_name}},\n\nThis is a friendly reminder regarding pending invoices on your account. Below is a detailed summary of your outstanding payments:\n\n{{invoice_table}}\n\nTotal Pending Amount: {{total_pending}}\n\nPlease arrange for payment at your earliest convenience to keep your account in good standing.\n\nBest regards,\n{{company_name}}`,
  followUp: `Dear {{customer_name}},\n\nThis is an urgent follow-up regarding your outstanding balance. We previously reached out on {{last_sent_date}}.\n\n{{invoice_table}}\n\nTotal Pending Amount: {{total_pending}}\n\nIf you have already processed this payment, please reply to this email with the transaction details.\n\nBest regards,\n{{company_name}}`
};

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App Data State
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sentHistory, setSentHistory] = useState([]);
  const [agentMappings, setAgentMappings] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [settings, setSettings] = useState({ followUpInterval: 10, companyName: 'Enterprise Finance', ccEmails: '' });
  const [dataExists, setDataExists] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('pixelAuth');
    if (auth === 'true') setIsLoggedIn(true);
    
    const initData = async () => {
      try {
        const [invRes, custRes, histRes, setRes, tempRes, mappingsRes] = await Promise.all([
          supabase.from('invoices').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('sent_history').select('*').order('sent_at', { ascending: false }),
          supabase.from('global_settings').select('*').eq('id', 1),
          supabase.from('email_templates').select('*').eq('id', 1),
          supabase.from('agent_mappings').select('*')
        ]);

        if (invRes.data && invRes.data.length > 0) {
          setInvoices(invRes.data.map(i => i.raw_data));
          setDataExists(true);
        }
        if (custRes.data && custRes.data.length > 0) {
          setCustomers(custRes.data.map(c => c.raw_data));
        }
        if (histRes.data && histRes.data.length > 0) {
          setSentHistory(histRes.data.map(h => ({
            id: h.id, customerName: h.customer_name, email: h.email, type: h.type, sentAt: h.sent_at, invoiceIds: h.invoice_ids
          })));
        }
        if (mappingsRes.data) {
          setAgentMappings(mappingsRes.data);
        }
        if (setRes.data && setRes.data.length > 0) {
          const s = setRes.data[0];
          setSettings({
            followUpInterval: s.follow_up_interval,
            companyName: s.company_name,
            autoPilot: s.auto_pilot,
            ccEmails: s.cc_emails || '',
            emailServiceProvider: s.email_service_provider || 'resend',
            smtpHost: s.smtp_host || '',
            smtpPort: s.smtp_port || 587,
            smtpUser: s.smtp_user || '',
            smtpPass: s.smtp_pass || '',
            smtpSecure: s.smtp_secure !== false,
            smtpFromEmail: s.smtp_from_email || '',
            scheduleDays: Array.isArray(s.schedule_days) ? s.schedule_days : ['Monday'],
            scheduleTime: s.schedule_time || '11:00'
          });
        }
        if (tempRes.data && tempRes.data.length > 0) {
          const t = tempRes.data[0];
          setTemplates({ firstNotice: t.first_notice, followUp: t.follow_up });
        }
      } catch (err) {
        console.error("Failed to load from DB:", err);
      }
      setIsLoaded(true);
    };

    initData();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin@123';
    if (username.toLowerCase() === 'admin@pixel.com' && password === expectedPassword) {
      setIsLoggedIn(true);
      localStorage.setItem('pixelAuth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('pixelAuth');
  };

  const saveData = async (newInvoices, newCustomers) => {
    setInvoices(newInvoices);
    setCustomers(newCustomers);
    setDataExists(true);

    try {
      // 1. Wipe existing invoices and customers from Supabase so deleted sheet entries are removed
      await Promise.all([
        supabase.from('invoices').delete().neq('id', 0),
        supabase.from('customers').delete().neq('id', 0)
      ]);

      // 2. Format and insert new authorative invoice entries
      const formattedInvoices = newInvoices.map(inv => ({
        invoice_number: inv['Invoice number'],
        customer: inv.Customer,
        amount: inv['Invoice amount'],
        status: inv.status,
        date: inv['Invoice date'] || inv.Date,
        raw_data: inv
      }));
      if (formattedInvoices.length > 0) {
        await supabase.from('invoices').insert(formattedInvoices);
      }

      // 3. Format and insert new authorative customer entries
      const formattedCustomers = newCustomers.map(c => {
        const emailVal = c['Email ID'] || c['Mail Id'] || c.email || '';
        const nameVal = c['Customer Name'] || c.name || '';
        return {
          name: nameVal,
          email: emailVal,
          raw_data: {
            ...c,
            'Customer Name': nameVal,
            'Email ID': emailVal,
            'Mail Id': emailVal
          }
        };
      });
      if (formattedCustomers.length > 0) {
        await supabase.from('customers').insert(formattedCustomers);
      }
    } catch(err) {
      console.error("Failed to persist data:", err);
    }
  };

  const saveHistory = async (newHistory) => {
    setSentHistory(newHistory);
    try {
      const records = newHistory.map(h => ({
        id: h.id,
        customer_name: h.customerName,
        email: h.email,
        type: h.type,
        sent_at: h.sentAt,
        invoice_ids: h.invoiceIds
      }));
      if(records.length > 0) {
        await supabase.from('sent_history').upsert(records, { onConflict: 'id' });
      }
    } catch(err) {
      console.error("Failed to save history:", err);
    }
  };

  const resetData = async () => {
    if(confirm("Are you sure you want to completely reset the CRM database?")) {
      setInvoices([]);
      setCustomers([]);
      setSentHistory([]);
      setDataExists(false);
      try {
        await supabase.from('invoices').delete().neq('id', 0);
        await supabase.from('customers').delete().neq('id', 0);
        await supabase.from('sent_history').delete().neq('id', '0');
      } catch (err) {
        console.error("Failed to wipe DB", err);
      }
    }
  };

  const handleSyncSheets = async () => {
    setIsUploading(true);
    try {
      const res = await fetch(`/api/sync-sheets?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to sync');
      
      if (data.invoices && data.customers) {
        // Overwrite logic to maintain an exact mirror of Google Sheets and clean stale data
        const newInvoices = data.invoices;
        const newCustomers = data.customers;

        await saveData(newInvoices, newCustomers);
        alert("Successfully synced with Google Sheets!");
        if(!dataExists) setActiveTab('dashboard');
      }
    } catch(err) {
      alert("Error syncing: " + err.message);
    }
    setIsUploading(false);
  };

  const formatCurrency = (val) => {
    const num = cleanAmount(val);
    if(isNaN(num)) return val;
    return 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  if (!isLoaded) return <div className="h-screen flex items-center justify-center">Loading Workspace...</div>;

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full animate-fade-up" style={{ maxWidth: '360px' }}>
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 flex items-center justify-center">
              <Briefcase className="text-primary" size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 tracking-tight">Sign in to Billing Portal</h1>
          <p className="text-muted-foreground text-center mb-8 text-sm">Welcome back to your workspace</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Email Address</label>
              <input type="email" className="input h-11" value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin@pixel.com" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Password</label>
              <input type="password" className="input h-11" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {loginError && <p className="text-destructive text-xs text-center">{loginError}</p>}
            <button type="submit" className="btn btn-primary w-full mt-4 h-11 text-sm">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  if (!dataExists) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full text-center animate-fade-up" style={{ maxWidth: '600px' }}>
          <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center m-auto mb-8">
            <Upload className="text-primary" size={28} />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Initialize Workspace</h1>
          <p className="text-muted-foreground mb-10 text-sm max-w-md mx-auto">Please upload your <b>invoice_data.xlsx</b> and <b>transactional_data.xlsx</b> to populate the CRM database.</p>
          
          <div className="flex flex-col gap-4 max-w-xs mx-auto mb-8">
            <button onClick={handleSyncSheets} disabled={isUploading} className="btn btn-primary h-12 text-sm shadow-glow font-bold w-full">
              {isUploading ? "Syncing..." : "Sync with Google Sheets"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SaaS LAYOUT ---
  return (
    <div className="layout-container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-glow">
            <Briefcase size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Billing CRM</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise Workspace</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1 mt-2">Overview</p>
          <SidebarBtn icon={<LayoutDashboard size={16}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1 mt-6">Records</p>
          <SidebarBtn icon={<FileText size={16}/>} label="Invoices" active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} />
          <SidebarBtn icon={<Users size={16}/>} label="Customers" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
          
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1 mt-6">Communication</p>
          <SidebarBtn icon={<Send size={16}/>} label="Send Queue" active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} />
          <SidebarBtn icon={<History size={16}/>} label="Sent History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1 mt-6">Settings</p>
          <SidebarBtn icon={<Settings size={16}/>} label="Settings" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} />
        </nav>
        
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
              <span className="text-xs font-bold">A</span>
            </div>
            <div>
              <p className="text-xs font-medium">Admin User</p>
              <p className="text-[10px] text-muted-foreground">Admin@pixel.com</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary w-full text-xs h-8">Sign Out</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div className="top-nav">
          <h1 className="text-sm font-medium capitalize flex items-center gap-2">
            Workspace <ChevronRight size={14} className="text-muted-foreground"/> <span className="text-foreground">{activeTab.replace('-', ' ')}</span>
          </h1>
          <div className="flex gap-3 items-center">
            <button onClick={handleSyncSheets} disabled={isUploading} className="btn btn-outline text-xs h-7 px-3 border-accent/20 text-accent hover:bg-accent/10">
              {isUploading ? "Syncing..." : "Sync Sheets"}
            </button>
          </div>
        </div>
        
        <div className="p-8 max-w-6xl mx-auto animate-fade-up">
          {activeTab === 'dashboard' && <DashboardView invoices={invoices} customers={customers} sentHistory={sentHistory} setActiveTab={setActiveTab} formatCurrency={formatCurrency} />}
          {activeTab === 'invoices' && (
            <InvoicesView invoices={invoices} formatCurrency={formatCurrency} />
          )}
          {activeTab === 'customers' && (
            <CustomersView customers={customers} />
          )}
          {activeTab === 'queue' && <QueueView invoices={invoices} customers={customers} templates={templates} formatCurrency={formatCurrency} saveHistory={saveHistory} sentHistory={sentHistory} settings={settings} agentMappings={agentMappings} />}
          {activeTab === 'history' && <HistoryView sentHistory={sentHistory} saveHistory={saveHistory} />}
          {activeTab === 'templates' && <TemplatesView templates={templates} setTemplates={async (t) => { 
            setTemplates(t); 
            await supabase.from('email_templates').upsert({ id: 1, first_notice: t.firstNotice, follow_up: t.followUp }); 
          }} settings={settings} setSettings={async (s) => { 
            setSettings(s); 
            await supabase.from('global_settings').upsert({ 
              id: 1, 
              follow_up_interval: s.followUpInterval, 
              company_name: s.companyName, 
              auto_pilot: s.autoPilot, 
              cc_emails: s.ccEmails,
              email_service_provider: s.emailServiceProvider,
              smtp_host: s.smtpHost,
              smtp_port: s.smtpPort ? parseInt(s.smtpPort) : null,
              smtp_user: s.smtpUser,
              smtp_pass: s.smtpPass,
              smtp_secure: s.smtpSecure,
              smtp_from_email: s.smtpFromEmail,
              schedule_days: s.scheduleDays,
              schedule_time: s.scheduleTime
            }); 
          }} resetData={resetData} agentMappings={agentMappings} setAgentMappings={setAgentMappings} />}
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({icon, label, active, badge, onClick}) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-md transition-all text-sm font-medium border ${
        active 
          ? 'bg-secondary text-foreground border-border shadow-sm' 
          : 'text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        {label}
      </div>
      {badge > 0 && (
        <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// --- VIEWS ---

function DashboardView({ invoices, customers, sentHistory, setActiveTab, formatCurrency }) {
  const totalRevenue = invoices.reduce((acc, curr) => acc + cleanAmount(curr['Invoice amount']), 0);
  const openInvoices = invoices.filter(i => i.status?.toLowerCase() === 'open');
  const pendingAmount = openInvoices.reduce((acc, curr) => acc + cleanAmount(curr['Invoice amount']), 0);
  
  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight">Welcome back, Admin.</h2>
          <p className="text-muted-foreground text-sm">Here is what's happening with your accounts today.</p>
        </div>
        <button onClick={() => setActiveTab('queue')} className="btn btn-primary shadow-glow">
          <Send size={16}/> Process Email Queue
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card stat-card relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/20"></div>
          <span className="label"><DollarSign size={16} className="text-primary"/> Total Pipeline</span>
          <span className="value">{formatCurrency(totalRevenue)}</span>
        </div>
        <div className="card stat-card relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive to-destructive/20"></div>
          <span className="label"><AlertCircle size={16} className="text-destructive"/> Outstanding Balance</span>
          <span className="value text-destructive">{formatCurrency(pendingAmount)}</span>
        </div>
        <div className="card stat-card relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent/20"></div>
          <span className="label"><Activity size={16} className="text-accent"/> Open Invoices</span>
          <span className="value">{openInvoices.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2 uppercase tracking-wider text-muted-foreground"><Users size={14}/> Database Health</h3>
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-sm font-medium">Registered Clients</span>
            <span className="text-sm font-bold bg-secondary px-2 py-1 rounded">{customers.length}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm font-medium">Total Invoice Records</span>
            <span className="text-sm font-bold bg-secondary px-2 py-1 rounded">{invoices.length}</span>
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2 uppercase tracking-wider text-muted-foreground"><History size={14}/> Communication Logs</h3>
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-sm font-medium">Emails Sent Successfully</span>
            <span className="text-sm font-bold bg-accent/10 text-accent px-2 py-1 rounded">{sentHistory.length}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm font-medium text-warning">Pending Follow-Ups</span>
            <button onClick={() => setActiveTab('followup')} className="text-xs font-bold text-warning hover:underline">View Queue →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InvoicesView({ invoices, formatCurrency }) {
  const [filter, setFilter] = useState('');
  
  const filtered = invoices.filter(i => 
    i.Customer?.toLowerCase().includes(filter.toLowerCase()) || 
    i['Invoice number']?.toLowerCase().includes(filter.toLowerCase()) ||
    (i['Category'] || '').toLowerCase().includes(filter.toLowerCase()) ||
    (i['me'] || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Sync your billing records from Google Sheets.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="search-icon" size={14}/>
            <input className="input pl-8 w-64 text-xs h-9" placeholder="Search customer, ID, category or agent..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Inv #</th>
              <th>Customer</th>
              <th className="text-right">Gross</th>
              <th className="text-right">GST</th>
              <th className="text-right font-bold">Net Value</th>
              <th>Category</th>
              <th className="text-center">Agent</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, idx) => (
              <tr key={inv['Invoice number'] || idx}>
                <td className="text-muted-foreground">{inv.Date || inv['Invoice date']}</td>
                <td className="text-xs font-semibold text-primary">{inv['Invoice Type'] || 'Tax Invoice'}</td>
                <td className="font-semibold text-foreground">{inv['Invoice number'] || inv['Invoice No']}</td>
                <td>{inv.Customer || inv.Particulars}</td>
                <td className="text-right text-muted-foreground">{formatCurrency(inv['Gross Invoice'])}</td>
                <td className="text-right text-muted-foreground">{formatCurrency(inv['GST'])}</td>
                <td className="text-right font-bold text-destructive">{formatCurrency(inv['Net Invoice Value'] || inv['Invoice amount'])}</td>
                <td className="text-xs text-muted-foreground max-w-[150px] truncate">{inv['Category'] || '-'}</td>
                <td className="text-center text-xs font-medium bg-secondary/30 px-2 py-0.5 rounded-full">{inv['me'] || '-'}</td>
                <td className="text-center">
                  <span className={`badge ${inv.status?.toLowerCase() === 'open' ? 'badge-open' : 'badge-closed'}`}>
                    {inv.status || inv['Notification'] || 'Open'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No invoices match your search.</div>}
      </div>
    </div>
  )
}

function CustomersView({ customers }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground">Sync your client contact directory from Google Sheets.</p>
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Billing Email</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, index) => (
              <tr key={(c['Customer Name'] || c.name || index)}>
                <td className="font-medium text-foreground">{c['Customer Name'] || c.name}</td>
                <td className="text-muted-foreground">{c['Email ID'] || c['Mail Id'] || c.email || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function generateTypeTableHtml(type, invoices, formatCurrency) {
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

function compileEmailHtml(customer, customerInvoices, templateStr, formatCurrency, lastSentDate = null, companyName = "Enterprise Finance") {
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
    tablesHtml += generateTypeTableHtml(type, groupedByType[type], formatCurrency);
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


function QueueView({ invoices, customers, templates, formatCurrency, saveHistory, sentHistory, settings, agentMappings }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [compiledHtml, setCompiledHtml] = useState("");
  const [customCc, setCustomCc] = useState("");
  const [customTo, setCustomTo] = useState("");

  const openInvoices = invoices.filter(i => i.status?.toLowerCase() === 'open');
  const grouped = {};
  openInvoices.forEach(inv => {
    if(!grouped[inv.Customer]) grouped[inv.Customer] = [];
    grouped[inv.Customer].push(inv);
  });

  const pendingClients = Object.keys(grouped).map(cName => {
    return {
      customerData: customers.find(c => c['Customer Name'] === cName),
      customerName: cName,
      invoices: grouped[cName],
      total: grouped[cName].reduce((acc, curr) => acc + cleanAmount(curr['Net Invoice Value'] || curr['Invoice amount']), 0)
    };
  }).filter(c => {
    return !!c.customerData;
  });

  const handleReview = (client) => {
    const uniqueAgents = [...new Set(
      client.invoices
        .map(inv => (inv.me || inv.raw_data?.me || '').trim())
        .filter(Boolean)
    )];
    
    const agentEmailsMap = {};
    (agentMappings || []).forEach(m => {
      if (m.agent_name && m.agent_email) {
        agentEmailsMap[m.agent_name.toLowerCase().trim()] = m.agent_email.trim();
      }
    });
    
    const agentCcs = uniqueAgents.map(a => agentEmailsMap[a.toLowerCase()]).filter(Boolean);
    const globalCcs = settings.ccEmails ? settings.ccEmails.split(/[;,]/).map(e => e.trim()).filter(Boolean) : [];
    const resolvedCcLine = [...new Set([...globalCcs, ...agentCcs])].join(', ');

    setSelectedClient(client);
    setCompiledHtml(compileEmailHtml(client.customerData, client.invoices, templates.firstNotice, formatCurrency, null, settings.companyName));
    setCustomCc(resolvedCcLine);
    
    const rawEmail = client.customerData['Email ID'] || client.customerData['Mail Id'] || client.customerData.email || "";
    const cleanEmail = rawEmail.split(/[;,]/).map(e => e.trim()).filter(Boolean).filter(e => {
      const lower = e.toLowerCase();
      return !lower.includes('example.com') && !lower.includes('recipient@');
    }).join(', ');
    setCustomTo(cleanEmail);
  };

  const handleSend = async () => {
    if (!customTo.trim()) {
      alert("Please specify a valid recipient email address.");
      return;
    }
    setIsSending(true);
    try {
      const payload = {
        to: customTo,
        cc: customCc,
        subject: `Statement of Account - ${selectedClient.customerName}`,
        htmlContent: compiledHtml,
        companyName: settings.companyName
      };
      
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if(!res.ok) throw new Error(result.error?.message || "Failed to send");
      
      const newRecord = {
        id: Math.random().toString(36).substr(2, 9),
        customerName: selectedClient.customerName,
        email: customTo,
        type: 'First Notice',
        sentAt: new Date().toISOString(),
        invoiceIds: selectedClient.invoices.map(i => i['Invoice number'])
      };
      saveHistory([newRecord, ...sentHistory]);
      setSelectedClient(null);
    } catch (e) {
      alert("Error sending email: " + e.message);
    }
    setIsSending(false);
  };

  if(selectedClient) {
    return (
      <div className="composer-window animate-fade-up max-w-3xl m-auto">
        <button onClick={() => setSelectedClient(null)} className="btn btn-ghost mb-6 text-muted-foreground hover:text-foreground pl-0">← Back to Send Queue</button>
        <div className="composer-window border border-border rounded-xl overflow-hidden shadow-glow">
          <div className="composer-header px-6 py-4 bg-secondary border-b border-border">
            <h2 className="text-sm font-bold tracking-tight">Review Outstanding Statement</h2>
          </div>
          <div className="composer-body p-6 flex flex-col gap-4">
            <div className="composer-field flex items-center py-2.5 border-b border-border">
              <span className="composer-label w-16 text-xs font-bold text-muted-foreground uppercase tracking-wider">To:</span>
              <input 
                type="text"
                className="bg-transparent border-none text-sm text-foreground focus:outline-none w-full p-0 font-medium" 
                placeholder="recipient@example.com" 
                value={customTo} 
                onChange={e => setCustomTo(e.target.value)} 
              />
            </div>
            <div className="composer-field flex items-center py-2.5 border-b border-border animate-fade-down">
              <span className="composer-label w-16 text-xs font-bold text-muted-foreground uppercase tracking-wider">CC:</span>
              <input 
                type="text"
                className="bg-transparent border-none text-sm text-foreground focus:outline-none w-full p-0 font-medium" 
                placeholder="No CC addresses resolved" 
                value={customCc} 
                onChange={e => setCustomCc(e.target.value)} 
              />
            </div>
            <div className="composer-field flex items-center py-2.5 border-b border-border border-none">
              <span className="composer-label w-16 text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject:</span>
              <span className="text-sm font-medium text-foreground">Statement of Account - {selectedClient.customerName}</span>
            </div>
            <div className="composer-preview border border-border rounded-lg overflow-y-auto max-h-[450px]" dangerouslySetInnerHTML={{__html: compiledHtml}}></div>
          </div>
          <div className="composer-footer px-6 py-4 bg-secondary border-t border-border flex justify-between items-center">
            <button onClick={() => setSelectedClient(null)} className="btn btn-outline border-transparent text-muted-foreground hover:text-foreground" disabled={isSending}>Discard</button>
            <button onClick={handleSend} className="btn btn-primary shadow-glow h-10 px-5 flex items-center gap-2 font-bold" disabled={isSending}>
              <SendHorizontal size={16}/> {isSending ? "Sending Statement..." : "Approve & Dispatch"}
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Send Queue</h2>
          <p className="text-sm text-muted-foreground">Drafts prepared for clients with outstanding invoices.</p>
        </div>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Destination</th>
              <th className="text-center">Count</th>
              <th className="text-right">Total Due</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingClients.map(client => (
              <tr key={client.customerName}>
                <td className="font-medium">{client.customerName}</td>
                <td className="text-muted-foreground">{client.customerData['Email ID'] || client.customerData['Mail Id'] || client.customerData.email || ''}</td>
                <td className="text-center"><span className="badge badge-open">{client.invoices.length}</span></td>
                <td className="text-right text-destructive font-bold">{formatCurrency(client.total)}</td>
                <td className="text-center">
                  <button onClick={() => handleReview(client)} className="btn btn-primary h-7 px-3 text-xs shadow-glow">Review Draft</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendingClients.length === 0 && <div className="p-16 text-center text-muted-foreground text-sm">Inbox Zero. No pending invoices require emails! 🎉</div>}
      </div>
    </div>
  )
}

function HistoryView({ sentHistory, saveHistory }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const filteredHistory = sentHistory.filter(h => {
    // 1. Search filter: matches customer name, recipient email, or invoice numbers
    const matchesSearch = 
      h.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      h.email?.toLowerCase().includes(search.toLowerCase()) ||
      (h.invoiceIds && h.invoiceIds.some(id => id?.toLowerCase().includes(search.toLowerCase())));

    // 2. Type filter: matches communication log type
    const matchesType = typeFilter === 'all' || h.type === typeFilter;

    // 3. Date filter: matches exact day in local timezone (YYYY-MM-DD format)
    let matchesDate = true;
    if (dateFilter) {
      const recordDate = new Date(h.sentAt).toLocaleDateString('en-CA'); // YYYY-MM-DD format
      matchesDate = recordDate === dateFilter;
    }

    return matchesSearch && matchesType && matchesDate;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Sent History</h2>
        <p className="text-sm text-muted-foreground">Log of all outgoing communications.</p>
      </div>

      {/* Spaced, premium B2B search and filter row */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div style={{ flex: '2', minWidth: '200px' }}>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Search Recipient or Invoice</label>
          <div className="relative">
            <Search className="search-icon" size={14}/>
            <input 
              className="input pl-8 text-xs h-9" 
              placeholder="Search client, email, or invoice..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ flex: '1', minWidth: '150px' }}>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Filter by Type</label>
          <select 
            className="input text-xs h-9 font-medium"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="Automated Reminder">Automated Reminder</option>
            <option value="First Notice">First Notice</option>
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '150px' }}>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Filter by Date</label>
          <input 
            type="date"
            className="input text-xs h-9 font-medium"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        {(search || typeFilter !== 'all' || dateFilter) && (
          <button 
            onClick={() => { setSearch(''); setTypeFilter('all'); setDateFilter(''); }} 
            className="btn btn-ghost text-xs h-9 px-3 text-muted-foreground hover:text-foreground border-border border"
          >
            Reset Filters
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Recipient</th>
              <th>Type</th>
              <th>Related Invoices</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map(h => (
              <tr key={h.id}>
                <td className="text-muted-foreground whitespace-nowrap">{new Date(h.sentAt).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}</td>
                <td>
                  <p className="font-medium text-foreground">{h.customerName}</p>
                  <p className="text-xs text-muted-foreground">{h.email}</p>
                </td>
                <td><span className="badge bg-secondary text-secondary-foreground border-transparent">{h.type}</span></td>
                <td className="text-xs text-muted-foreground truncate max-w-[200px]">{h.invoiceIds.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredHistory.length === 0 && (
          <div className="p-16 text-center text-muted-foreground text-sm">
            {sentHistory.length === 0 
              ? "No emails have been sent yet." 
              : "No logs match your filter criteria."}
          </div>
        )}
      </div>
    </div>
  )
}



function TemplatesView({ templates, setTemplates, settings, setSettings, resetData, agentMappings = [], setAgentMappings }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState({ message: '', success: null });

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [editingId, setEditingId] = useState(null);

  const handleAddOrUpdateMapping = async (e) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentEmail.trim()) return;

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('agent_mappings')
          .update({ agent_name: newAgentName.trim(), agent_email: newAgentEmail.trim() })
          .eq('id', editingId);
        
        if (error) throw error;
        
        setAgentMappings(agentMappings.map(m => m.id === editingId ? { ...m, agent_name: newAgentName.trim(), agent_email: newAgentEmail.trim() } : m));
        setEditingId(null);
      } else {
        // Add new
        const { data, error } = await supabase
          .from('agent_mappings')
          .insert([{ agent_name: newAgentName.trim(), agent_email: newAgentEmail.trim() }])
          .select();
        
        if (error) throw error;
        
        if (data) {
          setAgentMappings([...agentMappings, data[0]]);
        }
      }
      setNewAgentName('');
      setNewAgentEmail('');
    } catch (err) {
      alert("Error saving mapping: " + err.message);
    }
  };

  const handleEditMapping = (m) => {
    setEditingId(m.id);
    setNewAgentName(m.agent_name);
    setNewAgentEmail(m.agent_email);
  };

  const handleDeleteMapping = async (id) => {
    if (!confirm("Are you sure you want to delete this agent CC mapping?")) return;
    try {
      const { error } = await supabase
        .from('agent_mappings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setAgentMappings(agentMappings.filter(m => m.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setNewAgentName('');
        setNewAgentEmail('');
      }
    } catch (err) {
      alert("Error deleting mapping: " + err.message);
    }
  };

  const handleTestSmtp = async () => {
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
      setTestResult({ message: "Please fill in Host, Port, Username, and Password first.", success: false });
      return;
    }
    setIsTesting(true);
    setTestResult({ message: "", success: null });
    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpSecure,
          user: settings.smtpUser,
          pass: settings.smtpPass,
          fromEmail: settings.smtpFromEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ message: `Connection Successful! A test email has been sent to ${settings.smtpUser}. 🎉`, success: true });
      } else {
        setTestResult({ message: data.error?.message || "Failed to establish SMTP connection handshake.", success: false });
      }
    } catch (err) {
      setTestResult({ message: err.message || "Failed to reach SMTP tester API.", success: false });
    }
    setIsTesting(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
          <p className="text-sm text-muted-foreground">Configure global variables, SMTP settings, and email templates.</p>
        </div>
      </div>

      <div className="max-w-4xl flex flex-col gap-10">
        
        <div className="card p-8 border-border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings size={18}/> Workspace Configuration</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Company/Sender Name</label>
              <input 
                className="input" 
                value={settings.companyName || ''} 
                onChange={e => setSettings({...settings, companyName: e.target.value})} 
                placeholder="Enterprise Finance"
              />
              <p className="text-xs text-muted-foreground mt-1.5">This replaces {'{{company_name}}'} in your templates.</p>
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Global CC Email(s)</label>
              <input 
                className="input" 
                value={settings.ccEmails || ''} 
                onChange={e => setSettings({...settings, ccEmails: e.target.value})} 
                placeholder="billing-archive@yourcompany.com, audit@yourcompany.com"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Multiple emails can be separated by commas or semicolons. These addresses will automatically be CC'd on all emails sent.</p>
            </div>

            <div className="col-span-2 pt-4 border-t border-border mt-2">
              <label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wider">Email Dispatch Provider</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button" 
                  onClick={() => setSettings({...settings, emailServiceProvider: 'resend'})}
                  className={`btn text-sm font-semibold h-11 flex items-center justify-center gap-2 transition-all ${settings.emailServiceProvider === 'resend' ? 'btn-primary shadow-glow' : 'btn-outline border-border'}`}
                >
                  Resend Cloud API
                </button>
                <button 
                  type="button" 
                  onClick={() => setSettings({...settings, emailServiceProvider: 'smtp'})}
                  className={`btn text-sm font-semibold h-11 flex items-center justify-center gap-2 transition-all ${settings.emailServiceProvider === 'smtp' ? 'btn-primary shadow-glow' : 'btn-outline border-border'}`}
                >
                  Custom SMTP Server
                </button>
              </div>
            </div>

            {settings.emailServiceProvider === 'smtp' && (
              <div className="col-span-2 pt-6 border-t border-border mt-2 animate-fade-down">
                <h4 className="text-sm font-bold mb-4 text-foreground flex items-center gap-2">🔌 SMTP Configurations</h4>
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-4">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">SMTP Host</label>
                    <input 
                      className="input h-10" 
                      value={settings.smtpHost || ''} 
                      onChange={e => setSettings({...settings, smtpHost: e.target.value})} 
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">SMTP Port</label>
                    <input 
                      type="number"
                      className="input h-10" 
                      value={settings.smtpPort || ''} 
                      onChange={e => setSettings({...settings, smtpPort: e.target.value})} 
                      placeholder="587"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">Username / Email Address</label>
                    <input 
                      className="input h-10" 
                      value={settings.smtpUser || ''} 
                      onChange={e => setSettings({...settings, smtpUser: e.target.value})} 
                      placeholder="billing@pixelsoft.in"
                    />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">Password / App Password</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="input h-10 pr-10" 
                        value={settings.smtpPass || ''} 
                        onChange={e => setSettings({...settings, smtpPass: e.target.value})} 
                        placeholder="••••••••••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="pw-toggle-btn"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">Custom Sender Address (Optional)</label>
                    <input 
                      className="input h-10" 
                      value={settings.smtpFromEmail || ''} 
                      onChange={e => setSettings({...settings, smtpFromEmail: e.target.value})} 
                      placeholder="billing@pixelsoft.in"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">If blank, SMTP defaults to your Username.</p>
                  </div>
                  <div className="col-span-3 flex items-center pt-5">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={settings.smtpSecure || false} 
                        onChange={e => setSettings({...settings, smtpSecure: e.target.checked})} 
                      />
                      <span className="text-xs font-bold text-foreground">Secure Connection (SSL/TLS)</span>
                    </label>
                  </div>

                  <div className="col-span-6 pt-2">
                    <div className="flex items-center gap-3">
                      <button 
                        type="button" 
                        onClick={handleTestSmtp} 
                        disabled={isTesting}
                        className="btn btn-outline text-xs h-9 px-4 font-bold border-accent/20 text-accent hover:bg-accent/10 flex items-center gap-2"
                      >
                        {isTesting ? "Testing Handshake..." : "Test Connection Setup"}
                      </button>
                      {testResult.success === true && (
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-md animate-fade-up">
                          {testResult.message}
                        </span>
                      )}
                      {testResult.success === false && (
                        <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-md animate-fade-up">
                          {testResult.message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-2 pt-4 border-t border-border mt-2">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${settings.autoPilot ? 'bg-primary' : 'bg-secondary'}`}>
                  <div className={`absolute top-0.5 left-0.5 bg-background w-4 h-4 rounded-full transition-transform ${settings.autoPilot ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={settings.autoPilot || false} 
                  onChange={e => setSettings({...settings, autoPilot: e.target.checked})} 
                />
                <div>
                  <span className="text-sm font-bold block">Enable Auto-Pilot (Background Scheduler)</span>
                  <span className="text-xs text-muted-foreground">When active, the background worker automatically checks your settings and dispatches invoice statement summaries.</span>
                </div>
              </label>

              {settings.autoPilot && (
                <div className="p-4 bg-secondary/30 border border-border/50 rounded-lg animate-fade-down mt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Clock size={14}/> Background Dispatch Schedule</h4>
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-4">
                      <label className="text-[11px] font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Weekly Send Days (Select Multiple)</label>
                      <div className="flex flex-wrap gap-2">
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                          const activeDays = Array.isArray(settings.scheduleDays) ? settings.scheduleDays : ['Monday'];
                          const isSelected = activeDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const newDays = isSelected
                                  ? activeDays.filter(d => d !== day)
                                  : [...activeDays, day];
                                // Ensure at least one day is selected
                                setSettings({...settings, scheduleDays: newDays.length > 0 ? newDays : [day]});
                              }}
                              className={`weekday-chip ${isSelected ? 'active' : ''}`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {(() => {
                      const [rawHour, rawMinute] = (settings.scheduleTime || '11:00').split(':');
                      const hour24 = parseInt(rawHour) || 0;
                      const periodVal = hour24 >= 12 ? 'PM' : 'AM';
                      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
                      const hour12Val = hour12.toString().padStart(2, '0');
                      const minuteVal = (rawMinute || '00');
                      
                      return (
                        <div className="col-span-2">
                          <label className="text-[11px] font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Send Time (IST)</label>
                          <div className="flex gap-2 items-center">
                            <select 
                              className="input h-10 text-center font-semibold"
                              style={{ width: '70px', padding: '0 8px' }}
                              value={hour12Val}
                              onChange={e => {
                                const newHour12 = parseInt(e.target.value);
                                let newHour24 = newHour12;
                                if (periodVal === 'PM' && newHour12 < 12) newHour24 += 12;
                                if (periodVal === 'AM' && newHour12 === 12) newHour24 = 0;
                                const timeStr = `${newHour24.toString().padStart(2, '0')}:${minuteVal}`;
                                setSettings({...settings, scheduleTime: timeStr});
                              }}
                            >
                              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            
                            <span className="font-bold text-muted-foreground">:</span>

                            <select 
                              className="input h-10 text-center font-semibold"
                              style={{ width: '70px', padding: '0 8px' }}
                              value={minuteVal}
                              onChange={e => {
                                const timeStr = `${hour24.toString().padStart(2, '0')}:${e.target.value}`;
                                setSettings({...settings, scheduleTime: timeStr});
                              }}
                            >
                              {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            <select 
                              className="input h-10 text-center font-semibold"
                              style={{ width: '75px', padding: '0 8px' }}
                              value={periodVal}
                              onChange={e => {
                                const newPeriod = e.target.value;
                                const h12 = parseInt(hour12Val);
                                let newHour24 = h12;
                                if (newPeriod === 'PM' && h12 < 12) newHour24 += 12;
                                if (newPeriod === 'AM' && h12 === 12) newHour24 = 0;
                                const timeStr = `${newHour24.toString().padStart(2, '0')}:${minuteVal}`;
                                setSettings({...settings, scheduleTime: timeStr});
                              }}
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-8 border-border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={18}/> Email Templates</h3>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Standard Notice Template</h3>
            <p className="text-xs text-muted-foreground mb-3">Tags: <code className="bg-secondary px-1 py-0.5 rounded text-foreground">{'{{customer_name}}'}</code> <code className="bg-secondary px-1 py-0.5 rounded text-foreground">{'{{company_name}}'}</code></p>
            <textarea 
              className="textarea min-h-[250px] font-mono text-sm leading-relaxed" 
              value={templates.firstNotice}
              onChange={e => setTemplates({...templates, firstNotice: e.target.value})}
            />
          </div>
        </div>

        <div className="card p-8 border-border shadow-sm animate-fade-up">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">👥 Agent CC Mappings</h3>
          <p className="text-xs text-muted-foreground mb-6">Configure custom CC routing based on the follow-up agent specified in the 'me' column.</p>
          
          <form onSubmit={handleAddOrUpdateMapping} className="grid grid-cols-5 gap-4 mb-6 items-end p-4 bg-secondary/30 rounded-lg border border-border/50">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Agent Name (matches 'me' column)</label>
              <input 
                className="input h-9 text-xs" 
                placeholder="e.g. Baiju" 
                value={newAgentName} 
                onChange={e => setNewAgentName(e.target.value)} 
                required 
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Agent Corporate Email</label>
              <input 
                type="email"
                className="input h-9 text-xs" 
                placeholder="e.g. baiju@pixel-studios.com" 
                value={newAgentEmail} 
                onChange={e => setNewAgentEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="col-span-1">
              <button type="submit" className="btn btn-primary h-9 text-xs w-full font-bold shadow-glow">
                {editingId ? "Update" : "Add Mapping"}
              </button>
            </div>
          </form>

          <div className="table-container max-h-[300px] overflow-y-auto">
            <table>
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Corporate Email</th>
                  <th className="text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agentMappings.map(m => (
                  <tr key={m.id}>
                    <td className="font-semibold text-foreground">{m.agent_name}</td>
                    <td className="text-muted-foreground">{m.agent_email}</td>
                    <td className="text-center">
                      <div className="flex gap-3 justify-center">
                        <button type="button" onClick={() => handleEditMapping(m)} className="text-xs font-bold text-accent hover:underline">Edit</button>
                        <button type="button" onClick={() => handleDeleteMapping(m.id)} className="text-xs font-bold text-destructive hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agentMappings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground p-8 text-xs">No custom agent mappings configured yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-8 border-destructive/20 bg-destructive/5 mt-4">
          <h3 className="text-lg font-bold text-destructive mb-2">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">Actions here are permanent and cannot be undone.</p>
          <button onClick={resetData} className="btn bg-destructive hover:bg-destructive-hover text-destructive-foreground">
            Reset Database & Wipe All Records
          </button>
        </div>

      </div>
    </div>
  )
}
