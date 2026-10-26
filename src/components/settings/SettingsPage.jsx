import { useState, useEffect } from 'react';
import api, { getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, PageLoader, InfoBanner } from '../shared';
import ConfigEditor from '../config/ConfigEditor';

/* ── Org Settings ─────────────────────────────────────────────────────────── */
function OrgSettings({ company, onSave }) {
  const [form,  setForm]  = useState({ name:'', adminName:'', mobile:'', email:'', city:'', state:'', address:'', website:'', logo:'' });
  const [saving,setSaving]= useState(false);
  const toast = useToast();

  useEffect(() => {
    if (company) setForm({
      name:      company.name||'',
      adminName: company.adminName||'',
      mobile:    company.mobile||'',
      email:     company.email||'',
      city:      company.city||'',
      state:     company.state||'',
      address:   company.address||'',
      website:   company.website||'',
      logo:      company.logo||'',
    });
  }, [company]);

  const handleLogo = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f, logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.put('/settings/org', form); toast.success('Organization details saved'); onSave(); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Logo */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="w-16 h-16 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
          {form.logo ? <img src={form.logo} alt="logo" className="w-full h-full object-contain"/> : <i className="fas fa-image text-slate-300 text-2xl"/>}
        </div>
        <div>
          <div className="font-semibold text-slate-700 text-sm mb-1.5">Organization Logo</div>
          <div className="flex gap-2 flex-wrap">
            <label className="btn btn-outline btn-sm cursor-pointer"><i className="fas fa-upload"/> Upload<input type="file" accept="image/*" className="hidden" onChange={handleLogo}/></label>
            {form.logo && <button type="button" onClick={()=>f('logo','')} className="btn btn-danger btn-sm"><i className="fas fa-trash"/> Remove</button>}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">PNG with transparent background preferred. Max 2MB.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Organization Name *</label>
          <input className="input" value={form.name} onChange={e=>f('name',e.target.value)} required placeholder="Full legal name"/></div>
        <div><label className="label">Admin Display Name</label>
          <input className="input" value={form.adminName} onChange={e=>f('adminName',e.target.value)} placeholder="e.g. Ramesh Kumar"/></div>
        <div><label className="label">Mobile</label>
          <input className="input" value={form.mobile} onChange={e=>f('mobile',e.target.value)} placeholder="+91 XXXXXXXXXX"/></div>
        <div><label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="contact@company.com"/></div>
        <div><label className="label">Website</label>
          <input className="input" value={form.website} onChange={e=>f('website',e.target.value)} placeholder="https://..."/></div>
        <div><label className="label">City</label>
          <input className="input" value={form.city} onChange={e=>f('city',e.target.value)}/></div>
        <div><label className="label">State</label>
          <input className="input" value={form.state} onChange={e=>f('state',e.target.value)}/></div>
        <div className="sm:col-span-2"><label className="label">Full Address</label>
          <textarea className="input h-20 resize-none" value={form.address} onChange={e=>f('address',e.target.value)}/></div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-save"/>}
          Save Changes
        </button>
      </div>
    </form>
  );
}

/* ── Security Settings ────────────────────────────────────────────────────── */
function SecuritySettings() {
  const [form,  setForm]  = useState({ adminUsername:'', adminPassword:'' });
  const [show,  setShow]  = useState(false);
  const [saving,setSaving]= useState(false);
  const toast = useToast();

  const submit = async e => {
    e.preventDefault();
    if (!form.adminUsername && !form.adminPassword) return toast.error('Fill at least one field');
    if (form.adminPassword && form.adminPassword.length < 4) return toast.error('Password must be at least 4 characters');
    setSaving(true);
    try {
      await api.put('/settings/security', form);
      toast.success('Credentials updated. Please login again with new credentials.');
      setForm({ adminUsername:'', adminPassword:'' });
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <InfoBanner type="warn" message="Changing credentials will require you to login again with the new details."/>
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <label className="label text-amber-800"><i className="fas fa-user-edit mr-1"/> Update Admin Username</label>
        <input className="input" value={form.adminUsername} onChange={e=>setForm(f=>({...f,adminUsername:e.target.value}))} placeholder="New username"/>
      </div>
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <label className="label text-red-700"><i className="fas fa-lock mr-1"/> Change Password</label>
        <div className="relative">
          <input type={show?'text':'password'} className="input pr-10" value={form.adminPassword} onChange={e=>setForm(f=>({...f,adminPassword:e.target.value}))} placeholder="New password (min 4 chars)"/>
          <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <i className={`fas ${show?'fa-eye-slash':'fa-eye'} text-sm`}/>
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-danger">
          {saving ? '...' : <><i className="fas fa-shield-alt"/> Update Credentials</>}
        </button>
      </div>
    </form>
  );
}

/* ── Recovery Settings ────────────────────────────────────────────────────── */
function RecoverySettings({ company }) {
  const [form,  setForm]  = useState({ recoveryMobile:'', recoveryEmail:'' });
  const [saving,setSaving]= useState(false);
  const toast = useToast();

  useEffect(() => {
    if (company) setForm({ recoveryMobile:company.recoveryMobile||'', recoveryEmail:company.recoveryEmail||'' });
  }, [company]);

  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.put('/settings/recovery', form); toast.success('Recovery info saved'); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <InfoBanner type="info" message="These details are used to verify your identity when you use 'Forgot Password'."/>
      <div><label className="label">Recovery Mobile</label>
        <input className="input" value={form.recoveryMobile} onChange={e=>setForm(f=>({...f,recoveryMobile:e.target.value}))} placeholder="Mobile number"/></div>
      <div><label className="label">Recovery Email</label>
        <input type="email" className="input" value={form.recoveryEmail} onChange={e=>setForm(f=>({...f,recoveryEmail:e.target.value}))} placeholder="Email address"/></div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? '...' : <><i className="fas fa-save"/> Save Recovery Info</>}
        </button>
      </div>
    </form>
  );
}

/* ── Subscription Info ────────────────────────────────────────────────────── */
function SubscriptionInfo({ company }) {
  if (!company) return <PageLoader/>;
  const isExpired   = company.daysRemaining === 0;
  const isWarning   = company.daysRemaining > 0 && company.daysRemaining <= 7;
  const planColors  = { trial:'bg-slate-100 text-slate-700', basic:'bg-blue-100 text-blue-700', standard:'bg-purple-100 text-purple-700', premium:'bg-amber-100 text-amber-700' };
  const planLabels  = { trial:'Trial', basic:'Basic', standard:'Standard', premium:'Premium' };
  const expDate     = company.subscriptionEnd ? new Date(company.subscriptionEnd).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—';

  return (
    <div className="space-y-4">
      {isExpired   && <InfoBanner type="danger"  message="Your subscription has expired. Contact your administrator to renew."/>}
      {isWarning   && <InfoBanner type="warn"    message={`Subscription expiring in ${company.daysRemaining} day${company.daysRemaining===1?'':'s'}. Contact your administrator to renew.`}/>}
      {!isExpired && !isWarning && <InfoBanner type="success" message="Your subscription is active."/>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label:'Current Plan',     value:<span className={`badge text-sm px-3 py-1 ${planColors[company.plan]||'badge-slate'}`}>{planLabels[company.plan]||company.plan}</span> },
          { label:'Days Remaining',   value:<span className={`font-bold text-lg ${isExpired?'text-red-600':isWarning?'text-amber-600':'text-emerald-600'}`}>{isExpired?'Expired':`${company.daysRemaining} days`}</span> },
          { label:'Subscription End', value:<span className="font-semibold text-slate-800">{expDate}</span> },
          { label:'Max Agents',       value:<span className="font-semibold text-slate-800">{company.maxAgents}</span> },
          { label:'Max Customers',    value:<span className="font-semibold text-slate-800">{company.maxCustomers===99999?'Unlimited':company.maxCustomers}</span> },
          { label:'Company Name',     value:<span className="font-semibold text-slate-800">{company.name}</span> },
        ].map(row=>(
          <div key={row.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-sm text-slate-500 font-medium">{row.label}</span>
            {row.value}
          </div>
        ))}
      </div>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <i className="fas fa-info-circle mr-2"/>
        To upgrade your plan or renew subscription, please contact your system administrator.
      </div>
    </div>
  );
}


/* ── Data Tools (Admin only) ──────────────────────────────────────────────── */
function DataTools() {
  const [status,  setStatus]  = useState(null);  // null | 'running' | 'done' | 'error'
  const [result,  setResult]  = useState(null);
  const toast = useToast();

  const recalculate = async () => {
    if (!window.confirm(
      'This will recompute all account balances from real transactions.\n\n' +
      'Safe to run — no data is deleted. Continue?'
    )) return;

    setStatus('running'); setResult(null);
    try {
      const r = await api.post('/accounts/recalculate');
      setResult(r.data);
      setStatus('done');
      toast.success(r.data.message);
    } catch (err) {
      setStatus('error');
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div className="space-y-5">
      <InfoBanner type="warn" message="These tools correct data inconsistencies. Run them only when balances appear incorrect after deleting transactions."/>

      {/* Recalculate card */}
      <div className="border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="fas fa-calculator text-amber-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm mb-1">Recalculate Account Balances</div>
            <div className="text-xs text-slate-500 mb-4 leading-relaxed">
              Recomputes every account balance from scratch using actual transactions.
              Fixes stale "ghost" balances that appear on the dashboard or balance sheet
              after transactions are deleted or edited outside the normal flow.
            </div>
            <button
              onClick={recalculate}
              disabled={status === 'running'}
              className="btn btn-warning btn-sm"
            >
              {status === 'running'
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>&nbsp;Running…</>
                : <><i className="fas fa-sync-alt"/>&nbsp;Run Recalculation</>
              }
            </button>

            {/* Result */}
            {status === 'done' && result && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5"><i className="fas fa-check-circle text-emerald-600"/> {result.message}</div>
                <div>Accounts scanned: <span className="font-semibold">{result.totalAccounts}</span></div>
                <div>Balances corrected: <span className="font-semibold">{result.fixed}</span></div>
                {result.errors?.length > 0 && (
                  <div className="text-amber-700 mt-1">
                    <span className="font-semibold">Warnings:</span> {result.errors.map(e => e.account).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 flex items-center gap-1.5">
        <i className="fas fa-shield-alt"/>
        This operation is non-destructive. Only account.balance fields are updated. All transactions remain unchanged.
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
/* ── Bluetooth Printer Configuration ─────────────────────────────────────
   Visible to both tenant admin AND agent — pairing is inherently per-
   device (a tenant's office PC won't share Bluetooth pairing with a
   field agent's phone), so this is stored in localStorage, not synced
   through the backend. Purely additive: no existing tab, route, or model
   is touched. The "BT Print" button in the Receipt modal (Transactions
   page) reads this same config — see PRINTER_CONFIG_KEY there.
────────────────────────────────────────────────────────────────────────── */
const PRINTER_CONFIG_KEY = 'fs_bt_printer_config';
const PRINTER_DEFAULTS = {
  paperWidth: '58',
  serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
  charUUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
  deviceName: '',
};

function PrinterSettings() {
  const [cfg, setCfg]   = useState(() => {
    try { return { ...PRINTER_DEFAULTS, ...JSON.parse(localStorage.getItem(PRINTER_CONFIG_KEY) || '{}') }; }
    catch { return PRINTER_DEFAULTS; }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState('');
  const toast = useToast();

  const btSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const save = (next) => {
    setCfg(next);
    localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(next));
  };
  const f = (k, v) => save({ ...cfg, [k]: v });

  const handlePair = async () => {
    if (!btSupported) {
      toast.error('Web Bluetooth is only supported on Chrome/Edge for Android. Use "Print Receipt" (system print dialog) on other devices.');
      return;
    }
    setBusy('pair');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [cfg.serviceUUID] }],
        optionalServices: [cfg.serviceUUID],
      });
      await device.gatt.connect();
      save({ ...cfg, deviceName: device.name || 'Bluetooth Printer' });
      toast.success(`Paired with ${device.name || 'printer'}`);
    } catch (err) {
      if (err?.name !== 'NotFoundError') toast.error('Could not pair — check the printer is powered on and in range.');
    } finally { setBusy(''); }
  };

  const handleForget = () => save({ ...cfg, deviceName: '' });

  const handleTestPrint = async () => {
    if (!btSupported) { toast.error('Web Bluetooth not supported on this browser/device.'); return; }
    setBusy('test');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [cfg.serviceUUID] }],
        optionalServices: [cfg.serviceUUID],
      });
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService(cfg.serviceUUID);
      const char    = await service.getCharacteristic(cfg.charUUID);

      const ESC = '\x1b';
      const text = `${ESC}@${ESC}a1Test Print OK\n--------------------------\nPrinter is configured correctly.\n\n\n`;
      const bytes = new TextEncoder().encode(text);
      for (let i = 0; i < bytes.length; i += 100) {
        await char.writeValue(bytes.slice(i, i + 100));
      }
      save({ ...cfg, deviceName: device.name || cfg.deviceName });
      toast.success('Test print sent');
    } catch (err) {
      if (err?.name !== 'NotFoundError') toast.error('Test print failed — printer may use different service UUIDs (see Advanced settings).');
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h3 className="font-bold text-slate-800 mb-1">Bluetooth Printer</h3>
        <p className="text-sm text-slate-400">Configure a thermal receipt printer for transaction vouchers</p>
      </div>

      {!btSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-700 flex gap-2.5">
          <i className="fas fa-triangle-exclamation mt-0.5"/>
          <span>Direct Bluetooth printing needs <strong>Chrome or Edge on Android</strong>. On other devices, use <strong>Print Receipt</strong> on the voucher — Android lets you pick a paired Bluetooth printer right from the system print dialog.</span>
        </div>
      )}

      {/* Paired device status */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.deviceName?'bg-emerald-100':'bg-slate-200'}`}>
            <i className={`fab fa-bluetooth-b ${cfg.deviceName?'text-emerald-600':'text-slate-400'}`}/>
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm">{cfg.deviceName || 'No printer paired'}</div>
            <div className="text-xs text-slate-400">{cfg.deviceName ? 'Ready to print' : 'Pair a printer to get started'}</div>
          </div>
        </div>
        {cfg.deviceName && (
          <button onClick={handleForget} className="btn btn-secondary btn-sm"><i className="fas fa-trash"/> Forget</button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={handlePair} disabled={!!busy} className="btn btn-primary flex-1">
          {busy==='pair' ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fab fa-bluetooth-b"/>}
          Pair Printer
        </button>
        <button onClick={handleTestPrint} disabled={!!busy} className="btn btn-success flex-1">
          {busy==='test' ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-print"/>}
          Test Print
        </button>
      </div>

      {/* Paper width */}
      <div>
        <label className="label">Paper Width</label>
        <div className="flex gap-2">
          {['58','80'].map(w => (
            <button key={w} onClick={()=>f('paperWidth',w)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${cfg.paperWidth===w ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              {w}mm
            </button>
          ))}
        </div>
      </div>

      {/* Advanced — UUID overrides for non-standard printers */}
      <div className="border-t border-slate-100 pt-4">
        <button onClick={()=>setShowAdvanced(s=>!s)} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <i className={`fas fa-chevron-${showAdvanced?'down':'right'} text-xs`}/> Advanced (Service/Characteristic UUIDs)
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 gap-3 mt-3">
            <div>
              <label className="label">Service UUID</label>
              <input className="input font-mono text-sm" value={cfg.serviceUUID} onChange={e=>f('serviceUUID',e.target.value)}/>
            </div>
            <div>
              <label className="label">Characteristic UUID</label>
              <input className="input font-mono text-sm" value={cfg.charUUID} onChange={e=>f('charUUID',e.target.value)}/>
            </div>
            <p className="text-xs text-slate-400">
              Defaults match the common UART-style service used by most generic ESC/POS Bluetooth printers. Only change these if your printer's documentation specifies different UUIDs and Test Print fails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


 const TABS = [
  { id:'org',          label:'Organization', icon:'fa-building',    adminOnly:false },
  { id:'config',       label:'Configuration',icon:'fa-sliders',     adminOnly:true },
  { id:'security',     label:'Security',     icon:'fa-lock',        adminOnly:true },
  { id:'recovery',     label:'Recovery',     icon:'fa-shield-alt',  adminOnly:true },
  { id:'subscription', label:'Subscription', icon:'fa-credit-card', adminOnly:false },
  { id:'printer',      label:'Printer',      icon:'fa-print',       adminOnly:false },
  { id:'data_tools',   label:'Data Tools',   icon:'fa-database',    adminOnly:true },
];

export default function SettingsPage() {
  const [tab,     setTab]     = useState('org');
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const toast = useToast();

  const load = async () => {
    try { setLoading(true); const r = await api.get('/settings'); setCompany(r.data); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your company profile, security and subscription"/>
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Tab nav */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex lg:flex-col gap-1">
            {visibleTabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 lg:flex-none ${tab===t.id?'bg-blue-600 text-white shadow-sm':'text-slate-600 hover:bg-slate-50'}`}>
                <i className={`fas ${t.icon} w-4 text-center flex-shrink-0`}/>
                <span className="hidden sm:inline lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="card">
            {loading ? <PageLoader/> : (
              <>
                {tab==='org'          && <OrgSettings company={company} onSave={load}/>}
                {tab==='config'       && isAdmin && (
                  <div>
                    <h3 className="font-bold text-slate-800 text-base mb-0.5">Configuration</h3>
                    <p className="text-xs text-slate-400 mb-4">Default interest, late fee, grace period and due day for new loans, deposits and pigmy accounts</p>
                    <ConfigEditor endpoint="/config" canEdit />
                  </div>
                )}
                {tab==='security'     && isAdmin && <SecuritySettings/>}
                {tab==='recovery'     && isAdmin && <RecoverySettings company={company}/>}
                {tab==='subscription' && <SubscriptionInfo company={company}/>}
                {tab==='printer'      && <PrinterSettings/>}
                {tab==='data_tools'   && isAdmin && <DataTools/>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
