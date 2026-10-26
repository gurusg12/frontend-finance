import { fmt, dateDisp } from '../../utils/api';
import { accountCategory, termsFor, loanArrears, lateFeeAmount, lateFeeText, accruedInterest, ymd } from '../../utils/finance';

/* ─────────────────────────────────────────────────────────────────────────────
   Account Terms — shown in the Transaction form under the account card.
   Loans    : interest, EMI, due day, grace, late fee, processing / pre-closure charge, arrears + late fee payable
   Deposits : interest, payout, maturity, accrued interest, premature-withdrawal effect
   Pigmy    : daily amount, collector, interest, accrued interest
───────────────────────────────────────────────────────────────────────────── */
const Chip = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-white/70 text-slate-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800', green: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${tones[tone]}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-60 leading-none mb-0.5">{label}</div>
      <div className="text-xs font-bold font-mono leading-tight">{value}</div>
    </div>
  );
};

export default function AccountTermsCard({ account, config, groupTypeMap, txDate, txType, amount }) {
  if (!account || account.category === 'ledger') return null;
  const cat = accountCategory(account, groupTypeMap);
  if (cat === 'other') return null;

  const terms = termsFor(account, config, cat);
  const today = txDate || ymd(new Date());
  const roi = Number(account.roi) || 0;
  const accrued = accruedInterest(account, today);
  const amt = parseFloat(amount) || 0;

  const head = {
    loan:    { title: 'Loan Terms',    grad: 'from-rose-50 to-orange-50 border-rose-200',  text: 'text-rose-700',  icon: 'fa-hand-holding-dollar' },
    deposit: { title: 'Deposit Terms', grad: 'from-sky-50 to-indigo-50 border-sky-200',    text: 'text-sky-700',   icon: 'fa-piggy-bank' },
    pigmy:   { title: 'Pigmy Terms',   grad: 'from-amber-50 to-yellow-50 border-amber-200', text: 'text-amber-700', icon: 'fa-coins' },
  }[cat];

  /* ── loan figures ── */
  let arrears = null, lateFee = 0;
  if (cat === 'loan') {
    arrears = loanArrears(account, terms, today);
    lateFee = lateFeeAmount(terms, arrears);
  }

  /* ── premature withdrawal (deposit / pigmy) ── */
  const penalty = Number(terms.prematurePenaltyPct) || 0;
  const early = cat !== 'loan' && account.maturityDate && today < account.maturityDate;
  const reducedRate = Math.max(0, roi - penalty);
  const reducedInterest = roi > 0 ? accrued * (reducedRate / roi) : 0;

  return (
    <div className={`bg-gradient-to-br ${head.grad} border rounded-xl p-3 mb-4`}>
      <div className={`flex items-center justify-between mb-2 ${head.text}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider"><i className={`fas ${head.icon} mr-1.5`} />{head.title}</span>
        {account.maturityDate && <span className="text-[10px] font-semibold opacity-80">Matures {dateDisp(account.maturityDate)}</span>}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Chip label="Interest" value={roi ? `${roi}% p.a.` : '—'} />

        {cat === 'loan' && (<>
          <Chip label="EMI" value={arrears ? fmt.format(arrears.emi) : '—'} />
          <Chip label="Due day" value={terms.dueDay ? `${terms.dueDay}th` : '—'} />
          <Chip label="Grace" value={`${Number(terms.graceDays) || 0} day(s)`} />
          <Chip label="Late fee" value={lateFeeText(terms)} />
          <Chip label="Method" value={account.emiMethod === 'fixed' ? 'Flat' : 'Reducing'} />
        </>)}

        {cat === 'deposit' && (<>
          <Chip label="Payout" value={({ maturity: 'At maturity', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' })[terms.interestPayout] || '—'} />
          <Chip label="Accrued interest" value={fmt.format(accrued)} tone="green" />
          <Chip label="Early exit" value={penalty ? `−${penalty}% p.a.` : 'No penalty'} />
        </>)}

        {cat === 'pigmy' && (<>
          <Chip label="Daily amount" value={terms.dailyAmount ? fmt.format(terms.dailyAmount) : '—'} />
          <Chip label="Collector" value={terms.collectorName || '—'} />
          <Chip label="Accrued interest" value={fmt.format(accrued)} tone="green" />
        </>)}
      </div>

      {/* loan status line */}
      {cat === 'loan' && arrears && (
        arrears.unpaid.length > 0 ? (
          <div className="mt-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-800 space-y-0.5">
            <div className="font-bold"><i className="fas fa-triangle-exclamation mr-1.5" />
              {arrears.unpaid.length} EMI overdue · {fmt.format(arrears.arrearsAmount)} · oldest {arrears.overdueDays} day(s)
            </div>
            <div>Late fee payable today: <b className="font-mono">{fmt.format(lateFee)}</b>
              {lateFee === 0 && ' (within grace period / no late fee set)'}
              {lateFee > 0 && txType === 'repay_princ' && <span className="opacity-80"> — add it under Charges ⋯</span>}
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-semibold">
            <i className="fas fa-circle-check mr-1.5" />No EMI overdue
            {arrears.nextDue && <span className="font-normal"> · next EMI {fmt.format(arrears.nextDue.emi)} on {dateDisp(arrears.nextDue.date)}</span>}
          </div>
        )
      )}
      {cat === 'loan' && !arrears && (
        <div className="mt-2 text-[11px] text-slate-500">Arrears are calculated after the loan is disbursed.</div>
      )}

      {/* loan one-off charges for the amount typed */}
      {cat === 'loan' && txType === 'disburse' && amt > 0 && Number(terms.processingFeePct) > 0 && (
        <div className="mt-2 text-[11px] text-slate-600">
          Processing fee {terms.processingFeePct}% on {fmt.format(amt)} = <b className="font-mono">{fmt.format((amt * terms.processingFeePct) / 100)}</b>
        </div>
      )}
      {cat === 'loan' && txType === 'repay_princ' && Number(terms.foreclosurePct) > 0 && account.balance > 0 && amt >= account.balance - 0.5 && (
        <div className="mt-2 text-[11px] text-slate-600">
          Pre-closure charge {terms.foreclosurePct}% of {fmt.format(account.balance)} = <b className="font-mono">{fmt.format((account.balance * terms.foreclosurePct) / 100)}</b>
        </div>
      )}

      {/* premature withdrawal effect */}
      {early && txType === 'withdraw' && penalty > 0 && accrued > 0 && (
        <div className="mt-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <i className="fas fa-hourglass-half mr-1.5" />Before maturity: rate drops to <b>{reducedRate}%</b>, interest payable
          <b className="font-mono"> {fmt.format(reducedInterest)}</b> instead of {fmt.format(accrued)}.
        </div>
      )}
    </div>
  );
}
