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
        const [invRes, custRes, histRes, setRes, tempRes] = await Promise.all([
          supabase.from('invoices').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('sent_history').select('*').order('sent_at', { ascending: false }),
          supabase.from('global_settings').select('*').eq('id', 1),
          supabase.from('email_templates').select('*').eq('id', 1)
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
        if (setRes.data && setRes.data.length > 0) {
          const s = setRes.data[0];
          setSettings({ followUpInterval: s.follow_up_interval, companyName: s.company_name, autoPilot: s.auto_pilot, ccEmails: s.cc_emails || '' });
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
      const formattedInvoices = newInvoices.map(inv => ({
        invoice_number: inv['Invoice number'],
        customer: inv.Customer,
        amount: inv['Invoice amount'],
        status: inv.status,
        date: inv['Invoice date'] || inv.Date,
        raw_data: inv
      }));
      if (formattedInvoices.length > 0) {
        await supabase.from('invoices').upsert(formattedInvoices, { onConflict: 'invoice_number' });
      }

      const formattedCustomers = newCustomers.map(c => ({
        name: c['Customer Name'],
        email: c['Email ID'],
        raw_data: c
      }));
      if (formattedCustomers.length > 0) {
        await supabase.from('customers').upsert(formattedCustomers, { onConflict: 'name' });
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
        // Merge logic
        const newInvoices = [...invoices];
        data.invoices.forEach(newInv => {
          const idx = newInvoices.findIndex(i => i['Invoice number'] === newInv['Invoice number']);
          if (idx > -1) {
            newInvoices[idx] = newInv;
          } else {
            newInvoices.push(newInv);
          }
        });

        const newCustomers = [...customers];
        data.customers.forEach(newCust => {
          const idx = newCustomers.findIndex(c => c['Customer Name'] === newCust['Customer Name']);
          if (idx > -1) {
            newCustomers[idx] = newCust;
          } else {
            newCustomers.push(newCust);
          }
        });

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
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
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
          {activeTab === 'dashboard' && <DashboardView invoices={invoices} customers={customers} sentHistory={sentHistory} setActiveTab={setActiveTab} />}
          {activeTab === 'invoices' && (
            <InvoicesView invoices={invoices} formatCurrency={formatCurrency} />
          )}
          {activeTab === 'customers' && (
            <CustomersView customers={customers} />
          )}
          {activeTab === 'queue' && <QueueView invoices={invoices} customers={customers} templates={templates} formatCurrency={formatCurrency} saveHistory={saveHistory} sentHistory={sentHistory} settings={settings} />}
          {activeTab === 'history' && <HistoryView sentHistory={sentHistory} saveHistory={saveHistory} />}
          {activeTab === 'templates' && <TemplatesView templates={templates} setTemplates={async (t) => { 
            setTemplates(t); 
            await supabase.from('email_templates').upsert({ id: 1, first_notice: t.firstNotice, follow_up: t.followUp }); 
          }} settings={settings} setSettings={async (s) => { 
            setSettings(s); 
            await supabase.from('global_settings').upsert({ id: 1, follow_up_interval: s.followUpInterval, company_name: s.companyName, auto_pilot: s.autoPilot, cc_emails: s.ccEmails }); 
          }} resetData={resetData} />}
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

function DashboardView({ invoices, customers, sentHistory, setActiveTab }) {
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
          <span className="value">{totalRevenue.toLocaleString('en-US', {style:'currency', currency:'USD'})}</span>
        </div>
        <div className="card stat-card relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive to-destructive/20"></div>
          <span className="label"><AlertCircle size={16} className="text-destructive"/> Outstanding Balance</span>
          <span className="value text-destructive">{pendingAmount.toLocaleString('en-US', {style:'currency', currency:'USD'})}</span>
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
    i['Invoice number']?.toLowerCase().includes(filter.toLowerCase())
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14}/>
            <input className="input pl-8 w-64 text-xs h-9" placeholder="Search customer or ID..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Inv #</th>
              <th>Customer</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td className="text-muted-foreground">{inv.Date}</td>
                <td className="font-medium">{inv['Invoice number']}</td>
                <td>{inv.Customer}</td>
                <td className="text-right font-medium">{formatCurrency(inv['Invoice amount'])}</td>
                <td className="text-center">
                  <span className={`badge ${inv.status?.toLowerCase() === 'open' ? 'badge-open' : 'badge-closed'}`}>
                    {inv.status}
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
              <tr key={c['Customer Name'] || index}>
                <td className="font-medium text-foreground">{c['Customer Name']}</td>
                <td className="text-muted-foreground">{c['Email ID']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function compileEmailHtml(customer, customerInvoices, templateStr, formatCurrency, lastSentDate = null, companyName = "Enterprise Finance") {
  const pendingAmount = customerInvoices.reduce((acc, curr) => acc + cleanAmount(curr['Invoice amount']), 0);
  
  // 1. Compile the invoice table HTML beautifully
  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;
  tableHtml += `<tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; font-weight: 700;">
    <th style="padding: 12px 16px;">Date</th>
    <th style="padding: 12px 16px;">Invoice Number</th>
    <th style="padding: 12px 16px; text-align: right;">Amount</th>
  </tr>`;
  
  customerInvoices.forEach(inv => {
    tableHtml += `<tr style="border-bottom: 1px solid #e2e8f0; color: #0f172a;">
      <td style="padding: 12px 16px;">${inv['Invoice date'] || inv.Date}</td>
      <td style="padding: 12px 16px; font-weight: 600; color: #2563eb;">${inv['Invoice number']}</td>
      <td style="padding: 12px 16px; text-align: right; color: #dc2626; font-weight: 700;">${formatCurrency(inv['Invoice amount'])}</td>
    </tr>`;
  });
  tableHtml += `</table>`;

  // 2. Escape HTML and format the plain text template to HTML by replacing newlines with <br>
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
    .replace(/\{\{invoice_table_placeholder\}\}/g, tableHtml);

  // 3. Wrap in a stunning, premium HTML email wrapper with dynamic styling
  const emailWrapper = `
    <div style="background-color: #f3f4f6; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-w: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
        <!-- Header -->
        <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Outstanding Balance Notice</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em;">${companyName}</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          ${formattedTemplate}
        </div>
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.5;">
          This is an automated transaction message from the billing department of <strong>${companyName}</strong>.<br>
          If you have any questions or have already made this payment, please feel free to reply directly to this email.
        </div>
      </div>
    </div>
  `;

  return emailWrapper;
}

function QueueView({ invoices, customers, templates, formatCurrency, saveHistory, sentHistory, settings }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [compiledHtml, setCompiledHtml] = useState("");
  const [customCc, setCustomCc] = useState("");

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
      total: grouped[cName].reduce((acc, curr) => acc + cleanAmount(curr['Invoice amount']), 0)
    };
  }).filter(c => {
    if (!c.customerData) return false;
    // Hide customer from first notice queue if they already have been sent a notice for their current open invoices
    const hasAlreadyBeenSentNotice = sentHistory.some(h => 
      h.customerName === c.customerName && 
      h.invoiceIds && // Ensure invoiceIds exists in history record
      c.invoices.some(inv => h.invoiceIds.includes(inv['Invoice number']))
    );
    return !hasAlreadyBeenSentNotice;
  });

  const handleReview = (client) => {
    setSelectedClient(client);
    setCompiledHtml(compileEmailHtml(client.customerData, client.invoices, templates.firstNotice, formatCurrency, null, settings.companyName));
    setCustomCc(settings.ccEmails || "");
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const payload = {
        to: selectedClient.customerData['Email ID'],
        cc: customCc,
        subject: `Pending Invoices Summary - ${selectedClient.customerName}`,
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
        email: selectedClient.customerData['Email ID'],
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
      <div className="animate-fade-up max-w-3xl m-auto">
        <button onClick={() => setSelectedClient(null)} className="btn btn-ghost mb-6 text-muted-foreground hover:text-foreground pl-0">← Back to Send Queue</button>
        <div className="composer-window">
          <div className="composer-header">
            <h2 className="text-sm font-semibold">New Message</h2>
          </div>
          <div className="composer-body">
            <div className="composer-field">
              <span className="composer-label">To:</span>
              <span className="text-sm font-medium">{selectedClient.customerData['Email ID']}</span>
            </div>
            <div className="composer-field animate-fade-down">
              <span className="composer-label">CC:</span>
              <input 
                type="text"
                className="bg-transparent border-none text-sm text-foreground focus:outline-none w-full p-0 font-medium" 
                placeholder="No CC addresses configured" 
                value={customCc} 
                onChange={e => setCustomCc(e.target.value)} 
              />
            </div>
            <div className="composer-field border-none">
              <span className="composer-label">Subject:</span>
              <span className="text-sm font-medium">Pending Invoices Summary - {selectedClient.customerName}</span>
            </div>
            <div className="composer-preview" dangerouslySetInnerHTML={{__html: compiledHtml}}></div>
          </div>
          <div className="composer-footer">
            <button onClick={() => setSelectedClient(null)} className="btn btn-outline border-transparent text-muted-foreground hover:text-foreground" disabled={isSending}>Discard</button>
            <button onClick={handleSend} className="btn btn-primary shadow-glow" disabled={isSending}>
              <SendHorizontal size={16}/> {isSending ? "Sending..." : "Approve & Send"}
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
                <td className="text-muted-foreground">{client.customerData['Email ID']}</td>
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
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Sent History</h2>
        <p className="text-sm text-muted-foreground">Log of all outgoing communications.</p>
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
            {sentHistory.map(h => (
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
        {sentHistory.length === 0 && <div className="p-16 text-center text-muted-foreground text-sm">No emails have been sent yet.</div>}
      </div>
    </div>
  )
}



function TemplatesView({ templates, setTemplates, settings, setSettings, resetData }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
          <p className="text-sm text-muted-foreground">Configure global variables and email templates.</p>
        </div>
      </div>

      <div className="max-w-4xl flex flex-col gap-8">
        
        <div className="card p-6 border-border shadow-sm">
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
              <label className="flex items-center gap-3 cursor-pointer">
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
                  <span className="text-sm font-bold block">Enable Auto-Pilot (Cron Job)</span>
                  <span className="text-xs text-muted-foreground">When enabled, Vercel Cron will automatically sync Google Sheets and dispatch outstanding invoice reminders every Monday at 11:00 AM IST.</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="card p-6 border-border shadow-sm">
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

        <div className="card p-6 border-destructive/20 bg-destructive/5 mt-4">
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
