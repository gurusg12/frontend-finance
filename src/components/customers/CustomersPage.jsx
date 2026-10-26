import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil } from 'lucide-react';
import api, { fmt, dateDisp, dateNow, getErrorMsg, agentLabel } from '../../utils/api';
import ImportCustomers from './ImportCustomers';
import AccountTermsFields, { pruneTerms } from './AccountTermsFields';
import { accountCategory, termsFor } from '../../utils/finance';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageLoader, EmptyState, PageHeader, ConfirmDialog, SearchInput, StatusBadge } from '../shared';

/* ── Open Account Form ─────────────────────────────────────────────────────── */
function OpenAccountForm({ customerId, agents = [], onSave, onClose }) {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({
    typeName: '',
    opDate: dateNow() || new Date().toISOString().split('T')[0],
    agentId: '',

    // Loan Fields
    roi: '',
    period: '',
    periodType: 'months',
    maturityDate: '',
    emiMethod: 'reducing',
    guarantor: '',
    depositType: '',

    // Pigmy Fields
    collectorName: '',
    dailyAmount: ''
  });

  const [isLoan, setIsLoan] = useState(false);
  const [isDeposit, setIsDeposit] = useState(false);
  const [isPigmy, setIsPigmy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);      // company Configuration (default interest, late fee, grace …)
  const [groupMap, setGroupMap] = useState({});    // group name -> Asset / Liability …
  const [terms, setTerms] = useState({});          // this account's own terms (starts as the company defaults)
  const prefilled = useRef('');
  const toast = useToast();

  // Fetch account types, company configuration and groups on mount
  useEffect(() => {
    api.get('/account-types')
      .then(r => setTypes(r.data))
      .catch(() => { });
    api.get('/config').then(r => setConfig(r.data)).catch(() => { });
    api.get('/groups').then(r => {
      const m = {}; r.data.forEach(g => { m[g.name] = g.type; }); setGroupMap(m);
    }).catch(() => { });
  }, []);

  // loan | deposit | pigmy | other  (decided by the account type's group)
  const typeObj = types.find(x => x.name === form.typeName);
  const category = form.typeName
    ? accountCategory({ category: 'customer', type: form.typeName, group: typeObj?.group }, groupMap)
    : 'other';

  // Set type layout and sanitize conflicting state values
  useEffect(() => {
    if (!form.typeName) {
      setIsLoan(false);
      setIsDeposit(false);
      setIsPigmy(false);
      return;
    }

    const t = types.find(x => x.name === form.typeName);
    const type = form.typeName.toLowerCase();
    const group = (t?.group || '').toLowerCase();

    const loanForm = group.includes('loan') || type.includes('loan');
    const pigmyForm = type.includes('pigmy') || type.includes('pigmy account');
    
    // Improved check to catch Fixed Deposits, Recurring Deposits, Savings, etc. regardless of spacing/casing
    const depositForm = group.includes('deposit') || group.includes('savings') || group.includes('current') ||
                        type.includes('fd') || type.includes('rd') || type.includes('deposit') || 
                        type.includes('fixed') || type.includes('recurring') || type.includes('savings') || type.includes('current');

    setIsLoan(loanForm);
    setIsDeposit(depositForm);
    setIsPigmy(pigmyForm);

    // Clean up alternative variant fields if type changes mid-fill
    setForm(p => ({
      ...p,
      ...(!loanForm && { guarantor: '' }),
      ...(!(depositForm || pigmyForm) && { roi: '', period: '', periodType: 'months', maturityDate: '', depositType: '', collectorName: '', dailyAmount: '' }),
      ...(!pigmyForm && { collectorName: '', dailyAmount: '' })
    }));
  }, [form.typeName, types]);

  // When a type is chosen, start from the company's default interest, period and terms
  useEffect(() => {
    if (!config || !form.typeName || category === 'other') return;
    const key = `${form.typeName}|${category}`;
    if (prefilled.current === key) return;
    prefilled.current = key;
    const c = config[category] || {};
    setForm(p => ({
      ...p,
      roi: c.interestRate ?? p.roi,
      period: c.tenure ?? p.period,
      periodType: c.tenureType || p.periodType,
      ...(category === 'loan' && c.interestMethod ? { emiMethod: c.interestMethod } : {}),
    }));
    setTerms(termsFor({ terms: {} }, config, category));
  }, [config, form.typeName, category]);

  // Handle dynamic maturity date computations
  useEffect(() => {
    if (!form.opDate || !form.period) {
      setForm(f => ({ ...f, maturityDate: '' }));
      return;
    }

    const d = new Date(form.opDate);
    const n = parseInt(form.period, 10);
    if (isNaN(n)) return;

    if (form.periodType === 'days') d.setDate(d.getDate() + n);
    else if (form.periodType === 'months') d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);

    setForm(f => ({ ...f, maturityDate: d.toISOString().split('T')[0] }));
  }, [form.opDate, form.period, form.periodType]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    if (!form.typeName) return toast.error('Select account type');
    if (isPigmy && !form.collectorName) return toast.error('Collector name required');
    if (isPigmy && !form.dailyAmount) return toast.error('Daily amount required');
    if (isDeposit && !isPigmy && !form.roi) return toast.error('Interest rate required for deposit');
    if (isDeposit && !isPigmy && !form.period) return toast.error('Duration required for deposit');

    setSaving(true);
    try {
      const payload = { custId: customerId, typeName: form.typeName, opDate: form.opDate };

      if (isLoan && !isDeposit) {
        Object.assign(payload, {
          roi: form.roi,
          period: form.period,
          periodType: form.periodType,
          maturityDate: form.maturityDate,
          guarantor: form.guarantor,
          // Tenant/admin-only field — omitted entirely for agents so the
          // backend just falls back to the schema default ('reducing').
          ...(isAdmin ? { emiMethod: form.emiMethod } : {})
        });
      }

      if (isDeposit && !isPigmy) {
        Object.assign(payload, {
          roi: form.roi,
          period: form.period,
          periodType: form.periodType,
          maturityDate: form.maturityDate,
          guarantor: form.guarantor,
          depositType: form.depositType
        });
      }

      if (isPigmy) {
        Object.assign(payload, {
          roi: form.roi,
          period: form.period,
          periodType: form.periodType,
          maturityDate: form.maturityDate,
          collectorName: form.collectorName,
          dailyAmount: form.dailyAmount
        });
      }

      // Late fee / grace period / due day … (admin only — agents always get the company defaults)
      if (isAdmin && category !== 'other') {
        payload.terms = pruneTerms(terms);
      }

      if (form.agentId) {
        payload.agentId = form.agentId;
      }

      const r = await api.post('/accounts', payload);
      onSave(r.data);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="modal-body space-y-4 p-4 bg-white">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Account Type *</label>
          <select className="select" value={form.typeName} onChange={e => f('typeName', e.target.value)} required>
            <option value="">Select type…</option>
            {types.map(t => <option key={t._id} value={t.name}>{t.name} ({t.prefix})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Opening Date *</label>
          <input type="date" className="input" value={form.opDate} onChange={e => f('opDate', e.target.value)} required />
        </div>
      </div>
      
      {agents.length > 0 && (
        <div>
          <label className="label">Assign to Agent</label>
          <select className="select" value={form.agentId} onChange={e => f('agentId', e.target.value)}>
            <option value="" style={{ color: '#1e293b', background: '#fff' }}>— None —</option>
            {agents.map(a => <option key={a._id} value={a._id} style={{ color: '#1e293b', background: '#fff' }}>{agentLabel(a)}</option>)}
          </select>
          <p className="text-xs text-slate-900 mt-1">Optional: Directly assign this account to an agent</p>
        </div>
      )}

      {/* Loan Details Section */}
      {isLoan && !isDeposit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wide">Loan Details</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" step="0.01" className="input" value={form.roi} onChange={e => f('roi', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Guarantor</label>
              <input className="input" value={form.guarantor} onChange={e => f('guarantor', e.target.value)} placeholder="Guarantor name" />
            </div>
            <div>
              <label className="label">Duration</label>
              <input type="number" className="input" value={form.period} onChange={e => f('period', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Period Type</label>
              <select className="select" value={form.periodType} onChange={e => f('periodType', e.target.value)}>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
          {/* EMI Method — tenant/admin only, additive field, doesn't affect anything else on the form */}
          {isAdmin && (
            <div>
              <label className="label">EMI Method</label>
              <select className="select" value={form.emiMethod} onChange={e => f('emiMethod', e.target.value)}>
                <option value="reducing">Reducing Balance</option>
                <option value="fixed">Fixed (Flat)</option>
              </select>
            </div>
          )}
          {form.maturityDate && (
            <div className="text-xs text-red-700 font-semibold flex items-center gap-1">
              <i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}
            </div>
          )}
        </div>
      )}

      {/* Deposit Details Section */}
      {isDeposit && !isPigmy && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Deposit Details</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" step="0.01" className="input" value={form.roi} onChange={e => f('roi', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Nominee Name</label>
              <input className="input" value={form.guarantor} onChange={e => f('guarantor', e.target.value)} placeholder="Nominee name" />
            </div>
            <div>
              <label className="label">Duration</label>
              <input type="number" className="input" value={form.period} onChange={e => f('period', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Period Type</label>
              <select className="select" value={form.periodType} onChange={e => f('periodType', e.target.value)}>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
          {form.maturityDate && (
            <div className="text-xs text-blue-700 font-semibold flex items-center gap-1">
              <i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}
            </div>
          )}
        </div>
      )}

      {/* Pigmy Details Section */}
      {isPigmy && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Pigmy Details</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Collector Name</label>
              <input className="input" value={form.collectorName} onChange={e => f('collectorName', e.target.value)} placeholder="Collector name" />
            </div>
            <div>
              <label className="label">Daily Amount</label>
              <input type="number" min="1" className="input" value={form.dailyAmount} onChange={e => f('dailyAmount', e.target.value)} placeholder="Daily amount" />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" step="0.01" className="input" value={form.roi} onChange={e => f('roi', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Duration</label>
              <input type="number" className="input" value={form.period} onChange={e => f('period', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <label className="label">Period Type</label>
              <select className="select" value={form.periodType} onChange={e => f('periodType', e.target.value)}>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
          {form.maturityDate && (
            <div className="text-xs text-blue-700 font-semibold flex items-center gap-1">
              <i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <AccountTermsFields category={category} terms={terms} onChange={(k, v) => setTerms(t => ({ ...t, [k]: v }))} />
      )}

      <div className="modal-footer px-0 pb-0 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Open Account
        </button>
      </div>
    </form>
  );
}

/* ── Edit Account Form ─────────────────────────────────────────────────────── */
const OPT_STYLE = { color: '#1e293b', background: '#fff' };
const toNum = v => (v === '' || v === null || v === undefined ? null : Number(v));

function EditAccountForm({ account, agents = [], onSave, onClose }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [config, setConfig] = useState(null);
  const [groupMap, setGroupMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    typeName: account?.type || '',
    opDate: account?.opDate || '',
    roi: account?.roi ?? '',
    period: account?.period ?? '',
    periodType: account?.periodType || 'months',
    maturityDate: account?.maturityDate || '',
    emiMethod: account?.emiMethod || 'reducing',
    guarantor: account?.guarantor || '',
    depositType: account?.depositType || '',
    agentId: account?.agentId || ''
  });
  const [termEdits, setTermEdits] = useState({});   // only what the user changed in "Terms & Charges" / pigmy fields

  useEffect(() => {
    api.get('/account-types').then(r => setTypes(r.data)).catch(() => { });
    api.get('/config').then(r => setConfig(r.data)).catch(() => { });
    api.get('/groups').then(r => {
      const m = {}; r.data.forEach(g => { m[g.name] = g.type; }); setGroupMap(m);
    }).catch(() => { });
  }, []);

  // Automatically recalculate the maturity date when opening date / duration change
  useEffect(() => {
    if (!form.opDate || !form.period) return;
    const d = new Date(form.opDate);
    const n = parseInt(form.period, 10);
    if (isNaN(n)) return;

    if (form.periodType === 'days') d.setDate(d.getDate() + n);
    else if (form.periodType === 'months') d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);

    setForm(f => ({ ...f, maturityDate: d.toISOString().split('T')[0] }));
  }, [form.opDate, form.period, form.periodType]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setTerm = (k, v) => setTermEdits(t => ({ ...t, [k]: v }));

  // loan | deposit | pigmy | other — decided by the group of the (possibly changed) account type
  const typeObj = types.find(t => t.name === form.typeName);
  const category = accountCategory(
    { category: 'customer', type: form.typeName, group: typeObj?.group || account?.group }, groupMap);
  const terms = { ...termsFor(account, config, category), ...termEdits };   // account's own terms + company defaults for the rest
  const isLoan = category === 'loan';
  const isDeposit = category === 'deposit';
  const isPigmy = category === 'pigmy';
  const accent = isLoan ? 'bg-red-50 border-red-200 text-red-700'
    : isPigmy ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700';

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        type: form.typeName,
        opDate: form.opDate,
        roi: toNum(form.roi),
        period: toNum(form.period),
        periodType: form.periodType,
        maturityDate: form.maturityDate || null,
        // Admin-only fields — left out for agents so the backend keeps the existing values
        ...(isAdmin ? { emiMethod: form.emiMethod } : {}),
        guarantor: form.guarantor,
        depositType: form.depositType,
        ...(isAdmin && agents.length > 0 ? { agentId: form.agentId } : {}),
        ...(isAdmin && category !== 'other' ? { terms: pruneTerms(terms) } : {})
      };
      const r = await api.put(`/accounts/${account._id}`, payload);
      onSave(r.data);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const durationFields = (
    <>
      <div>
        <label className="label">Interest Rate (%)</label>
        <input type="number" step="0.01" min="0" className="input" value={form.roi} onChange={e => f('roi', e.target.value)} placeholder="e.g. 12" />
      </div>
      <div>
        <label className="label">Duration</label>
        <input type="number" min="1" className="input" value={form.period} onChange={e => f('period', e.target.value)} placeholder="e.g. 12" />
      </div>
      <div>
        <label className="label">Period Type</label>
        <select className="select" value={form.periodType} onChange={e => f('periodType', e.target.value)}>
          <option value="days" style={OPT_STYLE}>Days</option>
          <option value="months" style={OPT_STYLE}>Months</option>
          <option value="years" style={OPT_STYLE}>Years</option>
        </select>
      </div>
    </>
  );

  return (
    <form onSubmit={submit} className="modal-body space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Account Type</label>
          <select className="select" value={form.typeName} onChange={e => f('typeName', e.target.value)}>
            <option value="" style={OPT_STYLE}>Select type…</option>
            {/* the account's current type is always listed, even if the type list is still loading */}
            {form.typeName && !types.some(t => t.name === form.typeName) && (
              <option value={form.typeName} style={OPT_STYLE}>{form.typeName}</option>
            )}
            {types.map(t => <option key={t._id} value={t.name} style={OPT_STYLE}>{t.name} ({t.prefix})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Opening Date</label>
          <input type="date" className="input" value={form.opDate} onChange={e => f('opDate', e.target.value)} required />
        </div>
      </div>

      {/* Assign to Agent — admin only; saves to the account (move to another agent or remove) */}
      {isAdmin && agents.length > 0 && (
        <div>
          <label className="label">Assign to Agent</label>
          <select className="select" value={form.agentId} onChange={e => f('agentId', e.target.value)}>
            <option value="" style={OPT_STYLE}>— None —</option>
            {agents.map(a => <option key={a._id} value={a._id} style={OPT_STYLE}>{agentLabel(a)}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">An account belongs to one agent. Choosing another agent moves it.</p>
        </div>
      )}

      {/* Loan Details */}
      {isLoan && (
        <div className={`${accent} border rounded-xl p-4 space-y-3`}>
          <div className="text-xs font-bold uppercase tracking-wide">Loan Details</div>
          <div className="grid grid-cols-2 gap-3">
            {durationFields}
            <div>
              <label className="label">Guarantor</label>
              <input className="input" value={form.guarantor} onChange={e => f('guarantor', e.target.value)} placeholder="Guarantor name" />
            </div>
            {isAdmin && (
              <div>
                <label className="label">EMI Method</label>
                <select className="select" value={form.emiMethod} onChange={e => f('emiMethod', e.target.value)}>
                  <option value="reducing" style={OPT_STYLE}>Reducing Balance</option>
                  <option value="fixed" style={OPT_STYLE}>Fixed (Flat)</option>
                </select>
              </div>
            )}
          </div>
          {form.maturityDate && (
            <div className="text-xs font-semibold flex items-center gap-1"><i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}</div>
          )}
        </div>
      )}

      {/* Deposit Details */}
      {isDeposit && (
        <div className={`${accent} border rounded-xl p-4 space-y-3`}>
          <div className="text-xs font-bold uppercase tracking-wide">Deposit Details</div>
          <div className="grid grid-cols-2 gap-3">
            {durationFields}
            <div>
              <label className="label">Nominee Name</label>
              <input className="input" value={form.guarantor} onChange={e => f('guarantor', e.target.value)} placeholder="Nominee name" />
            </div>
          </div>
          {form.maturityDate && (
            <div className="text-xs font-semibold flex items-center gap-1"><i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}</div>
          )}
        </div>
      )}

      {/* Pigmy Details — this block was missing, so a Pigmy account showed only type + date */}
      {isPigmy && (
        <div className={`${accent} border rounded-xl p-4 space-y-3`}>
          <div className="text-xs font-bold uppercase tracking-wide">Pigmy Details</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Collector Name</label>
              <input className="input" value={terms.collectorName || ''} onChange={e => setTerm('collectorName', e.target.value)} placeholder="Collector name" />
            </div>
            <div>
              <label className="label">Daily Amount</label>
              <input type="number" min="1" className="input" value={terms.dailyAmount ?? ''}
                onChange={e => setTerm('dailyAmount', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Daily amount" />
            </div>
            {durationFields}
            <div>
              <label className="label">Nominee Name</label>
              <input className="input" value={form.guarantor} onChange={e => f('guarantor', e.target.value)} placeholder="Nominee name" />
            </div>
          </div>
          {form.maturityDate && (
            <div className="text-xs font-semibold flex items-center gap-1"><i className="fas fa-calendar-check" /> Maturity: {dateDisp(form.maturityDate)}</div>
          )}
        </div>
      )}

      {/* Terms & Charges (late fee, grace period, due day …) — admin only */}
      {isAdmin && <AccountTermsFields category={category} terms={terms} onChange={setTerm} />}

      <div className="modal-footer px-0 pb-0 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}

/* ── Customer Profile Modal ────────────────────────────────────────────────── */
function CustomerProfile({ customer, agents = [], onClose, onGoToTrans, isAdmin }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.get(`/accounts?custId=${customer._id}`);
      setAccounts(r.data);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [customer._id]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async acc => {
    const s = acc.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/accounts/${acc._id}/status`, { status: s });
      toast.success(`Account ${s}`);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  const deleteAcc = async id => {
    if (!window.confirm('Permanently delete this account?')) return;
    try {
      await api.delete(`/accounts/${id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  const openEditAccount = (account) => {
    setSelectedAccount(account);
    setShowEditModal(true);
  };

  const handleEditSave = (updatedAccount) => {
    setAccounts(p => p.map(a => a._id === updatedAccount._id ? updatedAccount : a));
    setShowEditModal(false);
    setSelectedAccount(null);
    toast.success('Account updated');
  };

  const visible = accounts.filter(a => showInactive || a.status === 'active');
  const total = visible.reduce((s, a) => s + (a.balance || 0), 0);

  return (
    <>
      <div className="modal-body space-y-4">
        {/* Customer info strip */}
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="fas fa-user text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-base leading-tight break-words">{customer.name}</div>
            <div className="text-sm text-slate-500 mt-0.5">{customer.custNo} &nbsp;·&nbsp; {customer.mobile || 'No mobile'}</div>
            {customer.address && <div className="text-xs text-slate-400 mt-0.5 truncate">{customer.address}</div>}
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-xl font-bold font-mono leading-tight ${total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt.format(total)}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total Balance</div>
          </div>
        </div>

        {/* ── Form view: shown alone, list hidden ──────────────────────────── */}
        {showAddAcc ? (
          <div className="rounded-2xl border border-blue-200 overflow-hidden shadow-sm">
            {/* Form header */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-folder-plus text-white text-sm" />
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-tight">Open New Account</div>
                <div className="text-blue-100 text-xs mt-0.5">{customer.name} &nbsp;·&nbsp; {customer.custNo}</div>
              </div>
            </div>
            <OpenAccountForm
              customerId={customer._id}
              agents={agents}
              onSave={acc => { setShowAddAcc(false); load(); toast.success(`Account ${acc.accNo} created`); }}
              onClose={() => setShowAddAcc(false)}
            />
          </div>
        ) : (
          <>
            {/* Accounts header — only visible when form is closed */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-sm">Accounts <span className="text-slate-400">({visible.length})</span></span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" /> Show Inactive
                </label>
                <button onClick={() => setShowAddAcc(true)} className="btn btn-primary btn-sm">
                  <i className="fas fa-plus" /> Open Account
                </button>
              </div>
            </div>

            {/* Accounts list — only visible when form is closed */}
            {loading ? (
              <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : visible.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm"><i className="fas fa-folder-open text-2xl mb-2 block" />{showInactive ? 'No accounts' : 'No active accounts'}</div>
            ) : (
              <>
                {/* MOBILE CARD VIEW (visible on small screens) */}
                <div className="md:hidden space-y-3">
                  {visible.map(acc => {
                    const isLoanAccount = (acc.group || '').toLowerCase().includes('loan') || (acc.type || '').toLowerCase().includes('loan');
                    const isInactive = acc.status !== 'active';
                    return (
                      <div key={acc._id} className={`bg-white rounded-xl border border-blue-300 shadow-sm overflow-hidden ${isInactive ? 'opacity-70' : ''}`}>
                        {/* Card content */}
                        <div className="p-3.5">
                          <div className="flex items-start gap-3">
                            {/* Account type icon */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${isLoanAccount ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {acc.type?.substring(0, 2).toUpperCase()}
                            </div>
                            {/* Account details */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-700 font-mono">{acc.accNo}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{acc.type} &nbsp;·&nbsp; {dateDisp(acc.opDate)}</div>
                              {isLoanAccount && acc.maturityDate && (
                                <div className="text-xs text-amber-600 mt-1">
                                  <i className="fas fa-calendar-alt mr-1" />Maturity: {dateDisp(acc.maturityDate)}
                                </div>
                              )}
                            </div>
                            {/* Balance & status */}
                            <div className="text-right">
                              <div className={`font-bold font-mono text-sm ${isLoanAccount ? 'text-red-500' : 'text-emerald-600'}`}>
                                {fmt.format(acc.balance)}
                              </div>
                              <div className="mt-1">
                                <StatusBadge status={acc.status} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Action buttons row */}
                        <div className="flex border-t border-blue-100 bg-slate-50">
                          {!isInactive && (
                            <button onClick={() => onGoToTrans(acc._id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors">
                              <i className="fas fa-exchange-alt" style={{ fontSize: '10px' }} /> Transaction
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => toggleStatus(acc)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold ${isInactive ? 'text-green-600' : 'text-amber-600'} hover:bg-slate-100 active:bg-slate-200 transition-colors`}>
                                <i className={`fas ${isInactive ? 'fa-check' : 'fa-ban'}`} style={{ fontSize: '10px' }} /> {isInactive ? 'Activate' : 'Deactivate'}
                              </button>
                              <button onClick={() => openEditAccount(acc)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors">
                                <Pencil size={12} /> Edit
                              </button>
                              <button onClick={() => deleteAcc(acc._id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                                <i className="fas fa-trash" style={{ fontSize: '10px' }} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW (hidden on small screens) */}
                <div className="hidden md:block">
                  <div className="table-wrap rounded-none overflow-x-auto w-full">
                    <table className="table min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr>
                          <th className="whitespace-nowrap">Account No</th>
                          <th className="whitespace-nowrap">Type</th>
                          <th className="whitespace-nowrap">Opening Date</th>
                          <th className="whitespace-nowrap">Balance</th>
                          <th className="whitespace-nowrap">Status</th>
                          <th className="sticky right-0 bg-slate-50 z-10 text-right whitespace-nowrap px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visible.map(acc => {
                          const isLoanAccount = (acc.group || '').toLowerCase().includes('loan') || (acc.type || '').toLowerCase().includes('loan');
                          const isInactive = acc.status !== 'active';
                          return (
                            <tr key={acc._id} className={`${isInactive ? 'opacity-70' : ''} hover:bg-slate-50/50`}>
                              <td className="whitespace-nowrap"><span className="font-mono text-sm font-semibold">{acc.accNo}</span></td>
                              <td className="whitespace-nowrap">{acc.type}</td>
                              <td className="text-slate-500 text-sm whitespace-nowrap">{dateDisp(acc.opDate)}</td>
                              <td className={`font-mono font-bold whitespace-nowrap ${isLoanAccount ? 'text-red-500' : 'text-emerald-600'}`}>{fmt.format(acc.balance)}</td>
                              <td className="whitespace-nowrap"><StatusBadge status={acc.status} /></td>
                              <td className="sticky right-0 bg-white group-hover:bg-slate-50 z-10 px-4 text-right whitespace-nowrap">
                                <div className="flex gap-1.5 justify-end items-center">
                                  {!isInactive && (
                                    <button onClick={() => onGoToTrans(acc._id)} className="btn btn-primary btn-sm" title="Transaction">
                                      <i className="fas fa-exchange-alt" />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <button onClick={() => toggleStatus(acc)} className={`btn btn-sm ${isInactive ? 'btn-secondary' : 'btn-outline'}`} title={isInactive ? 'Activate' : 'Deactivate'}>
                                        <i className={`fas ${isInactive ? 'fa-check' : 'fa-ban'}`} />
                                      </button>
                                      <button onClick={() => openEditAccount(acc)} className="btn btn-warning btn-sm" title="Edit">
                                        <Pencil size={14} />
                                      </button>
                                      <button onClick={() => deleteAcc(acc._id)} className="btn btn-danger btn-sm" title="Delete">
                                        <i className="fas fa-trash" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Edit Account Modal Wrapper */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedAccount(null); }} title="Edit Account" size="lg">
        {selectedAccount && <EditAccountForm account={selectedAccount} agents={agents} onSave={handleEditSave} onClose={() => { setShowEditModal(false); setSelectedAccount(null); }} />}
      </Modal>
    </>
  );
}

/* ── Customer Form ─────────────────────────────────────────────────────────── */
function CustomerForm({ customer, onSave, onClose, onImport }) {
  const [form, setForm] = useState({ name: customer?.name || '', mobile: customer?.mobile || '', address: customer?.address || '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = customer ? await api.put(`/customers/${customer._id}`, form) : await api.post('/customers', form);
      onSave(r.data, customer ? 'update' : 'create');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={submit} className="modal-body space-y-4">
      {!customer && onImport && (
        <button type="button" onClick={onImport}
          className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
          <span className="flex items-center gap-2 text-sm font-semibold"><i className="fas fa-file-csv" /> Import customers from CSV</span>
          <kbd className="hidden sm:inline text-[10px] font-bold bg-white border border-emerald-200 rounded px-1.5 py-0.5">Ctrl + I</kbd>
        </button>
      )}
      <div>
        <label className="label">Full Name *</label>
        <input className="input" value={form.name} onChange={e => f('name', e.target.value)} required placeholder="Customer's full name" />
      </div>
      <div>
        <label className="label">Mobile</label>
        <input className="input" value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="Mobile number" />
      </div>
      <div>
        <label className="label">Address</label>
        <textarea className="input h-20 resize-none" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Full address" />
      </div>
      <div className="modal-footer px-0 pb-0 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {customer ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </form>
  );
}

/* ── Main CustomersPage ────────────────────────────────────────────────────── */
export default function CustomersPage({ onNavigate }) {
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const { isAdmin } = useAuth();
  const toast = useToast();

  const load = useCallback(async (q = '') => {
    try {
      setLoading(true);
      const r = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(r.data);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    load();
    api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {});
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  // Ctrl + I (Cmd + I on Mac) → import customers from CSV
  useEffect(() => {
    if (!isAdmin) return undefined;
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'i') {
        e.preventDefault();
        setShowForm(false); setEditing(null);
        setShowImport(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  const handleSave = (data, type) => {
    if (type === 'create') setCustomers(p => [data, ...p]);
    else setCustomers(p => p.map(c => c._id === data._id ? data : c));
    setShowForm(false);
    setEditing(null);
    toast.success(type === 'create' ? 'Customer created' : 'Customer updated');
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/customers/${id}`);
      setCustomers(p => p.filter(c => c._id !== id));
      toast.success('Customer deleted');
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
    setConfirm(null);
  };

  const goToTrans = accId => {
    setProfile(null);
    onNavigate('transactions', { preSelectAccId: accId });
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} total customers`}
        actions={isAdmin && (
          <div className="hidden sm:flex gap-2">
            <button onClick={() => setShowImport(true)} className="btn btn-outline items-center gap-1.5" title="Import customers from CSV (Ctrl+I)">
              <i className="fas fa-file-csv text-emerald-600" /> Import CSV
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary items-center gap-1.5">
              <i className="fas fa-user-plus" /> Add Customer
            </button>
          </div>
        )}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, ID, mobile…" className="flex-1 sm:max-w-md" />
          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="sm:hidden w-10 h-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl flex-shrink-0 shadow-sm active:bg-emerald-700 transition-colors"
              aria-label="Import CSV"
            >
              <i className="fas fa-file-csv text-sm"/>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="sm:hidden w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl flex-shrink-0 shadow-sm active:bg-blue-700 transition-colors"
            >
              <i className="fas fa-user-plus text-sm"/>
            </button>
          )}
        </div>

        {loading ? (
          <PageLoader />
        ) : customers.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="No customers yet"
            message="Add your first customer to get started"
            action={isAdmin && <button onClick={() => setShowForm(true)} className="btn btn-primary">Add Customer</button>}
          />
        ) : (
          <>
            <div className="md:hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {customers.length} Customer{customers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {customers.slice(0, 4).map(c => {
                      const hue = (c.name.charCodeAt(0) * 47) % 360;
                      return (
                        <div key={c._id} className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                          style={{background:`hsl(${hue},60%,50%)`}}>
                          {c.name[0].toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  {customers.length > 4 && (
                    <span className="text-xs text-slate-400">+{customers.length - 4}</span>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-2.5">
                {customers.map((c) => {
                  const initials   = c.name.trim().split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
                  const hue        = (c.name.charCodeAt(0) * 47) % 360;
                  const avatarFrom = `hsl(${hue},60%,50%)`;
                  const avatarTo   = `hsl(${(hue+30)%360},65%,42%)`;

                  return (
                    <div
                      key={c._id}
                      className="bg-white rounded-2xl border border-blue-300 shadow-sm overflow-hidden"
                      style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 pt-4 pb-3 text-left active:bg-slate-50 transition-colors"
                        onClick={() => setProfile(c)}
                      >
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{background:`linear-gradient(135deg,${avatarFrom},${avatarTo})`}}
                        >
                          <span className="text-white font-bold text-sm">{initials}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 text-sm leading-tight truncate">{c.name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 font-mono tracking-wide">
                              {c.custNo}
                            </span>
                            {c.mobile && (
                              <span className="text-[11px] text-slate-400 font-medium truncate">{c.mobile}</span>
                            )}
                          </div>
                        </div>

                        <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-100">
                          <i className="fas fa-chevron-right text-slate-400" style={{fontSize:'9px'}}/>
                        </div>
                      </button>

                      {c.address && (
                        <div className="px-4 pb-3 flex items-start gap-2">
                          <div className="w-5 h-5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <i className="fas fa-map-marker-alt text-slate-300" style={{fontSize:'9px'}}/>
                          </div>
                          <span className="text-xs text-slate-400 leading-relaxed line-clamp-1">{c.address}</span>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex border-t border-slate-100">
                          <button
                            onClick={() => setProfile(c)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                          >
                            <i className="fas fa-eye" style={{fontSize:'10px'}}/> Profile
                          </button>
                          <div className="w-px bg-slate-100"/>
                          <button
                            onClick={() => { setEditing(c); setShowForm(true); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                          >
                            <i className="fas fa-pen" style={{fontSize:'10px'}}/> Edit
                          </button>
                          <div className="w-px bg-slate-100"/>
                          <button
                            onClick={() => setConfirm(c._id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                          >
                            <i className="fas fa-trash" style={{fontSize:'10px'}}/> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="h-20"/>
            </div>

            <div className="hidden md:block table-wrap rounded-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c._id}>
                      <td><span className="badge badge-blue font-mono text-xs">{c.custNo}</span></td>
                      <td><span className="font-semibold text-slate-800">{c.name}</span></td>
                      <td className="text-slate-500 text-sm">{c.mobile || '—'}</td>
                      <td className="text-slate-400 text-xs max-w-[160px] truncate">{c.address || '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => setProfile(c)} className="btn btn-primary btn-sm"><i className="fas fa-eye" /> View</button>
                          {isAdmin && (
                            <>
                              <button onClick={() => { setEditing(c); setShowForm(true); }} className="btn btn-warning btn-sm"><i className="fas fa-edit" /></button>
                              <button onClick={() => setConfirm(c._id)} className="btn btn-danger btn-sm"><i className="fas fa-trash" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {isAdmin && (
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-2xl shadow-xl shadow-blue-600/40 flex items-center justify-center transition-all"
          aria-label="Add Customer"
        >
          <i className="fas fa-user-plus text-lg"/>
        </button>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <CustomerForm customer={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }}
          onImport={() => { setShowForm(false); setEditing(null); setShowImport(true); }} />
      </Modal>

      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Customers from CSV" size="lg">
        <ImportCustomers onClose={() => setShowImport(false)} onDone={r => { load(search); toast.success(`${r.created} customer(s) imported`); }} />
      </Modal>

      <Modal isOpen={!!profile} onClose={() => setProfile(null)} title="Customer Profile" size="lg">
        {profile && <CustomerProfile customer={profile} agents={agents} onClose={() => setProfile(null)} onGoToTrans={goToTrans} isAdmin={isAdmin} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        title="Delete Customer"
        message="This will permanently delete the customer and all their accounts with zero balance."
        confirmText="Delete"
        onConfirm={() => handleDelete(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}