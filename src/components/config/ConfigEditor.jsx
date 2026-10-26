import { useState, useEffect } from 'react';
import api, { getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { LATE_FEE_TYPES, lateFeeAmount, lateFeeText } from '../../utils/finance';
import { PageLoader } from '../shared';

/* ─────────────────────────────────────────────────────────────────────────────
   Configuration — default terms for Loans, Deposits and Pigmy
   (interest, late fee, grace period, due day …)

   Used in two places:
     • Super Admin → Companies → ⚙ Configuration   (endpoint = /companies/<id>/config)
     • Company Settings → Configuration tab         (endpoint = /config)
   New accounts copy these defaults; accounts that already exist keep their own terms.
───────────────────────────────────────────────────────────────────────────── */
const PERIODS = [['days', 'Days'], ['months', 'Months'], ['years', 'Years']];

const FIELDS = {
  loan: [
    { k: 'interestRate',     label: 'Default Interest Rate (% p.a.)', type: 'number', step: '0.01', min: 0, max: 100 },
    { k: 'interestMethod',   label: 'Interest / EMI Method', type: 'select', options: [['reducing', 'Reducing Balance'], ['fixed', 'Fixed (Flat)']] },
    { k: 'tenure',           label: 'Default Tenure', type: 'number', min: 1, max: 600 },
    { k: 'tenureType',       label: 'Tenure Unit', type: 'select', options: PERIODS },
    { group: 'EMI due date & late fee' },
    { k: 'dueDay',           label: 'EMI Due Day (of every month)', type: 'number', min: 1, max: 28, hint: 'Every EMI falls due on this day of the month (1–28).' },
    { k: 'graceDays',        label: 'Grace Period (days)', type: 'number', min: 0, max: 90, hint: 'No late fee if the EMI is paid within these days after the due date.' },
    { k: 'lateFeeType',      label: 'Late Fee Type', type: 'select', options: LATE_FEE_TYPES.map(t => [t.value, t.label]) },
    { k: 'lateFee',          label: 'Late Fee', type: 'number', step: '0.01', min: 0, hint: 'Rupees for Flat / Per day, percent for “% of EMI”.' },
    { k: 'lateFeeFrom',      label: 'Late Fee Counted From', type: 'select', options: [['grace', 'After the grace period'], ['due', 'Due date onwards (once grace is over)']],
      hint: '“Due date onwards” charges for every day since the due date, but only if the grace period was missed.' },
    { group: 'Charges' },
    { k: 'processingFeePct', label: 'Processing Fee (% of loan amount)', type: 'number', step: '0.01', min: 0, max: 100 },
    { k: 'foreclosurePct',   label: 'Pre-closure Charge (% of outstanding)', type: 'number', step: '0.01', min: 0, max: 100 },
  ],
  deposit: [
    { k: 'interestRate',        label: 'Default Interest Rate (% p.a.)', type: 'number', step: '0.01', min: 0, max: 100 },
    { k: 'tenure',              label: 'Default Tenure', type: 'number', min: 1, max: 600 },
    { k: 'tenureType',          label: 'Tenure Unit', type: 'select', options: PERIODS },
    { k: 'interestPayout',      label: 'Interest Payout', type: 'select', options: [['maturity', 'At maturity'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']] },
    { k: 'prematurePenaltyPct', label: 'Premature Withdrawal Penalty (% p.a.)', type: 'number', step: '0.01', min: 0, max: 100, hint: 'The interest rate is reduced by this much when a deposit is closed before maturity.' },
  ],
  pigmy: [
    { k: 'interestRate',        label: 'Default Interest Rate (% p.a.)', type: 'number', step: '0.01', min: 0, max: 100 },
    { k: 'tenure',              label: 'Default Tenure', type: 'number', min: 1, max: 600 },
    { k: 'tenureType',          label: 'Tenure Unit', type: 'select', options: PERIODS },
    { k: 'minDailyAmount',      label: 'Minimum Daily Amount (₹)', type: 'number', step: '0.01', min: 0, hint: 'Pigmy accounts below this daily amount are rejected.' },
    { k: 'prematurePenaltyPct', label: 'Premature Closure Penalty (% p.a.)', type: 'number', step: '0.01', min: 0, max: 100 },
  ],
  general: [
    { k: 'reminderDays', label: 'Reminder Window (days)', type: 'number', min: 1, max: 60, hint: 'Dashboard “Reminders & Alerts” shows loans / deposits due within this many days.' },
  ],
};

const TABS = [
  { id: 'loan',    label: 'Loans',    icon: 'fa-hand-holding-dollar', tone: 'from-rose-500 to-red-600' },
  { id: 'deposit', label: 'Deposits', icon: 'fa-piggy-bank',          tone: 'from-blue-500 to-indigo-600' },
  { id: 'pigmy',   label: 'Pigmy',    icon: 'fa-coins',               tone: 'from-amber-500 to-orange-600' },
  { id: 'general', label: 'General',  icon: 'fa-sliders',             tone: 'from-slate-500 to-slate-700' },
];

export default function ConfigEditor({ endpoint, canEdit = true, onSaved }) {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState('loan');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setCfg(null);
    api.get(endpoint).then(r => { if (alive) setCfg(r.data); }).catch(err => toast.error(getErrorMsg(err)));
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [endpoint]);

  if (!cfg) return <PageLoader />;

  const set = (sec, k, v) => setCfg(c => ({ ...c, [sec]: { ...c[sec], [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put(endpoint, cfg);
      setCfg(r.data);
      toast.success('Configuration saved');
      if (onSaved) onSaved(r.data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  // live example so the owner can see what a late fee will actually be
  const loan = cfg.loan;
  const example = lateFeeAmount(loan, { unpaid: [{ daysOverdue: 20, emi: 10000 }] });

  return (
    <div className="space-y-4">
      {/* tabs */}
      <div className="grid grid-cols-4 gap-2">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === t.id ? `bg-gradient-to-br ${t.tone} text-white shadow-md` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <i className={`fas ${t.icon} text-sm`} />{t.label}
          </button>
        ))}
      </div>

      {/* fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS[tab].map((f, i) => f.group ? (
          <div key={`g${i}`} className="sm:col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-100">{f.group}</div>
        ) : (
          <div key={f.k}>
            <label className="label">{f.label}</label>
            {f.type === 'select' ? (
              <select className="select" disabled={!canEdit} value={cfg[tab][f.k] ?? ''} onChange={e => set(tab, f.k, e.target.value)}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <input type="number" className="input" disabled={!canEdit} step={f.step || '1'} min={f.min} max={f.max}
                value={cfg[tab][f.k] ?? ''} onChange={e => set(tab, f.k, e.target.value === '' ? '' : Number(e.target.value))} />
            )}
            {f.hint && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{f.hint}</p>}
          </div>
        ))}
      </div>

      {tab === 'loan' && (
        <div className="rounded-xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-100 p-3 text-xs text-slate-600">
          <div className="font-bold text-rose-700 mb-0.5"><i className="fas fa-calculator mr-1.5" />Example</div>
          Rule: <b>{lateFeeText(loan)}</b>{loan.graceDays ? `, grace ${loan.graceDays} day(s)` : ''}.
          An EMI of ₹10,000 paid <b>20 days</b> after its due date carries a late fee of <b>₹{example.toLocaleString('en-IN')}</b>.
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        <i className="fas fa-info-circle mr-1" />
        New accounts start with these terms. Accounts that already exist keep their own terms (edit the account to change them).
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}
