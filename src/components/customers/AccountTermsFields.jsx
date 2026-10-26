import { useState } from 'react';
import { LATE_FEE_TYPES, lateFeeText } from '../../utils/finance';

/* ─────────────────────────────────────────────────────────────────────────────
   Terms & Charges — the per-account copy of the company Configuration
   (late fee, grace period, due day, processing fee, pre-closure / premature charges …)

   category : 'loan' | 'deposit' | 'pigmy'
   terms    : { lateFeeType, lateFee, graceDays, dueDay, … }
   onChange : (key, value) => void
───────────────────────────────────────────────────────────────────────────── */
const OPT = { color: '#1e293b', background: '#fff' };
const PAYOUTS = [['maturity', 'At maturity'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']];

// remove empty values before sending to the server (it rejects '' for numbers)
export function pruneTerms(terms) {
  const out = {};
  Object.keys(terms || {}).forEach(k => {
    const v = terms[k];
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

const num = v => (v === '' ? '' : Number(v));

export default function AccountTermsFields({ category, terms = {}, onChange }) {
  const [open, setOpen] = useState(false);
  if (!['loan', 'deposit', 'pigmy'].includes(category)) return null;

  const N = (k, label, extra = {}) => (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" min="0" step={extra.step || '1'} max={extra.max}
        value={terms[k] ?? ''} onChange={e => onChange(k, num(e.target.value))} disabled={extra.disabled} />
    </div>
  );

  const summary = category === 'loan'
    ? `${lateFeeText(terms)} · grace ${Number(terms.graceDays) || 0}d · due day ${terms.dueDay || '—'}`
    : category === 'deposit'
      ? `Payout ${(PAYOUTS.find(p => p[0] === terms.interestPayout) || [])[1] || '—'} · early exit −${Number(terms.prematurePenaltyPct) || 0}%`
      : `Early closure −${Number(terms.prematurePenaltyPct) || 0}% p.a.`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-100 text-left">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
            <i className="fas fa-sliders mr-1.5 text-slate-400" />Terms &amp; Charges
          </span>
          <span className="block text-[11px] text-slate-400 truncate mt-0.5">{summary}</span>
        </span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-slate-400 text-xs flex-shrink-0`} />
      </button>

      {open && (
        <div className="p-3.5 space-y-3 border-t border-slate-100">
          {category === 'loan' && (
            <div className="grid grid-cols-2 gap-3">
              {N('dueDay', 'EMI Due Day (1–28)', { max: 28 })}
              {N('graceDays', 'Grace Period (days)', { max: 90 })}
              <div>
                <label className="label">Late Fee Type</label>
                <select className="select" value={terms.lateFeeType || 'none'} onChange={e => onChange('lateFeeType', e.target.value)}>
                  {LATE_FEE_TYPES.map(t => <option key={t.value} value={t.value} style={OPT}>{t.label}</option>)}
                </select>
              </div>
              {N('lateFee', 'Late Fee', { step: '0.01', disabled: (terms.lateFeeType || 'none') === 'none' })}
              <div className="col-span-2">
                <label className="label">Late Fee Counted From</label>
                <select className="select" value={terms.lateFeeFrom || 'grace'} onChange={e => onChange('lateFeeFrom', e.target.value)}>
                  <option value="grace" style={OPT}>After the grace period</option>
                  <option value="due" style={OPT}>Due date onwards (once grace is over)</option>
                </select>
              </div>
              {N('processingFeePct', 'Processing Fee (%)', { step: '0.01', max: 100 })}
              {N('foreclosurePct', 'Pre-closure Charge (%)', { step: '0.01', max: 100 })}
            </div>
          )}

          {category === 'deposit' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Interest Payout</label>
                <select className="select" value={terms.interestPayout || 'maturity'} onChange={e => onChange('interestPayout', e.target.value)}>
                  {PAYOUTS.map(([v, l]) => <option key={v} value={v} style={OPT}>{l}</option>)}
                </select>
              </div>
              {N('prematurePenaltyPct', 'Premature Withdrawal Penalty (% p.a.)', { step: '0.01', max: 100 })}
            </div>
          )}

          {category === 'pigmy' && (
            <div className="grid grid-cols-2 gap-3">
              {N('prematurePenaltyPct', 'Premature Closure Penalty (% p.a.)', { step: '0.01', max: 100 })}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            <i className="fas fa-info-circle mr-1" />These terms belong to this account only. Defaults come from the company Configuration.
          </p>
        </div>
      )}
    </div>
  );
}
