import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMsg, dateDisp, fmt, PLAN_COLORS, PLAN_LABELS } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, PageLoader, EmptyState, ConfirmDialog, SearchInput, InfoBanner } from '../shared';
import ConfigEditor from '../config/ConfigEditor';

const PLANS = [
  { value:'trial',    label:'Trial',    days:20, agents:2,   customers:100   },
  { value:'basic',    label:'Basic',    days:365, agents:5,   customers:500   },
  { value:'standard', label:'Standard', days:365, agents:15,  customers:2000  },
  { value:'premium',  label:'Premium',  days:365, agents:100, customers:99999 },
];
const BTYPE = ['Finance','NBFC','Micro Finance','Credit Society','Chit Fund','Other'];

const TYPE_COLORS = { deposit:'badge-green', withdraw:'badge-red', disburse:'badge-amber', repay_princ:'badge-blue', adjustment:'badge-slate', agent_handover:'badge-green', income:'badge-green', expense:'badge-red' };
const TYPE_LABELS = { deposit:'Deposit', withdraw:'Withdraw', disburse:'Disburse', repay_princ:'Repayment', adjustment:'Adjustment', agent_handover:'Handover', income:'Income', expense:'Expense' };
const isIncoming  = t => ['deposit','repay_princ','income','agent_handover'].includes(t);

/* ── Sidebar nav items ──────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id:'dashboard',    label:'Companies',     icon:'fa-building'        },
  { id:'transactions', label:'Transactions',  icon:'fa-arrows-exchange' },
  { id:'reports',      label:'Reports',       icon:'fa-chart-bar'       },
  { id:'acc_group',    label:'Account Group', icon:'fa-stack-2'         },
  { id:'acc_master',   label:'Account Master',icon:'fa-book'            },
  { id:'settings',     label:'Settings',      icon:'fa-cog'             },
];

// ─── Company Form (unchanged) ─────────────────────────────────────────────
function CompanyForm({ company, onSave, onClose }) {
  const blank = {
    name:'', adminUsername:'', adminPassword:'', email:'', mobile:'',
    address:'', city:'', state:'', pincode:'', website:'', adminName:'',
    businessType:'Finance', plan:'standard', subscriptionDays:'365', notes:'',
    // ── Billing / Pricing Configuration ──────────────────────────────────
    softwarePrice:'25000', amcAmount:'10000', taxType:'without_tax',
    agentPrice:'5000', agentCount:'1',
    activeUserPrice:'1000', activeUserCount:'2',
    websiteSaleAmount:'0', fromDate: new Date().toISOString().split('T')[0],
    billingNotes:'',
  };
  const b = company?.billing || {};
  const [form, setForm]   = useState(company
    ? { ...blank, name:company.name, adminUsername:company.adminUsername, adminPassword:'',
        email:company.email||'', mobile:company.mobile||'', address:company.address||'',
        city:company.city||'', state:company.state||'', pincode:company.pincode||'',
        website:company.website||'', adminName:company.adminName||'',
        businessType:company.businessType||'Finance', plan:company.plan||'standard',
        notes:company.notes||'',
        softwarePrice:String(b.softwarePrice ?? 25000),
        amcAmount:String(b.amcAmount ?? 10000),
        taxType: b.taxType || 'without_tax',
        agentPrice:String(b.agentPrice ?? 5000),
        agentCount:String(b.agentCount ?? company.maxAgents ?? 15),
        activeUserPrice:String(b.activeUserPrice ?? 1000),
        activeUserCount:String(b.activeUserCount ?? 2),
        websiteSaleAmount:String(b.websiteSaleAmount ?? 0),
        fromDate: (b.fromDate ? new Date(b.fromDate) : new Date()).toISOString().split('T')[0],
        billingNotes: b.billingNotes || '',
      }
    : blank);
  const [saving, setSaving] = useState(false);
  const [tab,    setTab]    = useState('basic');
  const toast = useToast();

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const num = v => parseFloat(v) || 0;

  // ── Live billing calculations ────────────────────────────────────────
  const agentTotal      = num(form.agentPrice) * num(form.agentCount);
  const activeUserTotal = num(form.activeUserPrice) * num(form.activeUserCount);
  const amcTotal         = num(form.amcAmount) + activeUserTotal;
  const grandTotal        = num(form.softwarePrice) + agentTotal + amcTotal + num(form.websiteSaleAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const {
        softwarePrice, amcAmount, taxType, agentPrice, agentCount,
        activeUserPrice, activeUserCount, websiteSaleAmount, fromDate, billingNotes,
        ...rest
      } = form;

      const payload = {
        ...rest,
        billing: {
          softwarePrice: num(softwarePrice), amcAmount: num(amcAmount), taxType,
          agentPrice: num(agentPrice), agentCount: num(agentCount),
          activeUserPrice: num(activeUserPrice), activeUserCount: num(activeUserCount),
          websiteSaleAmount: num(websiteSaleAmount), fromDate, billingNotes,
        },
      };
      if (company) delete payload.subscriptionDays;
      if (company) await api.put(`/companies/${company._id}`, payload);
      else         await api.post('/companies', payload);
      toast.success(company ? 'Company updated' : 'Company created — defaults seeded');
      onSave();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const TABS = [['basic','Basic Info'],['contact','Contact'],['admin','Admin & Security'],['plan','Plan & Pricing']];
  const fmtN = n => '₹' + (n||0).toLocaleString('en-IN');

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex border-b border-slate-200 px-5 bg-slate-50 overflow-x-auto">
        {TABS.map(([t,l]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${tab===t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="modal-body space-y-4">
        {tab === 'basic' && <>
          <div className="field"><label className="label">Company Name <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={e=>f('name',e.target.value)} required placeholder="e.g. ABC Finance Pvt Ltd" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label className="label">Business Type</label>
              <select className="select" value={form.businessType} onChange={e=>f('businessType',e.target.value)}>
                {BTYPE.map(b => <option key={b}>{b}</option>)}</select></div>
            <div className="field"><label className="label">City</label>
              <input className="input" value={form.city} onChange={e=>f('city',e.target.value)} placeholder="City" /></div>
            <div className="field"><label className="label">State</label>
              <input className="input" value={form.state} onChange={e=>f('state',e.target.value)} placeholder="State" /></div>
            <div className="field"><label className="label">Pincode</label>
              <input className="input" value={form.pincode} onChange={e=>f('pincode',e.target.value)} placeholder="Pincode" /></div>
          </div>
          <div className="field"><label className="label">Full Address</label>
            <textarea className="input h-16 resize-none" value={form.address} onChange={e=>f('address',e.target.value)} placeholder="Street address" /></div>
          <div className="field"><label className="label">Internal Notes (Super Admin only)</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="e.g. referred by X, payment details..." /></div>
        </>}

        {tab === 'contact' && <>
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label className="label">Mobile</label>
              <input className="input" value={form.mobile} onChange={e=>f('mobile',e.target.value)} placeholder="+91 XXXXXXXXXX" /></div>
            <div className="field"><label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="company@email.com" /></div>
            <div className="field col-span-2"><label className="label">Website</label>
              <input className="input" value={form.website} onChange={e=>f('website',e.target.value)} placeholder="https://..." /></div>
          </div>
        </>}

        {tab === 'admin' && <>
          <div className="field"><label className="label">Admin Name (Display)</label>
            <input className="input" value={form.adminName} onChange={e=>f('adminName',e.target.value)} placeholder="Full name of admin" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label className="label">Admin Username <span className="text-red-500">*</span></label>
              <input className="input" value={form.adminUsername} onChange={e=>f('adminUsername',e.target.value)} required placeholder="Login username" /></div>
            <div className="field"><label className="label">{company ? 'New Password (leave blank = no change)' : 'Password *'}</label>
              <input type="password" className="input" value={form.adminPassword} onChange={e=>f('adminPassword',e.target.value)} required={!company} placeholder={company ? '••••••••' : 'Min 4 chars'} /></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
            <i className="fas fa-shield-alt mt-0.5" />
            <span>These credentials are used for the company admin login. Keep them secure.</span>
          </div>
        </>}

        {tab === 'plan' && <>
          {/* ── Plan selection: Standard only (per current pricing policy) ── */}
          <div className="field">
            <label className="label">Select Plan</label>
            <div className="mt-1">
              <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-500 bg-blue-50 cursor-default">
                <input type="radio" checked readOnly className="mt-0.5" />
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-crown text-white text-sm"/>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">Standard Plan</div>
                    <div className="text-xs text-slate-500">Software + AMC + Agent App &nbsp;·&nbsp; 15 Agents &nbsp;·&nbsp; 2000 Customers &nbsp;·&nbsp; 365 Days</div>
                  </div>
                </div>
                <span className="badge badge-blue text-xs flex-shrink-0">Active</span>
              </label>
            </div>
          </div>

          {!company && (
            <div className="field"><label className="label">Subscription Duration (days)</label>
              <input type="number" className="input" value={form.subscriptionDays} onChange={e=>f('subscriptionDays',e.target.value)} min={1} /></div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Pricing Configuration</div>

            {/* Software Price + AMC — side-by-side with a vertical divider */}
            <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden mb-3">
              <div className="p-3.5 border-r border-slate-200">
                <label className="label">Software Price (₹)</label>
                <input type="number" className="input" value={form.softwarePrice} onChange={e=>f('softwarePrice',e.target.value)} placeholder="25000" />
              </div>
              <div className="p-3.5">
                <label className="label">AMC Amount (₹)</label>
                <input type="number" className="input mb-2" value={form.amcAmount} onChange={e=>f('amcAmount',e.target.value)} placeholder="10000" />
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="radio" name="taxType" checked={form.taxType==='without_tax'} onChange={()=>f('taxType','without_tax')}/> Without Tax
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="radio" name="taxType" checked={form.taxType==='with_tax'} onChange={()=>f('taxType','with_tax')}/> With Tax
                  </label>
                </div>
              </div>
            </div>

            {/* Agent App Price block */}
            <div className="border border-slate-200 rounded-xl p-3.5 mb-3">
              <div className="text-xs font-bold text-slate-600 mb-2">Agent App Price</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Price / Agent</label>
                  <input type="number" className="input" value={form.agentPrice} onChange={e=>f('agentPrice',e.target.value)} placeholder="5000" /></div>
                <div><label className="label">No. of Agents</label>
                  <input type="number" className="input" value={form.agentCount} onChange={e=>f('agentCount',e.target.value)} placeholder="15" /></div>
                <div><label className="label">Total Amount</label>
                  <div className="input bg-slate-50 text-slate-700 font-bold flex items-center">{fmtN(agentTotal)}</div></div>
              </div>
            </div>

            {/* AMC Active Users block */}
            <div className="border border-slate-200 rounded-xl p-3.5 mb-3">
              <div className="text-xs font-bold text-slate-600 mb-2">AMC — Active Users</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">AMC / Active User</label>
                  <input type="number" className="input" value={form.activeUserPrice} onChange={e=>f('activeUserPrice',e.target.value)} placeholder="1000" /></div>
                <div><label className="label">No. of Active Users</label>
                  <input type="number" className="input" value={form.activeUserCount} onChange={e=>f('activeUserCount',e.target.value)} placeholder="2" /></div>
                <div><label className="label">Total Amount</label>
                  <div className="input bg-slate-50 text-slate-700 font-bold flex items-center">{fmtN(activeUserTotal)}</div></div>
              </div>
            </div>

            {/* Additional fields */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="field"><label className="label">From Date</label>
                <input type="date" className="input" value={form.fromDate} onChange={e=>f('fromDate',e.target.value)} /></div>
              <div className="field"><label className="label">Website Sale Amount (₹)</label>
                <input type="number" className="input" value={form.websiteSaleAmount} onChange={e=>f('websiteSaleAmount',e.target.value)} placeholder="0" /></div>
            </div>
            <div className="field mb-4"><label className="label">Billing Notes</label>
              <textarea className="input h-16 resize-none" value={form.billingNotes} onChange={e=>f('billingNotes',e.target.value)} placeholder="Optional billing remarks…" /></div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">Summary</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Software Price</span><span className="font-semibold text-slate-800">{fmtN(num(form.softwarePrice))}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Agent App Total</span><span className="font-semibold text-slate-800">{fmtN(agentTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">AMC Total <span className="text-xs text-slate-400">({form.taxType==='with_tax'?'with tax':'without tax'})</span></span><span className="font-semibold text-slate-800">{fmtN(amcTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Website Sale Amount</span><span className="font-semibold text-slate-800">{fmtN(num(form.websiteSaleAmount))}</span></div>
                <div className="flex justify-between pt-2 border-t border-blue-200 mt-1">
                  <span className="font-bold text-blue-800">Grand Total</span>
                  <span className="font-bold text-blue-800 text-base">{fmtN(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </>}
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {company ? 'Update Company' : 'Create Company'}
        </button>
      </div>
    </form>
  );
}

// ─── Renew Modal (unchanged) ───────────────────────────────────────────────
function RenewModal({ company, onSave, onClose }) {
  const [periodValue, setPeriodValue] = useState(1);
  const [periodType,  setPeriodType]  = useState('days');
  const [dateMode,    setDateMode]    = useState('duration'); // 'duration' | 'custom'
  const [customDate,  setCustomDate]  = useState('');
  const [saving,       setSaving]      = useState(false);
  const toast = useToast();

  const isExpired = company.daysRemaining === 0;
  const amcAmount = company.billing?.amcAmount || 0;

  const getTotalDays = () => {
    const val = parseInt(periodValue) || 0;
    if (periodType === 'days') return val;
    if (periodType === 'months') return val * 30;
    if (periodType === 'years') return val * 365;
    return 0;
  };

  // ── Preview the resulting expiry date for either mode ───────────────────
  const previewDate = () => {
    if (dateMode === 'custom') {
      if (!customDate) return null;
      return new Date(customDate);
    }
    const days = getTotalDays();
    if (!days || days <= 0) return null;
    const base = isExpired ? new Date() : new Date(company.subscriptionEnd);
    return new Date(base.getTime() + days * 86400000);
  };
  const preview = previewDate();

  const handleRenew = async () => {
    setSaving(true);
    try {
      const payload = { plan: 'standard' };
      if (dateMode === 'custom') {
        if (!customDate) throw new Error('Pick a new expiry date');
        payload.endDate = customDate;          // backend sets subscriptionEnd directly
      } else {
        const days = getTotalDays();
        if (days <= 0) throw new Error('Invalid duration');
        payload.days = days;                   // backend extends from current/today
      }
      const r = await api.put(`/companies/${company._id}/subscription`, payload);
      toast.success(r.data.message);
      onSave();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-body space-y-5">
      {isExpired && (
        <InfoBanner type="danger" message="This company's subscription has expired. Renewing will reactivate access." />
      )}
      <div className="p-4 bg-slate-50 rounded-xl space-y-1">
        <div className="flex justify-between text-sm"><span className="text-slate-500">Company</span><span className="font-semibold">{company.name}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Current Plan</span><span className="font-semibold capitalize">{company.plan}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Expiry Date</span><span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>{dateDisp(company.subscriptionEnd?.split?.('T')?.[0] || company.subscriptionEnd)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Days Remaining</span><span className={`font-bold ${isExpired ? 'text-red-600' : company.daysRemaining<=7 ? 'text-amber-600' : 'text-emerald-600'}`}>{isExpired ? 'EXPIRED' : `${company.daysRemaining} days`}</span></div>
      </div>

      {/* ── Plan: Standard only, with this tenant's AMC shown alongside ── */}
      <div className="field">
        <label className="label">New Plan</label>
        <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-500 bg-blue-50 cursor-default">
          <input type="radio" checked readOnly className="mt-0.5" />
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-crown text-white text-sm"/>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800">Standard Plan</div>
              <div className="text-xs text-slate-500">365 days &nbsp;·&nbsp; 15 agents &nbsp;·&nbsp; 2000 customers</div>
            </div>
          </div>
          {/* This tenant's configured AMC, pulled from Plan & Pricing */}
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">AMC for {company.name}</div>
            <div className="font-bold text-blue-700 text-sm">
              {amcAmount > 0 ? fmt.format(amcAmount) : <span className="text-slate-400 font-normal">Not set</span>}
            </div>
          </div>
        </label>
        {amcAmount === 0 && (
          <p className="text-xs text-slate-400 mt-1.5">
            No AMC configured for this tenant yet — set it in <strong>Edit → Plan &amp; Pricing</strong>.
          </p>
        )}
      </div>

      {/* ── Duration vs Custom Date toggle ──────────────────────────────── */}
      <div className="field">
        <label className="label">Renewal Method</label>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={()=>setDateMode('duration')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${dateMode==='duration' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            <i className="fas fa-clock mr-1.5"/> Duration
          </button>
          <button type="button" onClick={()=>setDateMode('custom')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${dateMode==='custom' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            <i className="fas fa-calendar-alt mr-1.5"/> Custom Date
          </button>
        </div>

        {dateMode === 'duration' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label className="label">Duration</label>
              <div className="flex gap-2">
                <input type="number" className="input w-24" value={periodValue} onChange={e => setPeriodValue(e.target.value)} min={1} step={1} />
                <select className="select w-28" value={periodType} onChange={e => setPeriodType(e.target.value)}>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
            <div className="field"><label className="label">New Expiry Date (preview)</label>
              <div className="input bg-slate-50 text-slate-600 text-sm flex items-center">
                {preview ? preview.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label className="label">New Expiry Date</label>
              <input type="date" className="input" value={customDate} onChange={e=>setCustomDate(e.target.value)} min={new Date().toISOString().split('T')[0]} required/>
            </div>
            <div className="field"><label className="label">Days from today</label>
              <div className="input bg-slate-50 text-slate-600 text-sm flex items-center">
                {preview ? `${Math.max(0, Math.ceil((preview - new Date()) / 86400000))} days` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer px-0 pb-0">
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button onClick={handleRenew} disabled={saving} className="btn btn-success">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-sync-alt" />}
          {isExpired ? 'Reactivate' : 'Renew Subscription'}
        </button>
      </div>
    </div>
  );
}

// ─── Company Stats Modal (unchanged) ──────────────────────────────────────
function StatsModal({ company, onClose }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get(`/companies/${company._id}/stats`).then(r=>setStats(r.data)).catch(()=>{});
  }, [company._id]);

  return (
    <div className="modal-body space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label:'Customers',    value:stats?.customers   ?? '…', icon:'fa-users',       color:'text-blue-600 bg-blue-50' },
          { label:'Transactions', value:stats?.transactions?? '…', icon:'fa-exchange-alt', color:'text-emerald-600 bg-emerald-50' },
          { label:'Agents',       value:stats?.agents      ?? '…', icon:'fa-user-tie',     color:'text-purple-600 bg-purple-50' },
          { label:'Plan',         value:PLAN_LABELS[company.plan]||company.plan, icon:'fa-tag', color:'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="p-4 bg-slate-50 rounded-xl">
            <div className={`w-8 h-8 ${s.color} rounded-lg flex items-center justify-center mb-2`}><i className={`fas ${s.icon} text-sm`}/></div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-xs text-slate-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 text-sm">
        {[
          ['Business Type', company.businessType],
          ['City', company.city],
          ['Mobile', company.mobile],
          ['Email', company.email],
          ['Website', company.website],
          ['Admin Name', company.adminName],
          ['Subscription Start', dateDisp(company.subscriptionStart?.split?.('T')?.[0])],
          ['Subscription End', dateDisp(company.subscriptionEnd?.split?.('T')?.[0])],
          ['Max Agents', company.maxAgents],
          ['Max Customers', company.maxCustomers === 99999 ? 'Unlimited' : company.maxCustomers],
        ].map(([k,v]) => v ? (
          <div key={k} className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">{k}</span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ) : null)}
        {company.notes && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <div className="font-semibold mb-1">Internal Notes</div>
            <div>{company.notes}</div>
          </div>
        )}
      </div>
      <div className="modal-footer px-0 pb-0"><button onClick={onClose} className="btn btn-secondary w-full">Close</button></div>
    </div>
  );
}

// ─── Suspend Modal (unchanged) ────────────────────────────────────────────
function SuspendModal({ company, onSave, onClose }) {
  const [reason, setReason] = useState(company.suspendReason || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSuspend = async () => {
    setSaving(true);
    try {
      await api.delete(`/companies/${company._id}`, { data: { reason } });
      toast.success('Company suspended');
      onSave();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };
  const handleReactivate = async () => {
    setSaving(true);
    try {
      await api.put(`/companies/${company._id}`, { isActive: true, suspendReason: '' });
      toast.success('Company reactivated');
      onSave();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-body space-y-4">
      {company.isActive
        ? <>
            <InfoBanner type="warn" message="Suspending will immediately block all logins for this company." />
            <div className="field"><label className="label">Reason for Suspension</label>
              <textarea className="input h-20 resize-none" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Non-payment, policy violation..." /></div>
            <div className="modal-footer px-0 pb-0">
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSuspend} disabled={saving} className="btn btn-danger">
                {saving?'…':<><i className="fas fa-ban" /> Suspend Company</>}
              </button>
            </div>
          </>
        : <>
            <InfoBanner type="info" message={`This company is currently suspended${company.suspendReason ? `: "${company.suspendReason}"` : ''}.`} />
            <div className="modal-footer px-0 pb-0">
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleReactivate} disabled={saving} className="btn btn-success">
                {saving?'…':<><i className="fas fa-check-circle" /> Reactivate Company</>}
              </button>
            </div>
          </>
      }
    </div>
  );
}

// ─── Billing Modal — Fixed Balance + Receipt/Payment recording ───────────
// This is the "select the tenant → see fixed balance" flow. Opening Balance
// here means the Fixed Amount (grandTotal) computed from the Plan & Pricing
// tab. Paid Amount accumulates from recorded receipts. Remaining Amount is
// always grandTotal - paidAmount, recomputed server-side on every payment.
function BillingModal({ company, onSave, onClose }) {
  const [type,    setType]    = useState('receipt'); // 'receipt' | 'payment'
  const [mode,    setMode]    = useState('cash');
  const [amount,  setAmount]  = useState('');
  const [remarks, setRemarks] = useState('');
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [saving,  setSaving]  = useState(false);

  // ── Live payment history, sourced from the platform ledger (single
  //    source of truth — same data the Transactions page writes to) ──────
  const [history,     setHistory]     = useState([]);
  const [histLoading,  setHistLoading] = useState(true);
  const [editingId,   setEditingId]   = useState(null);
  const [editAmt,     setEditAmt]     = useState('');
  const [editDesc,    setEditDesc]    = useState('');
  const [editDate,    setEditDate]    = useState('');

  const toast = useToast();

  const fixedAmount     = company.billing?.grandTotal || 0;
  const paidAmount      = company.paidAmount || 0;
  const remainingAmount = company.remainingAmount ?? Math.max(0, fixedAmount - paidAmount);
  const status          = company.paymentStatus || 'unpaid';

  const statusBadge = {
    paid:    { cls:'badge-green',  label:'Paid'    },
    partial: { cls:'badge-orange', label:'Partial' },
    unpaid:  { cls:'badge-red',    label:'Unpaid'  },
  }[status];

  const loadHistory = useCallback(async () => {
    try {
      setHistLoading(true);
      const r = await api.get(`/platform/transactions?tenantCompanyId=${company._id}&category=tenant_receipt&limit=100`);
      setHistory(r.data || []);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setHistLoading(false); }
  }, [company._id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const r = await api.post(`/companies/${company._id}/billing-payment`, { type, amount: amt, mode, remarks, date });
      toast.success(r.data.message);
      setAmount(''); setRemarks('');
      loadHistory();
      onSave();   // refreshes the company list in the parent (updates Opening/Paid/Remaining here)
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const startEdit = (h) => {
    setEditingId(h._id);
    setEditAmt(String(h.amt));
    setEditDesc(h.desc || '');
    setEditDate(h.date);
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    const amt = parseFloat(editAmt);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    try {
      await api.put(`/platform/transactions/${editingId}`, { date: editDate, amt, desc: editDesc });
      toast.success('Payment updated');
      setEditingId(null);
      loadHistory();
      onSave();   // re-syncs Opening/Paid/Remaining since the amount may have changed
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const deleteEntry = async (h) => {
    if (!window.confirm(`Delete this receipt of ${fmt.format(h.amt)}? Fixed Balance will be reversed.`)) return;
    try {
      await api.delete(`/platform/transactions/${h._id}`);
      toast.success('Deleted and balance reversed');
      loadHistory();
      onSave();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  return (
    <div className="modal-body space-y-5">
      {/* Fixed Balance summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-xl text-center">
          <div className="text-xs text-slate-400 font-medium mb-1">Opening Balance</div>
          <div className="font-bold text-slate-800 text-sm">{fmt.format(fixedAmount)}</div>
        </div>
        <div className="p-3.5 bg-emerald-50 rounded-xl text-center">
          <div className="text-xs text-emerald-500 font-medium mb-1">Paid Amount</div>
          <div className="font-bold text-emerald-700 text-sm">{fmt.format(paidAmount)}</div>
        </div>
        <div className={`p-3.5 rounded-xl text-center ${remainingAmount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <div className={`text-xs font-medium mb-1 ${remainingAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Remaining</div>
          <div className={`font-bold text-sm ${remainingAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt.format(remainingAmount)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500">Payment Status</span>
        <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
      </div>

      {remainingAmount <= 0 && fixedAmount > 0 && (
        <InfoBanner type="info" message="This company's Fixed Balance is fully paid." />
      )}

      <div className="border-t border-slate-100 pt-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Record Transaction</div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} required/></div>
            <div className="field"><label className="label">Transaction Type</label>
              <div className="flex gap-3 mt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={type==='receipt'} onChange={()=>setType('receipt')}/> Receipt
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={type==='payment'} onChange={()=>setType('payment')}/> Payment
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Payment Mode</label>
              <div className="flex gap-3 mt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={mode==='cash'} onChange={()=>setMode('cash')}/> Cash
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={mode==='bank'} onChange={()=>setMode('bank')}/> Bank
                </label>
              </div>
            </div>
            <div className="field"><label className="label">Amount (₹)</label>
              <input type="number" className="input" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/></div>
          </div>

          <div className="field"><label className="label">Remarks</label>
            <input className="input" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Optional remarks"/></div>

          <div className="modal-footer px-0 pb-0">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-check"/>}
              Submit
            </button>
          </div>
        </form>
      </div>

      {/* ── Payment History — live from the platform ledger, with inline
             edit/delete right next to the form above for fast corrections ── */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Payment History</div>
          {!histLoading && <span className="text-xs text-slate-400">{history.length} entr{history.length===1?'y':'ies'}</span>}
        </div>

        {histLoading ? (
          <div className="flex justify-center py-4">
            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400">No receipts recorded yet</div>
        ) : (
          
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {history.map(h => (
              editingId === h._id ? (
                /* ── Inline edit row ──────────────────────────────────── */
                <div key={h._id} className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="input text-xs py-1.5" value={editDate} onChange={e=>setEditDate(e.target.value)}/>
                    <input type="number" className="input text-xs py-1.5" value={editAmt} onChange={e=>setEditAmt(e.target.value)} placeholder="Amount"/>
                  </div>
                  <input className="input text-xs py-1.5" value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder="Remarks"/>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={cancelEdit} className="btn btn-secondary btn-sm text-xs py-1">Cancel</button>
                    <button onClick={saveEdit} className="btn btn-primary btn-sm text-xs py-1"><i className="fas fa-check"/> Save</button>
                  </div>
                </div>
              ) : (
                /* ── Normal display row ──────────────────────────────── */
                <div key={h._id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="badge text-[10px] badge-green">receipt</span>
                    <span className="text-slate-500 flex-shrink-0">{dateDisp(h.date)}</span>
                    <span className="text-slate-400 truncate">{h.desc || h.cashAccountId?.name || ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-semibold text-slate-700">{fmt.format(h.amt)}</span>
                    <button onClick={()=>startEdit(h)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fas fa-pen" style={{fontSize:'10px'}}/>
                    </button>
                    <button onClick={()=>deleteEntry(h)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fas fa-trash" style={{fontSize:'10px'}}/>
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Agent Modal (unchanged) ───────────────────────────────────────
// ─── Professional Agent Registration Form ──────────────────────────────────
function CreateAgentModal({ company, onSave, onClose }) {
  const [form, setForm] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    email: '', 
    mobile: '',
    startDate: new Date().toISOString().split('T')[0], // Defaults to today
    durationValue: '1',                                // Default value
    durationType: 'years',                              // Default type (1 Year)
    expiryDate: ''                                      // Recomputed automatically
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();

  // ── Live Expiry Date Calculation Engine ──
  useEffect(() => {
    if (!form.startDate) {
      setForm(prev => ({ ...prev, expiryDate: '' }));
      return;
    }

    const start = new Date(form.startDate);
    const value = parseInt(form.durationValue) || 0;

    if (value <= 0) {
      setForm(prev => ({ ...prev, expiryDate: '' }));
      return;
    }

    if (form.durationType === 'days') {
      start.setDate(start.getDate() + value);
    } else if (form.durationType === 'months') {
      start.setMonth(start.getMonth() + value);
    } else if (form.durationType === 'years') {
      start.setFullYear(start.getFullYear() + value);
    }

    const calculatedExpiry = start.toISOString().split('T')[0];
    setForm(prev => ({ ...prev, expiryDate: calculatedExpiry }));
  }, [form.startDate, form.durationValue, form.durationType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseInt(form.durationValue) <= 0) return toast.error('Please enter a valid duration');
    
    setSaving(true);
    try {
      // Constructs payload explicitly separating layout configuration
      const payload = {
        username: form.username,
        password: form.password,
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        validFrom: form.startDate,
        validTill: form.expiryDate,
        duration: {
          value: parseInt(form.durationValue),
          type: form.durationType
        }
      };

      await api.post(`/companies/${company._id}/agents`, payload);
      toast.success('Agent registered successfully');
      onSave();
    } catch (err) { 
      toast.error(getErrorMsg(err)); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <form onSubmit={handleSubmit} className="modal-body space-y-4">
      
      {/* Step 1: Authentication block */}
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2">
        Authentication Details
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className="label">Username <span className="text-red-500">*</span></label>
          <input 
            className="input" 
            value={form.username} 
            onChange={e => setForm({ ...form, username: e.target.value })} 
            placeholder="e.g. agent_raghu"
            required 
          />
        </div>
        <div className="field">
          <label className="label">Password <span className="text-red-500">*</span></label>
          <div className="relative mt-1">
            <input 
              type={showPassword ? 'text' : 'password'} 
              className="input pr-10" 
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              placeholder="••••••••"
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(p => !p)} 
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Personal Profile block */}
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 pt-2 mb-2">
        Profile Configuration
      </div>

      <div className="field">
        <label className="label">Full Name</label>
        <input 
          className="input" 
          value={form.name} 
          onChange={e => setForm({ ...form, name: e.target.value })} 
          placeholder="e.g. Raghu Ram"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className="label">Email Address</label>
          <input 
            type="email" 
            className="input" 
            value={form.email} 
            onChange={e => setForm({ ...form, email: e.target.value })} 
            placeholder="agent@finsphere.com"
          />
        </div>
        <div className="field">
          <label className="label">Mobile Number</label>
          <input 
            className="input" 
            value={form.mobile} 
            onChange={e => setForm({ ...form, mobile: e.target.value })} 
            placeholder="+91 XXXXXXXXXX"
          />
        </div>
      </div>

      {/* Step 3: Service Validity block */}
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 pt-2 mb-2">
        Subscription &amp; Access Validity
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className="label">Service Start Date</label>
          <input 
            type="date" 
            className="input" 
            value={form.startDate} 
            onChange={e => setForm({ ...form, startDate: e.target.value })} 
            required
          />
        </div>

        <div className="field">
          <label className="label">Access Duration</label>
          <div className="flex gap-2 mt-1">
            <input 
              type="number" 
              className="input w-24" 
              value={form.durationValue} 
              onChange={e => setForm({ ...form, durationValue: e.target.value })} 
              min="1" 
              required 
            />
            <select 
              className="select flex-1" 
              value={form.durationType} 
              onChange={e => setForm({ ...form, durationType: e.target.value })}
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Calculated Expiry Premium Card */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <i className="fas fa-calendar-check text-sm" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Automated Expiry Date</div>
            <div className="text-sm font-bold text-slate-800">
              {form.expiryDate ? new Date(form.expiryDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
            </div>
          </div>
        </div>
        <span className="badge badge-blue text-[11px] font-bold uppercase tracking-wider">Live Sync</span>
      </div>

      {/* Footer controls */}
      <div className="modal-footer px-0 pb-0 pt-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary min-w-[120px]">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Register Agent'}
        </button>
      </div>
    </form>
  );
}

 /* ══════════════════════════════════════════════════════════════════════════
   PAGE: Companies (Full Moving Neon Borders & Sticky Header Layout)
══════════════════════════════════════════════════════════════════════════ */
function CompaniesDashboard({ companies, loading, fetchAll, onEdit, onRenew, onView, onSuspend, onCreateAgent, onBilling, onConfig, onBackup, onAddCompany }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.adminUsername.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' && c.isActive) || (filterStatus === 'inactive' && !c.isActive) || (filterStatus === 'expired' && c.daysRemaining === 0 && c.isActive);
    const matchPlan = filterPlan === 'all' || c.plan === filterPlan;
    return matchSearch && matchStatus && matchPlan;
  });

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.isActive).length,
    expired: companies.filter(c => c.daysRemaining === 0 && c.isActive).length,
    expiring: companies.filter(c => c.daysRemaining > 0 && c.daysRemaining <= 7).length,
    trial: companies.filter(c => c.plan === 'trial').length,
    suspended: companies.filter(c => !c.isActive).length,
    agentExpired: companies.reduce((acc, c) => acc + (c.daysRemaining === 0 && c.isActive ? (Number(c.maxAgents) || 0) : 0), 0),
    agentExpiring: companies.reduce((acc, c) => acc + (c.daysRemaining > 0 && c.daysRemaining <= 7 ? (Number(c.maxAgents) || 0) : 0), 0),
  };

  const expiryColor = (c) => {
    if (!c.isActive) return 'badge-slate';
    if (c.daysRemaining === 0) return 'badge-red';
    if (c.daysRemaining <= 7) return 'badge-orange';
    return 'badge-green';
  };
  const expiryLabel = (c) => {
    if (!c.isActive) return 'Suspended';
    if (c.daysRemaining === 0) return 'Expired';
    if (c.daysRemaining <= 7) return `${c.daysRemaining}d left`;
    return `${c.daysRemaining}d`;
  };

  return (
    <div className="space-y-4">
      {/* Expired banner */}
      {(stats.expired > 0 || stats.expiring > 0) && (
        <InfoBanner
          type={stats.expired > 0 ? 'danger' : 'warn'}
          message={`${stats.expired > 0 ? `${stats.expired} company subscription(s) have expired. ` : ''}${stats.expiring > 0 ? `${stats.expiring} expiring within 7 days.` : ''}`}
        />
      )}

      {/* Compact stat strip — one short row instead of two tall rows of cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Total',            value: stats.total,        icon: 'fa-building',             grad: 'from-blue-500 to-indigo-600' },
          { label: 'Active',           value: stats.active,       icon: 'fa-check-circle',         grad: 'from-emerald-500 to-teal-600' },
          { label: 'Trial',            value: stats.trial,        icon: 'fa-flask',                grad: 'from-violet-500 to-purple-600' },
          { label: 'Suspended',        value: stats.suspended,    icon: 'fa-ban',                  grad: 'from-slate-500 to-slate-700' },
          { label: 'Expiring (7d)',    value: stats.expiring,     icon: 'fa-exclamation-triangle', grad: 'from-amber-500 to-orange-600' },
          { label: 'Expired',          value: stats.expired,      icon: 'fa-clock',                grad: 'from-rose-500 to-red-600' },
          { label: 'Agents · expired', value: stats.agentExpired, icon: 'fa-user-slash',           grad: 'from-red-500 to-rose-700' },
          { label: 'Agents · expiring',value: stats.agentExpiring,icon: 'fa-hourglass-half',       grad: 'from-orange-500 to-amber-600' },
        ].map(({ label, value, icon, grad }) => (
          <div key={label} className={`bg-gradient-to-br ${grad} rounded-xl px-3 py-2.5 text-white shadow-sm flex items-center gap-2.5`}>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <i className={`fas ${icon} text-xs`} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold leading-none">{value}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80 truncate mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── SEARCH / FILTER / ADD BUTTON ────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-2xl shadow-sm border border-slate-200/70 p-3">
          <div className="flex-1 flex flex-wrap gap-2 w-full">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, username, city…"
              className="flex-1 min-w-[180px] bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Suspended</option>
            </select>
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              value={filterPlan}
              onChange={e => setFilterPlan(e.target.value)}
            >
              <option value="all">All Plans</option>
              {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <button
            onClick={onAddCompany}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors shadow-sm"
          >
            <i className="fas fa-plus mr-1.5" /> Add Company
          </button>
        </div>

      {/* ─── TABLE ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="fa-building"
            title="No companies found"
            message="Try adjusting your filters or create a new company"
            action={<button onClick={onAddCompany} className="btn btn-primary">Add Company</button>}
          />
        ) : (
          <>
            <div className="overflow-auto max-h-[calc(100vh-270px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Company</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Admin Login</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Subscription</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {c.logo ? (
                            <img src={c.logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className="fas fa-building text-blue-400 text-xs" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate max-w-[140px]">{c.name}</div>
                            <div className="text-xs text-slate-400">
                              {c.businessType}{c.city ? ` · ${c.city}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-sm font-semibold text-slate-700">{c.adminUsername}</div>
                        {c.adminName && <div className="text-xs text-slate-400">{c.adminName}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-600">{c.mobile || '—'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[120px]">{c.email || ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_COLORS[c.plan] || 'bg-slate-100 text-slate-700'}`}>
                          {PLAN_LABELS[c.plan] || c.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {dateDisp(c.subscriptionEnd?.split?.('T')?.[0] || c.subscriptionEnd)}
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium mt-1 ${expiryColor(c)}`}>
                          {expiryLabel(c)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {c.isActive ? 'Active' : 'Suspended'}
                        </span>
                        {c.billing?.grandTotal > 0 && (
                          <div className="mt-1">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              c.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              c.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {c.paymentStatus === 'paid' ? 'Fully Paid' :
                               c.paymentStatus === 'partial' ? 'Partially Paid' :
                               'Balance Due'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => onView(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" title="View Details">
                            <i className="fas fa-eye" />
                          </button>
                          <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition" title="Edit">
                            <i className="fas fa-edit" />
                          </button>
                          <button onClick={() => onRenew(c)} className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Renew Subscription">
                            <i className="fas fa-sync-alt" />
                          </button>
                          <button onClick={() => onBilling(c)} className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition" title="Fixed Balance">
                            <i className="fas fa-wallet" />
                          </button>
                          <button onClick={() => onConfig(c)} className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition" title="Configuration — interest, late fee, grace period, due day">
                            <i className="fas fa-sliders" />
                          </button>
                          <button onClick={() => onCreateAgent(c)} className="p-1.5 rounded-lg text-purple-500 hover:text-purple-600 hover:bg-purple-50 transition" title="Add Agent">
                            <i className="fas fa-user-plus" />
                          </button>
                          <button onClick={() => onBackup(c)} className="p-1.5 rounded-lg text-teal-500 hover:text-teal-600 hover:bg-teal-50 transition" title="Download database backup">
                            <i className="fas fa-download" />
                          </button>
                          <button
                            onClick={() => onSuspend(c)}
                            className={`p-1.5 rounded-lg transition ${c.isActive ? 'text-red-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-slate-500 hover:bg-slate-100'}`}
                            title={c.isActive ? 'Suspend' : 'Reactivate'}
                          >
                            <i className={`fas ${c.isActive ? 'fa-ban' : 'fa-check-circle'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-200/60 text-xs text-slate-400 font-medium">
              Showing {filtered.length} of {companies.length} companies
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Transactions — cross-company activity log
══════════════════════════════════════════════════════════════════════════ */
function TransactionsPage({ companies, refreshCompanies }) {
  const [groups,   setGroups]   = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [trans,    setTrans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Filters
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');
  const [fCat,     setFCat]     = useState('');
  const [fSearch,  setFSearch]  = useState('');

  // Entry form
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'tenant_receipt',
    tenantCompanyId: '',
    cashAccountId: '',
    categoryAccountId: '',
    amt: '',
    desc: '',
  });

  // ── Selected tenant's Payment History — same data BillingModal shows,
  //    now surfaced right here next to the form for fast edit/delete
  //    without needing to open a separate modal. ───────────────────────────
  const [tenantHist,        setTenantHist]        = useState([]);
  const [tenantHistLoading, setTenantHistLoading] = useState(false);
  const [editingId,         setEditingId]         = useState(null);
  const [editAmt,           setEditAmt]           = useState('');
  const [editDesc,          setEditDesc]          = useState('');
  const [editDate,          setEditDate]          = useState('');


  const [liveTenant, setLiveTenant] = useState(null);

  const toast = useToast();

  const CATEGORY_META = {
    tenant_receipt: { label: 'Tenant Receipt', icon: 'fa-building',      color: 'text-emerald-600 bg-emerald-50', income: true  },
    other_income:   { label: 'Other Income',   icon: 'fa-coins',         color: 'text-emerald-600 bg-emerald-50', income: true  },
    staff_salary:   { label: 'Staff Salary',    icon: 'fa-users',         color: 'text-red-600 bg-red-50',         income: false },
    other_expense:  { label: 'Other Expense',   icon: 'fa-receipt',       color: 'text-red-600 bg-red-50',         income: false },
  };

  const cashAccounts = accounts.filter(a => ['cash','bank'].includes(a.type) && a.status === 'active');
  const categoryAccountsFor = (cat) => {
    const wantGroup = cat === 'tenant_receipt' ? 'Tenant Income'
                     : cat === 'other_income'   ? 'Other Income'
                     : cat === 'staff_salary'    ? 'Staff Salary'
                     : 'Other Expense';
    return accounts.filter(a => a.group === wantGroup && a.status === 'active');
  };

  const loadMaster = useCallback(async () => {
    try {
      const [gr, ar] = await Promise.all([
        api.get('/platform/groups'),
        api.get('/platform/accounts'),
      ]);
      setGroups(gr.data || []);
      setAccounts(ar.data || []);
    } catch (err) { toast.error(getErrorMsg(err)); }
  }, []);

  const loadTrans = useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams({ limit: '150' });
      if (fFrom) p.append('from', fFrom);
      if (fTo)   p.append('to', fTo);
      if (fCat)  p.append('category', fCat);
      if (fSearch) p.append('search', fSearch);
      const r = await api.get(`/platform/transactions?${p}`);
      setTrans(r.data || []);
    } catch (err) { toast.error(getErrorMsg(err)); setTrans([]); }
    finally { setLoading(false); }
  }, [fFrom, fTo, fCat, fSearch]);

  useEffect(() => { loadMaster(); }, [loadMaster]);
  useEffect(() => { loadTrans(); }, [loadTrans]);

  // ── Load the selected tenant's receipt history whenever the tenant
  //    (or category) changes. Cleared entirely when not on tenant_receipt. ──
  const loadTenantHistory = useCallback(async () => {
    if (form.category !== 'tenant_receipt' || !form.tenantCompanyId) {
      setTenantHist([]);
      return;
    }
    try {
      setTenantHistLoading(true);
      const r = await api.get(`/platform/transactions?tenantCompanyId=${form.tenantCompanyId}&category=tenant_receipt&limit=50`);
      setTenantHist(r.data || []);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setTenantHistLoading(false); }
  }, [form.category, form.tenantCompanyId]);

  useEffect(() => { loadTenantHistory(); }, [loadTenantHistory]);

  // Re-sync the live balance display whenever the selected tenant changes
  // or the parent's companies list refreshes with new data.
  useEffect(() => {
    if (!form.tenantCompanyId) { setLiveTenant(null); return; }
    const t = companies.find(c => c._id === form.tenantCompanyId);
    if (t) setLiveTenant(t);
  }, [form.tenantCompanyId, companies]);

  const startEditHist = (h) => {
    setEditingId(h._id);
    setEditAmt(String(h.amt));
    setEditDesc(h.desc || '');
    setEditDate(h.date);
  };
  const cancelEditHist = () => setEditingId(null);

  const saveEditHist = async () => {
    const amt = parseFloat(editAmt);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    try {
      const r = await api.put(`/platform/transactions/${editingId}`, { date: editDate, amt, desc: editDesc });
      toast.success('Payment updated');
      setEditingId(null);
      if (r.data?.company) setLiveTenant(r.data.company);   // instant, no wait
      loadTenantHistory();
      loadTrans();
      refreshCompanies?.();   // also syncs the global companies list in the background
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const deleteHistEntry = async (h) => {
    if (!window.confirm(`Delete this receipt of ${fmt.format(h.amt)}? Fixed Balance will be reversed.`)) return;
    try {
      const r = await api.delete(`/platform/transactions/${h._id}`);
      toast.success('Deleted and balance reversed');
      if (r.data?.company) setLiveTenant(r.data.company);
      loadTenantHistory();
      loadTrans();
      refreshCompanies?.();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  // Auto-select first available cash account + category account whenever
  // accounts load or the category changes.
  useEffect(() => {
    const catAccs = categoryAccountsFor(form.category);
    setForm(f => ({
      ...f,
      cashAccountId: f.cashAccountId || cashAccounts[0]?._id || '',
      categoryAccountId: catAccs.find(a => a._id === f.categoryAccountId) ? f.categoryAccountId : (catAccs[0]?._id || ''),
    }));
  }, [accounts, form.category]); // eslint-disable-line

  const fld = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amt || parseFloat(form.amt) <= 0) return toast.error('Enter a valid amount');
    if (form.category === 'tenant_receipt' && !form.tenantCompanyId) return toast.error('Select a tenant');
    if (!form.cashAccountId || !form.categoryAccountId) return toast.error('Select accounts');

    setSaving(true);
    try {
      const r = await api.post('/platform/transactions', form);
      toast.success('Transaction recorded');
      setForm(f => ({ ...f, amt: '', desc: '' }));
      if (r.data?.company) setLiveTenant(r.data.company);   // instant Opening/Paid/Remaining update
      loadMaster();
      loadTrans();
      loadTenantHistory();
      if (form.category === 'tenant_receipt') refreshCompanies?.();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction? Balances will be reversed.')) return;
    try {
      const txBeingDeleted = trans.find(t => t._id === id);
      const r = await api.delete(`/platform/transactions/${id}`);
      toast.success('Deleted and balances reversed');
      if (r.data?.company) setLiveTenant(r.data.company);
      loadMaster();
      loadTrans();
      if (txBeingDeleted?.category === 'tenant_receipt') refreshCompanies?.();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

      {/* ── Entry form ─────────────────────────────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4">New Transaction</h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">Date</label>
                <input type="date" className="input" value={form.date} onChange={e=>fld('date',e.target.value)} required/></div>
              <div className="field"><label className="label">Category</label>
                <select className="select" value={form.category} onChange={e=>fld('category',e.target.value)}>
                  {Object.entries(CATEGORY_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
            </div>

            {form.category === 'tenant_receipt' && (
              <div className="field">
                <label className="label">Tenant</label>
                <select className="select" value={form.tenantCompanyId} onChange={e=>fld('tenantCompanyId',e.target.value)} required>
                  <option value="">Select tenant…</option>
                  {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>

                
                {form.tenantCompanyId && (() => {
                  const t = liveTenant || companies.find(c => c._id === form.tenantCompanyId);
                  if (!t) return null;
                  const opening   = t.billing?.grandTotal || 0;
                  const paid      = t.paidAmount || 0;
                  const remaining = t.remainingAmount ?? Math.max(0, opening - paid);
                  return (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Opening</div>
                        <div className="font-bold text-slate-700 text-xs">{fmt.format(opening)}</div>
                      </div>
                      <div className="p-2.5 bg-emerald-50 rounded-lg text-center">
                        <div className="text-[10px] text-emerald-500 font-medium">Paid</div>
                        <div className="font-bold text-emerald-700 text-xs">{fmt.format(paid)}</div>
                      </div>
                      <div className={`p-2.5 rounded-lg text-center ${remaining > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <div className={`text-[10px] font-medium ${remaining > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Remaining</div>
                        <div className={`font-bold text-xs ${remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt.format(remaining)}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Payment History — same data + edit/delete as the Fixed
                       Balance modal, right here so corrections don't need
                       a separate screen. ───────────────────────────────── */}
                {form.tenantCompanyId && (
                  <div></div>
                  
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">{CATEGORY_META[form.category].income ? 'Receive Into' : 'Pay From'}</label>
                <select className="select" value={form.cashAccountId} onChange={e=>fld('cashAccountId',e.target.value)} required>
                  {cashAccounts.length === 0
                    ? <option value="">No cash/bank accounts</option>
                    : cashAccounts.map(a => <option key={a._id} value={a._id}>{a.name} ({fmt.format(a.balance)})</option>)
                  }
                </select></div>
              <div className="field"><label className="label">Ledger Account</label>
                <select className="select" value={form.categoryAccountId} onChange={e=>fld('categoryAccountId',e.target.value)} required>
                  {categoryAccountsFor(form.category).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select></div>
            </div>

            <div className="field"><label className="label">Amount (₹) *</label>
              <input type="number" step="0.01" min="0.01" className="input" value={form.amt} onChange={e=>fld('amt',e.target.value)} placeholder="0.00" required/></div>

            <div className="field"><label className="label">Narration</label>
              <input className="input" value={form.desc} onChange={e=>fld('desc',e.target.value)} placeholder="Optional description"/></div>

            <button type="submit" disabled={saving} className="btn btn-primary w-full">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-check"/>}
              Save Transaction
            </button>
          </form>
        </div>
      </div>

      {/* ── History ────────────────────────────────────────────────────── */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <select className="select w-auto text-sm py-2" value={fCat} onChange={e=>setFCat(e.target.value)}>
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" className="input w-auto text-sm py-2" value={fFrom} onChange={e=>setFFrom(e.target.value)} title="From"/>
            <input type="date" className="input w-auto text-sm py-2" value={fTo}   onChange={e=>setFTo(e.target.value)}   title="To"/>
            <SearchInput value={fSearch} onChange={setFSearch} placeholder="Search narration, tenant, account…" className="flex-1 min-w-[160px]"/>
            {(fFrom||fTo||fCat||fSearch) && (
              <button onClick={()=>{setFFrom('');setFTo('');setFCat('');setFSearch('');}} className="btn btn-secondary btn-sm">
                <i className="fas fa-times"/>
              </button>
            )}
          </div>

          {loading ? <PageLoader/> : trans.length === 0 ? (
            <EmptyState icon="fa-arrows-exchange" title="No transactions yet" message="Record your first platform transaction using the form"/>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {trans.map(t => {
                const meta = CATEGORY_META[t.category] || {};
                return (
                  <div key={t._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <i className={`fas ${meta.icon} text-xs`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">
                        {meta.label}
                        {t.tenantCompanyId?.name && <span className="ml-1.5 text-xs text-blue-500 font-medium">· {t.tenantCompanyId.name}</span>}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {dateDisp(t.date)} &nbsp;·&nbsp; {t.categoryAccountId?.name} → {t.cashAccountId?.name}
                        {t.desc && ` · ${t.desc}`}
                      </div>
                    </div>
                    <span className={`font-bold font-mono text-sm flex-shrink-0 ${meta.income ? 'text-emerald-600' : 'text-red-500'}`}>
                      {meta.income ? '+' : '-'}{fmt.format(t.amt)}
                    </span>
                    <button onClick={()=>handleDelete(t._id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all flex-shrink-0">
                      <i className="fas fa-trash text-xs"/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Account Group — platform chart-of-accounts groups
══════════════════════════════════════════════════════════════════════════ */
function AccountGroupPage() {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ name:'', type:'Asset' });
  const [saving,  setSaving]  = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setLoading(true); const r = await api.get('/platform/groups'); setGroups(r.data || []); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Enter a group name');
    setSaving(true);
    try {
      await api.post('/platform/groups', form);
      toast.success('Group created');
      setForm({ name:'', type:'Asset' });
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (g) => {
    if (!window.confirm(`Delete group "${g.name}"?`)) return;
    try { await api.delete(`/platform/groups/${g._id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  const TYPE_BADGE = { Asset:'badge-blue', Liability:'badge-amber', Income:'badge-green', Expense:'badge-red', Equity:'badge-slate' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4">New Group</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="field"><label className="label">Group Name</label>
              <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Office Rent" required/></div>
            <div className="field"><label className="label">Type</label>
              <select className="select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option>Asset</option><option>Liability</option><option>Income</option><option>Expense</option><option>Equity</option>
              </select></div>
            <button type="submit" disabled={saving} className="btn btn-primary w-full">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-plus"/>}
              Add Group
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Groups ({groups.length})</h3>
          </div>
          {loading ? <PageLoader/> : (
            <div className="table-wrap rounded-none">
              <table className="table">
                <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Actions</th></tr></thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g._id}>
                      <td className="font-semibold text-slate-800 text-sm">{g.name}</td>
                      <td><span className={`badge text-xs ${TYPE_BADGE[g.type]}`}>{g.type}</span></td>
                      <td>{g.isDefault ? <i className="fas fa-check text-emerald-500"/> : <span className="text-slate-300">—</span>}</td>
                      <td>
                        {!g.isDefault && (
                          <button onClick={()=>handleDelete(g)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Account Master — platform ledger accounts
══════════════════════════════════════════════════════════════════════════ */
function AccountMasterPage() {
  const [accounts, setAccounts] = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ name:'', group:'', type:'other' });
  const [saving,   setSaving]   = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ar, gr] = await Promise.all([api.get('/platform/accounts'), api.get('/platform/groups')]);
      setAccounts(ar.data || []);
      setGroups(gr.data || []);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.group) return toast.error('Name and group are required');
    setSaving(true);
    try {
      await api.post('/platform/accounts', form);
      toast.success('Account created');
      setForm({ name:'', group:'', type:'other' });
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (a) => {
    const s = a.status === 'active' ? 'inactive' : 'active';
    try { await api.put(`/platform/accounts/${a._id}`, { ...a, status: s }); toast.success(`Account ${s}`); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try { await api.delete(`/platform/accounts/${a._id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4">New Account</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="field"><label className="label">Account Name</label>
              <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. HDFC Bank" required/></div>
            <div className="field"><label className="label">Group</label>
              <select className="select" value={form.group} onChange={e=>setForm(f=>({...f,group:e.target.value}))} required>
                <option value="">Select group…</option>
                {groups.map(g => <option key={g._id} value={g.name}>{g.name} ({g.type})</option>)}
              </select></div>
            <div className="field"><label className="label">Account Type</label>
              <select className="select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="cash">Cash</option><option value="bank">Bank</option>
                <option value="income">Income</option><option value="expense">Expense</option><option value="other">Other</option>
              </select></div>
            <button type="submit" disabled={saving} className="btn btn-primary w-full">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <i className="fas fa-plus"/>}
              Add Account
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Accounts ({accounts.length})</h3>
          </div>
          {loading ? <PageLoader/> : (
            <div className="table-wrap rounded-none">
              <table className="table">
                <thead><tr><th>Name</th><th>Group</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a._id}>
                      <td className="font-semibold text-slate-800 text-sm">{a.name}</td>
                      <td className="text-sm text-slate-500">{a.group}</td>
                      <td><span className={`font-bold font-mono text-sm ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</span></td>
                      <td><span className={`badge text-xs ${a.status==='active'?'badge-green':'badge-slate'}`}>{a.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={()=>toggleStatus(a)} className="btn btn-secondary btn-sm" title={a.status==='active'?'Deactivate':'Activate'}>
                            <i className={`fas ${a.status==='active'?'fa-ban':'fa-check'}`}/>
                          </button>
                          {!a.isDefault && (
                            <button onClick={()=>handleDelete(a)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ── Print-friendly viewer wrapper (self-contained, Super Admin only) ───── */
function SAReportViewer({ title, subtitle, onBack, children }) {
  const handlePrint = () => {
    const area = document.getElementById('sa-report-print-area');
    if (!area) { window.print(); return; }
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm 12mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; padding: 8px; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .sub { font-size: 11px; color:#64748b; margin-bottom: 14px; }
        table { width:100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
        th { background:#f8fafc; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
        .right { text-align:right; }
        .green { color:#059669; } .red { color:#dc2626; } .bold { font-weight:700; }
        thead { display: table-header-group; }
      </style></head><body>${area.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); printWindow.close(); };
    setTimeout(() => { try { printWindow.focus(); printWindow.print(); } catch{} }, 400);
  };

  // export whatever table is on screen as a CSV file (opens in Excel)
  const handleCsv = () => {
    const area = document.getElementById('sa-report-print-area');
    if (!area) return;
    const cell = el => `"${el.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`;
    const lines = [...area.querySelectorAll('tr')].map(tr => [...tr.children].map(cell).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${String(title).replace(/[^A-Za-z0-9_-]+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn btn-secondary btn-sm"><i className="fas fa-arrow-left"/> Back</button>
        <div className="flex gap-2">
          <button onClick={handleCsv} className="btn btn-secondary btn-sm"><i className="fas fa-file-csv"/> CSV</button>
          <button onClick={handlePrint} className="btn btn-primary btn-sm"><i className="fas fa-print"/> Print</button>
        </div>
      </div>
      <div id="sa-report-print-area" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h1 className="font-bold text-slate-800 text-lg">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

/* ── 1. Tenant List ───────────────────────────────────────────────────────── */
function TenantListReport({ companies }) {
  return (
    <table className="table">
      <thead><tr><th>Company</th><th>Admin Login</th><th>Plan</th><th>City</th><th>Mobile</th><th>Joined</th><th>Status</th></tr></thead>
      <tbody>
        {companies.map(c => (
          <tr key={c._id}>
            <td className="font-semibold text-slate-800 text-sm">{c.name}</td>
            <td className="font-mono text-xs text-slate-600">{c.adminUsername}</td>
            <td><span className={`badge text-xs ${PLAN_COLORS[c.plan]||'badge-slate'}`}>{PLAN_LABELS[c.plan]||c.plan}</span></td>
            <td className="text-sm text-slate-500">{c.city || '—'}</td>
            <td className="text-sm text-slate-500">{c.mobile || '—'}</td>
            <td className="text-xs text-slate-400">{dateDisp(c.createdAt?.split?.('T')?.[0] || c.createdAt)}</td>
            <td><span className={`badge text-xs ${c.isActive?'badge-green':'badge-red'}`}>{c.isActive?'Active':'Suspended'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 2. Platform Ledger ──────────────────────────────────────────────────── */
function PlatformLedgerSelectModal({ onSelect, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [loading,   setLoading] = useState(true);
  useEffect(() => {
    api.get('/platform/accounts').then(r => setAccounts(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  return (
    <div className="modal-body p-0">
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
        {loading ? <div className="p-8 flex justify-center"><span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
          : accounts.map(a => (
            <button key={a._id} onClick={()=>onSelect(a)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between">
              <div><div className="font-semibold text-slate-800 text-sm">{a.name}</div><div className="text-xs text-slate-400">{a.group}</div></div>
              <span className={`font-bold font-mono text-sm ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</span>
            </button>
          ))
        }
      </div>
      <div className="p-4 border-t border-slate-100"><button onClick={onClose} className="btn btn-secondary w-full">Cancel</button></div>
    </div>
  );
}

function PlatformLedgerReport({ account }) {
  const [trans,   setTrans]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/platform/transactions?limit=500`).then(r => {
      const all = r.data || [];
      setTrans(all.filter(t => t.cashAccountId?._id === account._id || t.categoryAccountId?._id === account._id)
                   .sort((a,b)=> new Date(a.date) - new Date(b.date)));
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [account._id]);

  if (loading) return <PageLoader/>;

  let running = 0;
  const rows = trans.map(t => {
    const isDebit = t.cashAccountId?._id === account._id
      ? ['tenant_receipt','other_income'].includes(t.category)   // cash side, income → debit (increase)
      : !['tenant_receipt','other_income'].includes(t.category); // category side, expense → debit
    running += isDebit ? t.amt : -t.amt;
    return { ...t, isDebit, running };
  });

  return (
    <table className="table">
      <thead><tr><th>Date</th><th>Particulars</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
      <tbody>
        {rows.length === 0 ? <tr><td colSpan={5} className="text-center text-slate-400 py-8">No entries for this account</td></tr> : rows.map(r => (
          <tr key={r._id}>
            <td className="text-xs text-slate-500">{dateDisp(r.date)}</td>
            <td className="text-sm text-slate-700">
              {r.cashAccountId?._id === account._id ? r.categoryAccountId?.name : r.cashAccountId?.name}
              {r.tenantCompanyId?.name && <span className="text-blue-500 text-xs"> · {r.tenantCompanyId.name}</span>}
              {r.desc && <span className="text-slate-400 text-xs"> · {r.desc}</span>}
            </td>
            <td className="text-right font-mono text-sm">{r.isDebit ? fmt.format(r.amt) : ''}</td>
            <td className="text-right font-mono text-sm">{!r.isDebit ? fmt.format(r.amt) : ''}</td>
            <td className={`text-right font-mono text-sm font-bold ${r.running<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(r.running)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 3. Payment Pending List ─────────────────────────────────────────────── */
function PaymentPendingReport({ companies }) {
  const pending = companies.filter(c => (c.remainingAmount ?? ((c.billing?.grandTotal||0)-(c.paidAmount||0))) > 0 && (c.billing?.grandTotal||0) > 0);
  const totalDue = pending.reduce((s,c)=> s + (c.remainingAmount ?? ((c.billing?.grandTotal||0)-(c.paidAmount||0))), 0);
  return (
    <>
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center">
        <span className="text-sm font-semibold text-red-700">{pending.length} tenant{pending.length!==1?'s':''} with pending balance</span>
        <span className="font-bold text-red-700">{fmt.format(totalDue)} total due</span>
      </div>
      <table className="table">
        <thead><tr><th>Company</th><th className="text-right">Opening</th><th className="text-right">Paid</th><th className="text-right">Remaining</th><th>Status</th></tr></thead>
        <tbody>
          {pending.length === 0 ? <tr><td colSpan={5} className="text-center text-slate-400 py-8">No pending payments — all tenants are settled 🎉</td></tr> : pending.map(c => {
            const opening = c.billing?.grandTotal||0, paid = c.paidAmount||0, remaining = c.remainingAmount ?? (opening-paid);
            return (
              <tr key={c._id}>
                <td className="font-semibold text-slate-800 text-sm">{c.name}</td>
                <td className="text-right font-mono text-sm">{fmt.format(opening)}</td>
                <td className="text-right font-mono text-sm text-emerald-600">{fmt.format(paid)}</td>
                <td className="text-right font-mono text-sm font-bold text-red-600">{fmt.format(remaining)}</td>
                <td><span className={`badge text-xs ${c.paymentStatus==='partial'?'badge-orange':'badge-red'}`}>{c.paymentStatus==='partial'?'Partial':'Unpaid'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/* ── 4. Month-wise Service Expiry ────────────────────────────────────────── */
function ServiceExpiryReport({ companies, month }) {
  const [y, m] = month.split('-').map(Number);
  const inMonth = companies.filter(c => {
    if (!c.subscriptionEnd) return false;
    const d = new Date(c.subscriptionEnd);
    return d.getFullYear() === y && d.getMonth() === m - 1;
  }).sort((a,b)=> new Date(a.subscriptionEnd) - new Date(b.subscriptionEnd));

  return (
    <table className="table">
      <thead><tr><th>Company</th><th>Plan</th><th>Expiry Date</th><th>Days Remaining</th><th>Status</th></tr></thead>
      <tbody>
        {inMonth.length === 0 ? <tr><td colSpan={5} className="text-center text-slate-400 py-8">No services expiring this month</td></tr> : inMonth.map(c => (
          <tr key={c._id}>
            <td className="font-semibold text-slate-800 text-sm">{c.name}</td>
            <td><span className={`badge text-xs ${PLAN_COLORS[c.plan]||'badge-slate'}`}>{PLAN_LABELS[c.plan]||c.plan}</span></td>
            <td className="text-sm text-slate-600">{dateDisp(c.subscriptionEnd?.split?.('T')?.[0] || c.subscriptionEnd)}</td>
            <td className={`text-sm font-bold ${c.daysRemaining===0?'text-red-600':c.daysRemaining<=7?'text-amber-600':'text-slate-600'}`}>{c.daysRemaining===0?'Expired':`${c.daysRemaining}d`}</td>
            <td><span className={`badge text-xs ${!c.isActive?'badge-slate':c.daysRemaining===0?'badge-red':'badge-orange'}`}>{!c.isActive?'Suspended':c.daysRemaining===0?'Expired':'Expiring'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 5. Receipts & Payments ──────────────────────────────────────────────── */
function ReceiptsPaymentsReport({ from, to }) {
  const [trans,   setTrans]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const p = new URLSearchParams({ limit:'1000' });
    if (from) p.append('from', from);
    if (to)   p.append('to', to);
    api.get(`/platform/transactions?${p}`).then(r => setTrans(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoader/>;

  const byCategory = {};
  trans.forEach(t => { byCategory[t.category] = (byCategory[t.category]||0) + t.amt; });
  const CAT_LABEL = { tenant_receipt:'Tenant Receipts', other_income:'Other Income', staff_salary:'Staff Salary', other_expense:'Other Expense' };
  const receipts = ['tenant_receipt','other_income'].map(k => ({ k, label:CAT_LABEL[k], amt:byCategory[k]||0 }));
  const payments = ['staff_salary','other_expense'].map(k => ({ k, label:CAT_LABEL[k], amt:byCategory[k]||0 }));
  const totalReceipts = receipts.reduce((s,r)=>s+r.amt,0);
  const totalPayments = payments.reduce((s,r)=>s+r.amt,0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">Receipts</div>
        <table className="table">
          <tbody>
            {receipts.map(r => <tr key={r.k}><td className="text-sm text-slate-600">{r.label}</td><td className="text-right font-mono text-sm">{fmt.format(r.amt)}</td></tr>)}
            <tr className="border-t-2 border-emerald-200"><td className="font-bold text-sm">Total Receipts</td><td className="text-right font-bold font-mono text-emerald-600">{fmt.format(totalReceipts)}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Payments</div>
        <table className="table">
          <tbody>
            {payments.map(r => <tr key={r.k}><td className="text-sm text-slate-600">{r.label}</td><td className="text-right font-mono text-sm">{fmt.format(r.amt)}</td></tr>)}
            <tr className="border-t-2 border-red-200"><td className="font-bold text-sm">Total Payments</td><td className="text-right font-bold font-mono text-red-600">{fmt.format(totalPayments)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
        <span className="font-bold text-blue-800 text-sm">Net (Receipts − Payments)</span>
        <span className={`font-bold ${totalReceipts-totalPayments>=0?'text-emerald-700':'text-red-600'}`}>{fmt.format(totalReceipts-totalPayments)}</span>
      </div>
    </div>
  );
}

/* ── 6. Profit & Loss ────────────────────────────────────────────────────── */
function PlatformPLReport({ from, to }) {
  const [trans,   setTrans]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const p = new URLSearchParams({ limit:'1000' });
    if (from) p.append('from', from);
    if (to)   p.append('to', to);
    api.get(`/platform/transactions?${p}`).then(r => setTrans(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoader/>;

  const incomeByAcc = {}, expenseByAcc = {};
  trans.forEach(t => {
    const name = t.categoryAccountId?.name || 'Unknown';
    if (['tenant_receipt','other_income'].includes(t.category)) incomeByAcc[name] = (incomeByAcc[name]||0) + t.amt;
    else expenseByAcc[name] = (expenseByAcc[name]||0) + t.amt;
  });
  const totalIncome  = Object.values(incomeByAcc).reduce((s,v)=>s+v,0);
  const totalExpense = Object.values(expenseByAcc).reduce((s,v)=>s+v,0);
  const net = totalIncome - totalExpense;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">Income</div>
        <table className="table"><tbody>
          {Object.entries(incomeByAcc).map(([n,v]) => <tr key={n}><td className="text-sm text-slate-600">{n}</td><td className="text-right font-mono text-sm">{fmt.format(v)}</td></tr>)}
          <tr className="border-t-2 border-emerald-200"><td className="font-bold text-sm">Total Income</td><td className="text-right font-bold font-mono text-emerald-600">{fmt.format(totalIncome)}</td></tr>
        </tbody></table>
      </div>
      <div>
        <div className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Expense</div>
        <table className="table"><tbody>
          {Object.entries(expenseByAcc).map(([n,v]) => <tr key={n}><td className="text-sm text-slate-600">{n}</td><td className="text-right font-mono text-sm">{fmt.format(v)}</td></tr>)}
          <tr className="border-t-2 border-red-200"><td className="font-bold text-sm">Total Expense</td><td className="text-right font-bold font-mono text-red-600">{fmt.format(totalExpense)}</td></tr>
        </tbody></table>
      </div>
      <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
        <span className="font-bold text-blue-800 text-sm">Net {net>=0?'Profit':'Loss'}</span>
        <span className={`font-bold text-lg ${net>=0?'text-emerald-700':'text-red-600'}`}>{fmt.format(Math.abs(net))}</span>
      </div>
    </div>
  );
}

/* ── 7. Balance Sheet ────────────────────────────────────────────────────── */
function PlatformBSReport() {
  const [accounts, setAccounts] = useState([]);
  const [loading,   setLoading] = useState(true);
  useEffect(() => {
    api.get('/platform/accounts').then(r => setAccounts(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <PageLoader/>;

  const assets   = accounts.filter(a => ['cash','bank'].includes(a.type));
  const income   = accounts.filter(a => a.type === 'income');
  const expense  = accounts.filter(a => a.type === 'expense');
  const totalAssets   = assets.reduce((s,a)=>s+a.balance,0);
  const totalIncome   = income.reduce((s,a)=>s+a.balance,0);
  const totalExpense  = expense.reduce((s,a)=>s+a.balance,0);
  const retainedEarnings = totalIncome - totalExpense;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Assets</div>
        <table className="table"><tbody>
          {assets.map(a => <tr key={a._id}><td className="text-sm text-slate-600">{a.name}</td><td className="text-right font-mono text-sm">{fmt.format(a.balance)}</td></tr>)}
          <tr className="border-t-2 border-blue-200"><td className="font-bold text-sm">Total Assets</td><td className="text-right font-bold font-mono text-blue-700">{fmt.format(totalAssets)}</td></tr>
        </tbody></table>
      </div>
      <div>
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Liabilities &amp; Equity</div>
        <table className="table"><tbody>
          <tr><td className="text-sm text-slate-600">Liabilities</td><td className="text-right font-mono text-sm">{fmt.format(0)}</td></tr>
          <tr><td className="text-sm text-slate-600">Retained Earnings (Net Profit)</td><td className="text-right font-mono text-sm">{fmt.format(retainedEarnings)}</td></tr>
          <tr className="border-t-2 border-slate-300"><td className="font-bold text-sm">Total Liabilities + Equity</td><td className="text-right font-bold font-mono text-slate-800">{fmt.format(retainedEarnings)}</td></tr>
        </tbody></table>
        <p className="text-xs text-slate-400 mt-2">
          {Math.abs(totalAssets - retainedEarnings) < 1
            ? <span className="text-emerald-600"><i className="fas fa-check-circle"/> Balanced — Assets = Liabilities + Equity</span>
            : 'Note: figures should match if no adjustments are outstanding.'}
        </p>
      </div>
    </div>
  );
}

/* ── Detailed report cards (Super Admin only) ────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════════
   NEW platform reports — all use  GET /companies/activity/usage  (one row per company)
══════════════════════════════════════════════════════════════════════════ */
function useUsage() {
  const [rows, setRows] = useState(null);
  const toast = useToast();
  useEffect(() => {
    api.get('/companies/activity/usage').then(r => setRows(r.data)).catch(err => { toast.error(getErrorMsg(err)); setRows([]); });
    // eslint-disable-next-line
  }, []);
  return rows;
}
const daysSince = d => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);
const dOnly = d => (d ? dateDisp(String(d).split('T')[0]) : '—');
const TotalRow = ({ cols, children }) => <tr className="bg-slate-50 font-bold text-slate-800 text-sm">{children}</tr>;

/* 1. Tenant Usage — how much each company really uses the software */
function TenantUsageReport() {
  const rows = useUsage();
  if (!rows) return <PageLoader />;
  if (!rows.length) return <EmptyState icon="fa-building" title="No companies yet" message="" />;
  const sorted = [...rows].sort((a, b) => b.transactions - a.transactions);
  const sum = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>Company</th><th>Plan</th><th className="text-right">Customers</th><th className="text-right">Agents</th><th className="text-right">Loan A/cs</th>
          <th className="text-right">Deposit A/cs</th><th className="text-right">Transactions</th><th className="text-right">Volume</th><th>Last Activity</th><th className="text-right">DB Size</th></tr></thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r._id}>
              <td className="font-semibold text-slate-800 text-sm">{r.name}{!r.isActive && <span className="badge badge-red text-[10px] ml-1.5">Suspended</span>}</td>
              <td><span className={`badge text-xs ${PLAN_COLORS[r.plan] || 'badge-slate'}`}>{PLAN_LABELS[r.plan] || r.plan}</span></td>
              <td className="text-right font-mono text-sm">{r.customers}</td>
              <td className="text-right font-mono text-sm">{r.agents}</td>
              <td className="text-right font-mono text-sm">{r.loanAccounts}</td>
              <td className="text-right font-mono text-sm">{r.depositAccounts}</td>
              <td className="text-right font-mono text-sm">{r.transactions.toLocaleString('en-IN')}</td>
              <td className="text-right font-mono text-sm">{fmt.format(r.txVolume)}</td>
              <td className="text-xs text-slate-500">{r.lastTxDate ? dOnly(r.lastTxDate) : <span className="text-red-500">Never</span>}</td>
              <td className="text-right text-xs text-slate-500">{r.dbSizeKB >= 1024 ? `${(r.dbSizeKB / 1024).toFixed(1)} MB` : `${r.dbSizeKB} KB`}</td>
            </tr>
          ))}
          <TotalRow>
            <td colSpan={2}>Total ({rows.length})</td>
            <td className="text-right font-mono">{sum('customers')}</td><td className="text-right font-mono">{sum('agents')}</td>
            <td className="text-right font-mono">{sum('loanAccounts')}</td><td className="text-right font-mono">{sum('depositAccounts')}</td>
            <td className="text-right font-mono">{sum('transactions').toLocaleString('en-IN')}</td><td className="text-right font-mono">{fmt.format(sum('txVolume'))}</td>
            <td></td><td className="text-right text-xs">{Math.round(sum('dbSizeKB') / 1024 * 10) / 10} MB</td>
          </TotalRow>
        </tbody>
      </table>
    </div>
  );
}

/* 2. Inactive Tenants — companies that stopped using the software (churn risk) */
function InactiveTenantsReport() {
  const rows = useUsage();
  const [limit, setLimit] = useState(30);
  if (!rows) return <PageLoader />;
  const idle = rows
    .filter(r => r.isActive)
    .map(r => ({ ...r, idle: r.lastTxDate ? daysSince(r.lastTxDate) : null }))
    .filter(r => r.idle === null || r.idle >= limit)
    .sort((a, b) => (b.idle === null ? 99999 : b.idle) - (a.idle === null ? 99999 : a.idle));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm print:hidden">
        <span className="text-xs font-bold text-slate-400 uppercase">No transaction for</span>
        <select className="select w-auto text-sm py-1.5" value={limit} onChange={e => setLimit(Number(e.target.value))}>
          {[7, 15, 30, 60, 90].map(n => <option key={n} value={n}>{n}+ days</option>)}
        </select>
        <span className="text-xs text-slate-400">{idle.length} of {rows.filter(r => r.isActive).length} active companies</span>
      </div>
      {idle.length === 0 ? <EmptyState icon="fa-circle-check" title="All companies are active" message={`Every company recorded a transaction in the last ${limit} days`} /> : (
        <table className="table">
          <thead><tr><th>Company</th><th>Plan</th><th>Mobile / Email</th><th>Joined</th><th>Last Transaction</th><th className="text-right">Days Idle</th><th className="text-right">Customers</th><th>Subscription</th></tr></thead>
          <tbody>
            {idle.map(r => (
              <tr key={r._id}>
                <td className="font-semibold text-slate-800 text-sm">{r.name}</td>
                <td><span className={`badge text-xs ${PLAN_COLORS[r.plan] || 'badge-slate'}`}>{PLAN_LABELS[r.plan] || r.plan}</span></td>
                <td className="text-xs text-slate-500">{r.email || '—'}</td>
                <td className="text-xs text-slate-500">{dOnly(r.createdAt)}</td>
                <td className="text-xs">{r.lastTxDate ? dOnly(r.lastTxDate) : <span className="text-red-500 font-semibold">Never used</span>}</td>
                <td className="text-right font-mono text-sm font-bold text-red-600">{r.idle === null ? '—' : r.idle}</td>
                <td className="text-right font-mono text-sm">{r.customers}</td>
                <td><span className={`badge text-xs ${r.daysRemaining === 0 ? 'badge-red' : r.daysRemaining <= 7 ? 'badge-orange' : 'badge-green'}`}>{r.daysRemaining === 0 ? 'Expired' : `${r.daysRemaining}d left`}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* 3. Trial Tracker — follow up trial companies before the trial ends */
function TrialTrackerReport() {
  const rows = useUsage();
  if (!rows) return <PageLoader />;
  const trials = rows.filter(r => r.plan === 'trial').sort((a, b) => a.daysRemaining - b.daysRemaining);
  const ending = trials.filter(r => r.daysRemaining > 0 && r.daysRemaining <= 5).length;
  const unused = trials.filter(r => r.transactions === 0).length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-white">
        {[['Trial companies', trials.length, 'from-violet-500 to-purple-600'], ['Ending in 5 days', ending, 'from-amber-500 to-orange-600'],
          ['Expired', trials.filter(r => r.daysRemaining === 0).length, 'from-rose-500 to-red-600'], ['Never used', unused, 'from-slate-500 to-slate-700']]
          .map(([l, v, g]) => <div key={l} className={`bg-gradient-to-br ${g} rounded-xl px-3 py-2`}><div className="text-lg font-bold leading-none">{v}</div><div className="text-[10px] uppercase tracking-wide text-white/80 mt-1">{l}</div></div>)}
      </div>
      {trials.length === 0 ? <EmptyState icon="fa-flask" title="No trial companies" message="" /> : (
        <table className="table">
          <thead><tr><th>Company</th><th>Email</th><th>Source</th><th>Joined</th><th>Trial Ends</th><th className="text-right">Days Left</th><th className="text-right">Customers</th><th className="text-right">Transactions</th><th>Usage</th></tr></thead>
          <tbody>
            {trials.map(r => (
              <tr key={r._id}>
                <td className="font-semibold text-slate-800 text-sm">{r.name}</td>
                <td className="text-xs text-slate-500">{r.email || '—'} {r.email && (r.emailVerified ? <i className="fas fa-circle-check text-emerald-500 ml-1" title="Verified" /> : <i className="fas fa-circle-question text-amber-500 ml-1" title="Not verified" />)}</td>
                <td className="text-xs">{r.selfRegistered ? <span className="badge badge-blue text-[10px]">Self-registered</span> : <span className="badge badge-slate text-[10px]">Added by admin</span>}</td>
                <td className="text-xs text-slate-500">{dOnly(r.createdAt)}</td>
                <td className="text-xs text-slate-500">{dOnly(r.subscriptionEnd)}</td>
                <td className="text-right"><span className={`badge text-xs ${r.daysRemaining === 0 ? 'badge-red' : r.daysRemaining <= 5 ? 'badge-orange' : 'badge-green'}`}>{r.daysRemaining === 0 ? 'Expired' : `${r.daysRemaining}d`}</span></td>
                <td className="text-right font-mono text-sm">{r.customers}</td>
                <td className="text-right font-mono text-sm">{r.transactions}</td>
                <td>{r.transactions === 0 ? <span className="badge badge-red text-[10px]">Not started</span> : r.transactions < 20 ? <span className="badge badge-amber text-[10px]">Exploring</span> : <span className="badge badge-green text-[10px]">Using actively</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* 4. Portfolio Summary — loans and deposits managed across all companies */
function PortfolioReport() {
  const rows = useUsage();
  if (!rows) return <PageLoader />;
  const sum = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const ratio = (l, d) => (d > 0 ? `${((l / d) * 100).toFixed(1)}%` : '—');
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>Company</th><th className="text-right">Loan A/cs</th><th className="text-right">Loans Outstanding</th><th className="text-right">Deposit A/cs</th><th className="text-right">Deposit Balance</th><th className="text-right">Loan / Deposit</th></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => b.loanOutstanding - a.loanOutstanding).map(r => (
            <tr key={r._id}>
              <td className="font-semibold text-slate-800 text-sm">{r.name}</td>
              <td className="text-right font-mono text-sm">{r.loanAccounts}</td>
              <td className="text-right font-mono text-sm text-red-600">{fmt.format(r.loanOutstanding)}</td>
              <td className="text-right font-mono text-sm">{r.depositAccounts}</td>
              <td className="text-right font-mono text-sm text-emerald-600">{fmt.format(r.depositBalance)}</td>
              <td className="text-right font-mono text-sm">{ratio(r.loanOutstanding, r.depositBalance)}</td>
            </tr>
          ))}
          <TotalRow>
            <td>Total ({rows.length} companies)</td>
            <td className="text-right font-mono">{sum('loanAccounts')}</td><td className="text-right font-mono text-red-600">{fmt.format(sum('loanOutstanding'))}</td>
            <td className="text-right font-mono">{sum('depositAccounts')}</td><td className="text-right font-mono text-emerald-600">{fmt.format(sum('depositBalance'))}</td>
            <td className="text-right font-mono">{ratio(sum('loanOutstanding'), sum('depositBalance'))}</td>
          </TotalRow>
        </tbody>
      </table>
    </div>
  );
}

/* 5. Billing Summary — billed vs received vs balance, per company */
function BillingSummaryReport() {
  const rows = useUsage();
  if (!rows) return <PageLoader />;
  const billed = rows.filter(r => r.grandTotal > 0);
  const sum = k => billed.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  if (!billed.length) return <EmptyState icon="fa-wallet" title="No billing set up" message="Add prices in a company's Fixed Balance to see it here" />;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>Company</th><th>Plan</th><th className="text-right">Billed</th><th className="text-right">Received</th><th className="text-right">Balance</th><th>Status</th><th>Subscription Ends</th></tr></thead>
        <tbody>
          {[...billed].sort((a, b) => (b.grandTotal - b.paidAmount) - (a.grandTotal - a.paidAmount)).map(r => {
            const bal = Math.max(0, r.grandTotal - r.paidAmount);
            return (
              <tr key={r._id}>
                <td className="font-semibold text-slate-800 text-sm">{r.name}</td>
                <td><span className={`badge text-xs ${PLAN_COLORS[r.plan] || 'badge-slate'}`}>{PLAN_LABELS[r.plan] || r.plan}</span></td>
                <td className="text-right font-mono text-sm">{fmt.format(r.grandTotal)}</td>
                <td className="text-right font-mono text-sm text-emerald-600">{fmt.format(r.paidAmount)}</td>
                <td className={`text-right font-mono text-sm font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt.format(bal)}</td>
                <td><span className={`badge text-xs ${r.paymentStatus === 'paid' ? 'badge-green' : r.paymentStatus === 'partial' ? 'badge-amber' : 'badge-red'}`}>{r.paymentStatus === 'paid' ? 'Paid' : r.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}</span></td>
                <td className="text-xs text-slate-500">{dOnly(r.subscriptionEnd)}</td>
              </tr>
            );
          })}
          <TotalRow>
            <td colSpan={2}>Total ({billed.length})</td>
            <td className="text-right font-mono">{fmt.format(sum('grandTotal'))}</td>
            <td className="text-right font-mono text-emerald-600">{fmt.format(sum('paidAmount'))}</td>
            <td className="text-right font-mono text-red-600">{fmt.format(Math.max(0, sum('grandTotal') - sum('paidAmount')))}</td>
            <td colSpan={2}></td>
          </TotalRow>
        </tbody>
      </table>
    </div>
  );
}

const SA_REPORT_CARDS = [
  { id:'tenant_list', label:'Tenant List',              icon:'fa-building',         color:'text-blue-600 bg-blue-50' },
  { id:'ledger',       label:'Ledger',                   icon:'fa-file-invoice',     color:'text-amber-600 bg-amber-50' },
  { id:'pending',      label:'Payment Pending List',     icon:'fa-triangle-exclamation', color:'text-red-600 bg-red-50' },
  { id:'expiry',       label:'Month-wise Service Expiry',icon:'fa-calendar-xmark',   color:'text-orange-600 bg-orange-50' },
  { id:'receipts_pay', label:'Receipts & Payments',      icon:'fa-arrows-exchange',  color:'text-cyan-600 bg-cyan-50' },
  { id:'pl',           label:'Profit & Loss',            icon:'fa-chart-line',       color:'text-emerald-700 bg-emerald-50' },
  { id:'bs',           label:'Balance Sheet',            icon:'fa-balance-scale',    color:'text-slate-700 bg-slate-100' },
  { id:'usage',        label:'Tenant Usage',             icon:'fa-gauge-high',       color:'text-indigo-600 bg-indigo-50' },
  { id:'inactive',     label:'Inactive Tenants',         icon:'fa-user-clock',       color:'text-rose-600 bg-rose-50' },
  { id:'trial',        label:'Trial Tracker',            icon:'fa-flask',            color:'text-violet-600 bg-violet-50' },
  { id:'portfolio',    label:'Loan & Deposit Portfolio', icon:'fa-piggy-bank',       color:'text-teal-600 bg-teal-50' },
  { id:'billing',      label:'Billing Summary',          icon:'fa-wallet',           color:'text-blue-600 bg-blue-50' },
];

/* ── Main ReportsPage — overview + detailed report picker ───────────────── */
function ReportsPage({ companies }) {
  const [active,      setActive]      = useState(null);
  const [from,        setFrom]        = useState('');
  const [to,          setTo]          = useState('');
  const [month,       setMonth]       = useState(new Date().toISOString().slice(0,7));
  const [showLedgerPick, setShowLedgerPick] = useState(false);
  const [ledgerAcc,   setLedgerAcc]   = useState(null);

  const open = id => {
    if (id === 'ledger') { setShowLedgerPick(true); return; }
    setActive(id);
  };

  if (active) {
    const card = SA_REPORT_CARDS.find(r => r.id === active);
    return (
      <SAReportViewer
        title={card?.label + (ledgerAcc && active==='ledger' ? `: ${ledgerAcc.name}` : '')}
        subtitle={
          active === 'expiry' ? `Month: ${month}` :
          (active==='receipts_pay' || active==='pl') ? (from||to ? `${from?dateDisp(from):'Start'} → ${to?dateDisp(to):'Today'}` : 'All time') :
          `As on ${dateDisp(new Date().toISOString().split('T')[0])}`
        }
        onBack={() => { setActive(null); setLedgerAcc(null); }}
      >
        {active === 'tenant_list'  && <TenantListReport companies={companies}/>}
        {active === 'ledger'        && ledgerAcc && <PlatformLedgerReport account={ledgerAcc}/>}
        {active === 'pending'       && <PaymentPendingReport companies={companies}/>}
        {active === 'expiry'        && <ServiceExpiryReport companies={companies} month={month}/>}
        {active === 'receipts_pay'  && <ReceiptsPaymentsReport from={from} to={to}/>}
        {active === 'pl'            && <PlatformPLReport from={from} to={to}/>}
        {active === 'bs'            && <PlatformBSReport/>}
        {active === 'usage'         && <TenantUsageReport/>}
        {active === 'inactive'      && <InactiveTenantsReport/>}
        {active === 'trial'         && <TrialTrackerReport/>}
        {active === 'portfolio'     && <PortfolioReport/>}
        {active === 'billing'       && <BillingSummaryReport/>}
      </SAReportViewer>
    );
  }

  return (
    <div className="space-y-6">
      {/* <ReportsOverview/> */}

      <div>
        <h2 className="font-bold text-slate-800 text-lg mb-1">Detailed Reports</h2>
        <p className="text-xs text-slate-400 mb-4">Tenant billing, ledger and platform financial statements</p>

        {/* Filters relevant to the next report opened */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white rounded-2xl border border-slate-100 p-3">
          <span className="text-xs font-bold text-slate-400 uppercase">Month (for Service Expiry)</span>
          <input type="month" className="input w-auto text-sm py-1.5" value={month} onChange={e=>setMonth(e.target.value)}/>
          <span className="text-xs font-bold text-slate-400 uppercase ml-3">Range (for Receipts/Payments &amp; P&amp;L)</span>
          <input type="date" className="input w-auto text-sm py-1.5" value={from} onChange={e=>setFrom(e.target.value)} title="From"/>
          <input type="date" className="input w-auto text-sm py-1.5" value={to} onChange={e=>setTo(e.target.value)} title="To"/>
          {(from||to) && <button onClick={()=>{setFrom('');setTo('');}} className="btn btn-secondary btn-sm"><i className="fas fa-times"/></button>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SA_REPORT_CARDS.map(card => (
            <button key={card.id} onClick={()=>open(card.id)}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color} group-hover:scale-110 transition-transform`}>
                <i className={`fas ${card.icon} text-sm`}/>
              </div>
              <div className="font-semibold text-slate-700 text-sm leading-tight">{card.label}</div>
            </button>
          ))}
        </div>
      </div>

      <Modal isOpen={showLedgerPick} onClose={()=>setShowLedgerPick(false)} title="Select Account for Ledger">
        <PlatformLedgerSelectModal onSelect={acc=>{ setLedgerAcc(acc); setShowLedgerPick(false); setActive('ledger'); }} onClose={()=>setShowLedgerPick(false)}/>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Settings — platform configuration & reference info
══════════════════════════════════════════════════════════════════════════ */
function SettingsPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      {/* Security note */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <i className="fas fa-shield-halved text-amber-600 text-sm"/>
          </div>
          <h3 className="font-bold text-slate-800">Super Admin Security</h3>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Super Admin credentials are configured via environment variables
          (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">SUPER_ADMIN_USERNAME</code> /
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono ml-1">SUPER_ADMIN_PASSWORD</code>)
          rather than stored in the database. To change them, update the server's <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">.env</code> file and restart the backend.
        </p>
      </div>

      {/* Plan limits reference */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Default Plan Limits</h3>
          <p className="text-xs text-slate-400 mt-0.5">Applied automatically when a company is created or renewed</p>
        </div>
        <div className="table-wrap rounded-none">
          <table className="table">
            <thead><tr><th>Plan</th><th>Duration</th><th>Max Agents</th><th>Max Customers</th></tr></thead>
            <tbody>
              {PLANS.map(p => (
                <tr key={p.value}>
                  <td><span className={`badge text-xs ${PLAN_COLORS[p.value]||'badge-slate'}`}>{p.label}</span></td>
                  <td className="text-sm text-slate-600">{p.days} days</td>
                  <td className="text-sm text-slate-600">{p.agents}</td>
                  <td className="text-sm text-slate-600">{p.customers===99999?'Unlimited':p.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-bold text-slate-800 mb-3">Platform Info</h3>
        <div className="space-y-2 text-sm">
          {[
            ['Application', 'FinSphere'],
            ['Architecture', 'Multi-tenant SaaS'],
            ['Default Business Types', BTYPE.join(', ')],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-800 text-right max-w-[60%]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sidebar
══════════════════════════════════════════════════════════════════════════ */
function SuperAdminSidebar({ active, onNavigate, mobileOpen, onClose }) {
  return (
    <>
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111827] flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <i className="fas fa-chart-line text-white text-sm"/>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white leading-tight truncate">FinSphere</div>
            <div className="text-[11px] text-slate-400 font-medium">Super Admin Console</div>
          </div>
          <button onClick={onClose} className="lg:hidden ml-auto w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white">
            <i className="fas fa-times text-sm"/>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active === item.id ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`}/>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <span className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full font-semibold w-fit">
            <i className="fas fa-crown text-xs"/>Super Admin
          </span>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={onClose}/>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main SuperAdmin Page
══════════════════════════════════════════════════════════════════════════ */
export default function SuperAdminPage() {
  const [companies,     setCompanies]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [active,        setActive]        = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [renewing,      setRenewing]      = useState(null);
  const [viewing,       setViewing]       = useState(null);
  const [suspending,    setSuspending]    = useState(null);
  const [creatingAgent, setCreatingAgent] = useState(null);
  const [billing,       setBilling]       = useState(null);
  const [configuring,   setConfiguring]   = useState(null);

  const toast = useToast();
  const { logout } = useAuth();

  const fetchAll = useCallback(async () => {
    try { setLoading(true); const r = await api.get('/companies'); setCompanies(r.data); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onSave = () => {
    setShowForm(false); setEditing(null); setRenewing(null);
    setViewing(null); setSuspending(null); setCreatingAgent(null); setBilling(null);
    fetchAll();
  };

  // download a consistent copy of one company's SQLite database
  const downloadBackup = async c => {
    try {
      const r = await api.get(`/companies/${c._id}/backup`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${c.name.replace(/[^A-Za-z0-9_-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup of ${c.name} downloaded`);
    } catch (err) { toast.error('Backup failed — please try again'); }
  };

  const PAGE_TITLES = {
    dashboard:    { title:'Companies',      subtitle:'Manage all tenant companies on the platform' },
    transactions: { title:'Transactions',   subtitle:"Platform's own income & expense ledger — tenant receipts, salary, expenses" },
    reports:      { title:'Reports',        subtitle:'Platform-wide analytics and insights' },
    acc_group:    { title:'Account Group',  subtitle:'Chart-of-accounts groups for the platform ledger' },
    acc_master:   { title:'Account Master', subtitle:'Cash, bank, income and expense ledger accounts' },
    settings:     { title:'Settings',       subtitle:'Platform configuration and reference info' },
  };
  const pageMeta = PAGE_TITLES[active] || PAGE_TITLES.dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <SuperAdminSidebar active={active} onNavigate={setActive} mobileOpen={mobileNavOpen} onClose={()=>setMobileNavOpen(false)}/>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={()=>setMobileNavOpen(true)} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0">
                <i className="fas fa-bars text-sm"/>
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-slate-800 text-lg leading-tight truncate">{pageMeta.title}</h1>
                <p className="text-xs text-slate-400 truncate">{pageMeta.subtitle}</p>
              </div>
            </div>
            <button onClick={() => { if (window.confirm('Logout from Super Admin?')) logout(); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all text-sm flex-shrink-0">
              <i className="fas fa-sign-out-alt"/><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4">
            {active === 'dashboard' && (
              <CompaniesDashboard
                companies={companies}
                loading={loading}
                fetchAll={fetchAll}
                onEdit={c => { setEditing(c); setShowForm(true); }}
                onRenew={setRenewing}
                onView={setViewing}
                onSuspend={setSuspending}
                onCreateAgent={setCreatingAgent}
                onBilling={setBilling}
                onConfig={setConfiguring}
                onBackup={downloadBackup}
                onAddCompany={() => { setEditing(null); setShowForm(true); }}
              />
            )}
            {active === 'transactions' && <TransactionsPage companies={companies} refreshCompanies={fetchAll}/>}
            {active === 'reports'      && <ReportsPage companies={companies}/>}
            {active === 'acc_group'    && <AccountGroupPage/>}
            {active === 'acc_master'   && <AccountMasterPage/>}
            {active === 'settings'     && <SettingsPage/>}
          </div>
        </main>
      </div>

      {/* Modals */}
      <Modal isOpen={showForm} onClose={()=>{setShowForm(false);setEditing(null);}} title={editing?`Edit: ${editing.name}`:'Create New Company'} size="lg">
        <CompanyForm company={editing} onSave={onSave} onClose={()=>{setShowForm(false);setEditing(null);}} />
      </Modal>

      <Modal isOpen={!!renewing} onClose={()=>setRenewing(null)} title={`Renew: ${renewing?.name}`}>
        {renewing && <RenewModal company={renewing} onSave={onSave} onClose={()=>setRenewing(null)} />}
      </Modal>

      <Modal isOpen={!!viewing} onClose={()=>setViewing(null)} title={`Details: ${viewing?.name}`}>
        {viewing && <StatsModal company={viewing} onClose={()=>setViewing(null)} />}
      </Modal>

      <Modal isOpen={!!suspending} onClose={()=>setSuspending(null)} title={suspending?.isActive?`Suspend: ${suspending?.name}`:`Reactivate: ${suspending?.name}`}>
        {suspending && <SuspendModal company={suspending} onSave={onSave} onClose={()=>setSuspending(null)} />}
      </Modal>

      <Modal isOpen={!!creatingAgent} onClose={()=>setCreatingAgent(null)} title={`Add Agent for ${creatingAgent?.name}`}>
        {creatingAgent && <CreateAgentModal company={creatingAgent} onSave={onSave} onClose={()=>setCreatingAgent(null)} />}
      </Modal>

      <Modal isOpen={!!configuring} onClose={()=>setConfiguring(null)} title={`Configuration: ${configuring?.name}`} size="lg">
        {configuring && (
          <div>
            <p className="text-xs text-slate-400 mb-3">Default interest, late fee, grace period and due day this company's loans, deposits and pigmy accounts start with.</p>
            <ConfigEditor endpoint={`/companies/${configuring._id}/config`} canEdit />
          </div>
        )}
      </Modal>

      <Modal isOpen={!!billing} onClose={()=>setBilling(null)} title={`Fixed Balance: ${billing?.name}`}>
        {billing && <BillingModal company={billing} onSave={onSave} onClose={()=>setBilling(null)} />}
      </Modal>
    </div>
  );
}
