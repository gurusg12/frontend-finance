import { useState, useEffect } from 'react';
import api, { fmt, dateDisp, dateNow } from '../../utils/api';
import { PageLoader } from '../shared';
import {
  ymd, buildSchedule, periodInMonths, AGEING_BUCKETS, overdueDays, bucketOf, classify,
  trialBalance, accountImpact, daysBetween,
} from '../../utils/finance';

/* ── small helpers ───────────────────────────────────────────────────────── */
function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, loading: true }));
    fn().then(d => live && setState({ data: d, loading: false, error: null }))
        .catch(e => live && setState({ data: null, loading: false, error: e }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function RTable({ heads, rows, foot }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr>{heads.map((h, i) => (
        <th key={i} className={`border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide ${h.right ? 'text-right' : ''}`}>{h.label}</th>
      ))}</tr></thead>
      <tbody>{rows.map((r, ri) => (
        <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
          {r.map((c, ci) => <td key={ci} className={`border border-slate-200 px-3 py-2 ${heads[ci]?.right ? 'text-right font-mono' : ''}`}>{c}</td>)}
        </tr>
      ))}</tbody>
      {foot && <tfoot><tr className="bg-blue-100 font-bold">{foot.map((c, i) => (
        <td key={i} className={`border border-slate-300 px-3 py-2 ${heads[i]?.right ? 'text-right font-mono' : ''}`}>{c}</td>
      ))}</tr></tfoot>}
    </table>
  );
}

const Empty = ({ text }) => <div className="text-center py-10 text-slate-400 text-sm">{text}</div>;
const sum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
const custName = a => a.custId?.name || a.name;
const SectionBar = ({ children, color = 'bg-slate-700' }) =>
  <div className={`${color} text-white text-sm font-bold px-3 py-2 uppercase tracking-wide`}>{children}</div>;

const Stat = ({ label, value, tone = 'text-slate-800' }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    <div className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${tone}`}>{value}</div>
  </div>
);

const TYPE_LABEL = {
  deposit: 'Deposit', withdraw: 'Withdrawal', disburse: 'Loan Disbursed', repay_princ: 'Loan Repayment',
  income: 'Income', expense: 'Expense', agent_handover: 'Agent Handover', adjustment: 'Adjustment',
};

/* ══════════════════════════════════════════════════════════════════════════
   1. TRIAL BALANCE
══════════════════════════════════════════════════════════════════════════ */
function TrialBalanceReport() {
  const { data, loading } = useAsync(() => Promise.all([
    api.get('/accounts'), api.get('/groups'), api.get('/reports/agent-cash').catch(() => ({ data: [] })),
  ]).then(([a, g, ag]) => {
    const agentCash = sum((ag.data || []).filter(x => x.balance > 0.01), x => x.balance);
    return trialBalance(a.data, g.data, agentCash);
  }), []);
  if (loading) return <PageLoader />;
  if (!data) return null;
  const { groups, totalDr, totalCr, diff } = data;
  return (
    <div>
      <table className="w-full text-sm border-collapse">
        <thead><tr>
          <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs uppercase">Particulars</th>
          <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-right text-xs uppercase">Debit (₹)</th>
          <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-right text-xs uppercase">Credit (₹)</th>
        </tr></thead>
        <tbody>
          {groups.map(g => (
            <FragmentRows key={g.group} g={g} />
          ))}
        </tbody>
        <tfoot><tr className="bg-blue-100 font-bold">
          <td className="border border-slate-300 px-3 py-2">Total</td>
          <td className="border border-slate-300 px-3 py-2 text-right font-mono">{fmt.format(totalDr)}</td>
          <td className="border border-slate-300 px-3 py-2 text-right font-mono">{fmt.format(totalCr)}</td>
        </tr></tfoot>
      </table>
      {Math.abs(diff) > 0.01 && (
        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <i className="fas fa-exclamation-triangle" /> Trial balance differs by {fmt.format(Math.abs(diff))}
          ({diff > 0 ? 'debit' : 'credit'} side is higher). Check adjustment entries.
        </div>
      )}
    </div>
  );
}
function FragmentRows({ g }) {
  return (
    <>
      <tr className="bg-slate-100">
        <td className="border border-slate-200 px-3 py-2 font-bold text-xs uppercase tracking-wide text-slate-700">{g.group} <span className="font-normal text-slate-400">({g.type})</span></td>
        <td className="border border-slate-200 px-3 py-2 text-right font-bold font-mono">{g.dr ? fmt.format(g.dr) : ''}</td>
        <td className="border border-slate-200 px-3 py-2 text-right font-bold font-mono">{g.cr ? fmt.format(g.cr) : ''}</td>
      </tr>
      {g.rows.map((r, i) => (
        <tr key={i} className="bg-white">
          <td className="border border-slate-200 px-3 py-1.5 pl-7 text-slate-600">{r.name}{r.accNo ? <span className="text-xs text-slate-400"> ({r.accNo})</span> : null}</td>
          <td className="border border-slate-200 px-3 py-1.5 text-right font-mono text-xs">{r.dr ? fmt.format(r.dr) : ''}</td>
          <td className="border border-slate-200 px-3 py-1.5 text-right font-mono text-xs">{r.cr ? fmt.format(r.cr) : ''}</td>
        </tr>
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. LOAN AGEING / OVERDUE (NPA)
══════════════════════════════════════════════════════════════════════════ */
function LoanAgeingReport() {
  const today = dateNow();
  const { data, loading } = useAsync(() => Promise.all([
    api.get('/accounts?status=active&category=customer'), api.get('/groups'),
  ]).then(([a, g]) => classify(a.data, g.data).loans.filter(l => l.balance > 0.01)), []);
  if (loading) return <PageLoader />;
  const loans = (data || []).map(l => {
    const days = overdueDays(l.maturityDate, today);
    return { ...l, days, bucket: bucketOf(days) };
  });
  if (!loans.length) return <Empty text="No outstanding loans" />;

  const total = sum(loans, l => l.balance);
  const summary = AGEING_BUCKETS.map(b => {
    const list = loans.filter(l => l.bucket.key === b.key);
    return { ...b, count: list.length, amt: sum(list, l => l.balance) };
  });
  const overdue = loans.filter(l => l.days > 0);
  const npa = loans.filter(l => l.bucket.key === 'npa');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Outstanding" value={fmt.format(total)} />
        <Stat label="Overdue Amount" value={fmt.format(sum(overdue, l => l.balance))} tone="text-amber-600" />
        <Stat label="NPA (90+ days)" value={fmt.format(sum(npa, l => l.balance))} tone="text-red-600" />
        <Stat label="NPA %" value={`${total ? ((sum(npa, l => l.balance) / total) * 100).toFixed(1) : '0.0'}%`} tone="text-red-600" />
      </div>

      <RTable
        heads={[{ label: 'Ageing (days past maturity)' }, { label: 'Loans', right: true }, { label: 'Outstanding', right: true }, { label: '% of Total', right: true }]}
        rows={summary.map(b => [b.label, b.count, fmt.format(b.amt), `${total ? ((b.amt / total) * 100).toFixed(1) : '0.0'}%`])}
        foot={['Total', loans.length, fmt.format(total), '100%']}
      />

      <div>
        <SectionBar>Loan wise details (most overdue first)</SectionBar>
        <RTable
          heads={[{ label: 'Acc No' }, { label: 'Customer' }, { label: 'Type' }, { label: 'Maturity' }, { label: 'Days Overdue', right: true }, { label: 'Status' }, { label: 'Outstanding', right: true }]}
          rows={[...loans].sort((a, b) => b.days - a.days).map(l => [
            <span className="font-mono text-xs">{l.accNo}</span>, custName(l), l.type,
            l.maturityDate ? dateDisp(l.maturityDate) : '—', l.days || '—',
            <span className={l.bucket.key === 'npa' ? 'text-red-600 font-semibold' : l.days ? 'text-amber-600 font-semibold' : 'text-emerald-700'}>{l.bucket.key === 'npa' ? 'NPA' : l.days ? 'Overdue' : 'Regular'}</span>,
            fmt.format(l.balance),
          ])}
          foot={['', '', '', '', '', 'Total', fmt.format(total)]}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. DEPOSIT MATURITY
══════════════════════════════════════════════════════════════════════════ */
function DepositMaturityReport({ from, to }) {
  const today = dateNow();
  const { data, loading } = useAsync(() => Promise.all([
    api.get('/accounts?status=active&category=customer'), api.get('/groups'),
  ]).then(([a, g]) => classify(a.data, g.data).deposits.filter(d => d.maturityDate && d.balance > 0.01)), []);
  if (loading) return <PageLoader />;

  let list = (data || []).map(d => ({ ...d, left: daysBetween(today, String(d.maturityDate).slice(0, 10)) }));
  if (from) list = list.filter(d => d.maturityDate >= from);
  if (to)   list = list.filter(d => d.maturityDate <= to);
  list.sort((a, b) => String(a.maturityDate).localeCompare(String(b.maturityDate)));
  if (!list.length) return <Empty text="No deposits found for this period" />;

  const status = d => d.left < 0 ? ['Matured', 'text-red-600'] : d.left <= 7 ? ['Due in 7 days', 'text-amber-600'] : d.left <= 30 ? ['Due in 30 days', 'text-blue-600'] : ['Running', 'text-emerald-700'];
  const matured = list.filter(d => d.left < 0), soon = list.filter(d => d.left >= 0 && d.left <= 30);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Matured / Overdue" value={fmt.format(sum(matured, d => d.balance))} tone="text-red-600" />
        <Stat label="Due in 30 days" value={fmt.format(sum(soon, d => d.balance))} tone="text-amber-600" />
        <Stat label="Total Listed" value={fmt.format(sum(list, d => d.balance))} />
      </div>
      <RTable
        heads={[{ label: 'Acc No' }, { label: 'Customer' }, { label: 'Type' }, { label: 'Opened' }, { label: 'Maturity' }, { label: 'Days Left', right: true }, { label: 'Status' }, { label: 'Balance', right: true }]}
        rows={list.map(d => {
          const [txt, cls] = status(d);
          return [<span className="font-mono text-xs">{d.accNo}</span>, custName(d), d.type, dateDisp(d.opDate), dateDisp(d.maturityDate),
            d.left < 0 ? `${-d.left} ago` : d.left, <span className={`${cls} font-semibold`}>{txt}</span>, fmt.format(d.balance)];
        })}
        foot={['', '', '', '', '', '', `Total (${list.length})`, fmt.format(sum(list, d => d.balance))]}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. CASH / BANK BOOK
══════════════════════════════════════════════════════════════════════════ */
function CashBookReport({ from, to }) {
  const [accId, setAccId] = useState('');
  const { data: base, loading: l1 } = useAsync(() => Promise.all([
    api.get('/accounts?category=ledger'), api.get('/groups'),
  ]).then(([a, g]) => {
    const gt = {}; g.data.forEach(x => { gt[x.name] = x.type; });
    const cashBank = a.data.filter(x => x.type === 'cash' || x.type === 'bank' || x.group === 'Cash' || x.group === 'Bank');
    return { accounts: cashBank, gt };
  }), []);

  useEffect(() => {
    if (base && !accId && base.accounts.length) setAccId((base.accounts.find(a => a.type === 'cash') || base.accounts[0])._id);
  }, [base, accId]);

  const { data, loading } = useAsync(() => (accId
    ? api.get(`/transactions?accId=${accId}&limit=99999`).then(r => r.data)
    : Promise.resolve([])), [accId]);

  if (l1) return <PageLoader />;
  if (!base || !base.accounts.length) return <Empty text="No cash / bank accounts found" />;
  const acc = base.accounts.find(a => a._id === accId);
  const gType = base.gt[acc?.group] || 'Asset';

  const txs = [...(data || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt)));
  let opening = 0;
  const rows = [];
  txs.forEach(t => {
    const imp = accountImpact(t, accId, gType);
    if (!imp) return;
    if (from && t.date < from) { opening += imp; return; }
    if (to && t.date > to) return;
    rows.push({ t, imp });
  });
  let bal = opening, rec = 0, pay = 0;
  const body = rows.map(({ t, imp }) => {
    bal += imp;
    if (imp > 0) rec += imp; else pay += -imp;
    const other = (t.accId && t.accId._id === accId) ? t.secAccId : t.accId;
    return [dateDisp(t.date),
      <span>{other?.name || '—'}{t.desc ? <span className="text-xs text-slate-400"> · {t.desc}</span> : <span className="text-xs text-slate-400"> · {TYPE_LABEL[t.type] || t.type}</span>}</span>,
      imp > 0 ? <span className="text-emerald-700">{fmt.format(imp)}</span> : '', imp < 0 ? <span className="text-red-600">{fmt.format(-imp)}</span> : '', fmt.format(bal)];
  });

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs font-semibold text-slate-500">Account</label>
        <select className="select w-auto text-sm" value={accId} onChange={e => setAccId(e.target.value)}>
          {base.accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>
      <div className="text-sm font-bold text-slate-700 mb-2">{acc?.name} <span className="font-normal text-slate-400">— current balance {fmt.format(acc?.balance || 0)}</span></div>
      {loading ? <PageLoader /> : (
        <RTable
          heads={[{ label: 'Date' }, { label: 'Particulars' }, { label: 'Receipt', right: true }, { label: 'Payment', right: true }, { label: 'Balance', right: true }]}
          rows={[['', <b>Opening Balance</b>, '', '', <b>{fmt.format(opening)}</b>], ...body]}
          foot={['', 'Closing Balance', fmt.format(rec), fmt.format(pay), fmt.format(bal)]}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. CUSTOMER STATEMENT (all accounts of one customer, with running balance)
══════════════════════════════════════════════════════════════════════════ */
function CustomerStatementReport({ from, to }) {
  const [custId, setCustId] = useState('');
  const { data: customers, loading: l1 } = useAsync(() => api.get('/customers').then(r => r.data), []);
  const { data, loading } = useAsync(() => {
    if (!custId) return Promise.resolve(null);
    return Promise.all([api.get(`/accounts?custId=${custId}`), api.get('/groups')]).then(async ([ar, gr]) => {
      const gt = {}; gr.data.forEach(g => { gt[g.name] = g.type; });
      const accounts = ar.data;
      const lists = await Promise.all(accounts.map(a => api.get(`/transactions?accId=${a._id}&limit=99999`).then(r => r.data)));
      return accounts.map((a, i) => ({ account: a, gType: gt[a.group] || 'Asset', txs: lists[i] }));
    });
  }, [custId]);

  if (l1) return <PageLoader />;
  const cust = (customers || []).find(c => c._id === custId);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs font-semibold text-slate-500">Customer</label>
        <select className="select w-auto min-w-[220px] text-sm" value={custId} onChange={e => setCustId(e.target.value)}>
          <option value="">— Select customer —</option>
          {(customers || []).map(c => <option key={c._id} value={c._id}>{c.custNo} — {c.name}</option>)}
        </select>
      </div>
      {!custId && <Empty text="Select a customer to view the statement" />}
      {custId && loading && <PageLoader />}
      {custId && !loading && data && (
        <div className="space-y-5">
          {cust && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-sm">
              {[['Customer', cust.name], ['Customer ID', cust.custNo], ['Mobile', cust.mobile || '—'], ['Address', cust.address || '—']].map(([k, v]) => (
                <div key={k}><div className="text-xs text-slate-400 font-medium">{k}</div><div className="font-bold text-slate-800 mt-0.5 break-words">{v}</div></div>
              ))}
            </div>
          )}
          {data.length === 0 && <Empty text="This customer has no accounts" />}
          {data.map(({ account, gType, txs }) => (
            <StatementBlock key={account._id} account={account} gType={gType} txs={txs} from={from} to={to} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatementBlock({ account, gType, txs, from, to }) {
  const debitNature = gType === 'Asset' || gType === 'Expense';
  const sorted = [...txs].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt)));
  let opening = 0;
  const rows = [];
  sorted.forEach(t => {
    const imp = accountImpact(t, account._id, gType);
    if (!imp) return;
    if (from && t.date < from) { opening += imp; return; }
    if (to && t.date > to) return;
    rows.push({ t, imp });
  });
  let bal = opening, dr = 0, cr = 0;
  const body = rows.map(({ t, imp }) => {
    bal += imp;
    const isDr = debitNature ? imp > 0 : imp < 0;
    const amt = Math.abs(imp);
    if (isDr) dr += amt; else cr += amt;
    return [dateDisp(t.date), t.desc || TYPE_LABEL[t.type] || t.type, isDr ? fmt.format(amt) : '', !isDr ? fmt.format(amt) : '', fmt.format(bal)];
  });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between bg-slate-700 text-white text-sm font-bold px-3 py-2">
        <span>{account.accNo} — {account.type}</span>
        <span className="text-xs font-normal opacity-90">
          {account.roi ? `ROI ${account.roi}%  ` : ''}{account.maturityDate ? `Maturity ${dateDisp(account.maturityDate)}  ` : ''}Status: {account.status}
        </span>
      </div>
      <RTable
        heads={[{ label: 'Date' }, { label: 'Narration' }, { label: 'Debit', right: true }, { label: 'Credit', right: true }, { label: 'Balance', right: true }]}
        rows={[['', <b>Opening Balance</b>, '', '', <b>{fmt.format(opening)}</b>], ...body]}
        foot={['', 'Closing Balance', fmt.format(dr), fmt.format(cr), fmt.format(bal)]}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. TOP DEPOSITORS & BORROWERS
══════════════════════════════════════════════════════════════════════════ */
function TopCustomersReport() {
  const { data, loading } = useAsync(() => Promise.all([
    api.get('/accounts?status=active&category=customer'), api.get('/groups'),
  ]).then(([a, g]) => {
    const { deposits } = classify(a.data, g.data);
    // borrowers: use the group type directly (a loan may not have ROI / period filled in)
    const gt = {}; g.data.forEach(x => { gt[x.name] = x.type; });
    const allLoans = a.data.filter(x => x.category === 'customer' && gt[x.group] === 'Asset');
    const agg = list => {
      const m = {};
      list.forEach(x => {
        if (x.balance <= 0.01) return;
        const id = x.custId?._id || x.custId || x._id;
        m[id] = m[id] || { name: custName(x), custNo: x.custId?.custNo || '', count: 0, amt: 0 };
        m[id].count++; m[id].amt += x.balance;
      });
      return Object.values(m).sort((p, q) => q.amt - p.amt);
    };
    return { dep: agg(deposits), loan: agg(allLoans) };
  }), []);
  if (loading) return <PageLoader />;
  if (!data) return null;
  const block = (title, list, color) => {
    const total = sum(list, x => x.amt);
    const top = list.slice(0, 10);
    const topTotal = sum(top, x => x.amt);
    return (
      <div>
        <SectionBar color={color}>{title}</SectionBar>
        {top.length === 0 ? <Empty text="No data" /> : (
          <RTable
            heads={[{ label: '#' }, { label: 'Customer' }, { label: 'ID' }, { label: 'Accounts', right: true }, { label: 'Amount', right: true }, { label: '% of Total', right: true }]}
            rows={top.map((x, i) => [i + 1, x.name, <span className="font-mono text-xs">{x.custNo}</span>, x.count, fmt.format(x.amt), `${total ? ((x.amt / total) * 100).toFixed(1) : 0}%`])}
            foot={['', 'Top 10 total', '', '', fmt.format(topTotal), `${total ? ((topTotal / total) * 100).toFixed(1) : 0}%`]}
          />
        )}
      </div>
    );
  };
  return (
    <div className="space-y-6">
      {block('Top 10 Depositors', data.dep, 'bg-emerald-700')}
      {block('Top 10 Borrowers', data.loan, 'bg-red-500')}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   7. COLLECTION SUMMARY
══════════════════════════════════════════════════════════════════════════ */
function CollectionSummaryReport({ from, to }) {
  const now = new Date();
  const start = from || ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = to || dateNow();
  const { data, loading } = useAsync(() =>
    api.get(`/transactions?limit=99999&from=${start}&to=${end}`).then(r =>
      r.data.filter(t => ['deposit', 'repay_princ', 'income'].includes(t.type))), [start, end]);
  if (loading) return <PageLoader />;
  const txs = data || [];
  if (!txs.length) return <Empty text={`No collections between ${dateDisp(start)} and ${dateDisp(end)}`} />;

  const byDate = {}, byType = {}, byWho = {};
  txs.forEach(t => {
    const d = (byDate[t.date] = byDate[t.date] || { n: 0, deposit: 0, repay_princ: 0, income: 0 });
    d.n++; d[t.type] += t.amt;
    const ty = t.accId?.type || 'General';
    (byType[ty] = byType[ty] || { n: 0, amt: 0 }); byType[ty].n++; byType[ty].amt += t.amt;
    const who = t.by === 'agent' ? (t.agentId?.username || 'Agent') : 'Office / Admin';
    (byWho[who] = byWho[who] || { n: 0, amt: 0 }); byWho[who].n++; byWho[who].amt += t.amt;
  });
  const dates = Object.keys(byDate).sort();
  const total = sum(txs, t => t.amt);
  const totals = { deposit: sum(txs.filter(t => t.type === 'deposit'), t => t.amt), repay: sum(txs.filter(t => t.type === 'repay_princ'), t => t.amt), income: sum(txs.filter(t => t.type === 'income'), t => t.amt) };

  return (
    <div className="space-y-5">
      <div className="text-xs text-slate-500">Period: {dateDisp(start)} to {dateDisp(end)} &nbsp;•&nbsp; {txs.length} receipts</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Collection" value={fmt.format(total)} tone="text-emerald-700" />
        <Stat label="Deposits" value={fmt.format(totals.deposit)} />
        <Stat label="Loan Recovery" value={fmt.format(totals.repay)} />
        <Stat label="Other Income" value={fmt.format(totals.income)} />
      </div>
      <div>
        <SectionBar>Day wise</SectionBar>
        <RTable
          heads={[{ label: 'Date' }, { label: 'Receipts', right: true }, { label: 'Deposits', right: true }, { label: 'Loan Recovery', right: true }, { label: 'Income', right: true }, { label: 'Total', right: true }]}
          rows={dates.map(d => { const x = byDate[d]; return [dateDisp(d), x.n, fmt.format(x.deposit), fmt.format(x.repay_princ), fmt.format(x.income), <b>{fmt.format(x.deposit + x.repay_princ + x.income)}</b>]; })}
          foot={['Total', txs.length, fmt.format(totals.deposit), fmt.format(totals.repay), fmt.format(totals.income), fmt.format(total)]}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <SectionBar color="bg-indigo-600">By account type</SectionBar>
          <RTable heads={[{ label: 'Type' }, { label: 'Receipts', right: true }, { label: 'Amount', right: true }]}
            rows={Object.entries(byType).sort((a, b) => b[1].amt - a[1].amt).map(([k, v]) => [k, v.n, fmt.format(v.amt)])}
            foot={['Total', txs.length, fmt.format(total)]} />
        </div>
        <div>
          <SectionBar color="bg-indigo-600">By collector</SectionBar>
          <RTable heads={[{ label: 'Collected by' }, { label: 'Receipts', right: true }, { label: 'Amount', right: true }]}
            rows={Object.entries(byWho).sort((a, b) => b[1].amt - a[1].amt).map(([k, v]) => [k, v.n, fmt.format(v.amt)])}
            foot={['Total', txs.length, fmt.format(total)]} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   8. EMI CALCULATOR & LOAN SCHEDULE
══════════════════════════════════════════════════════════════════════════ */
function EmiCalculator() {
  const [f, setF] = useState({ principal: '', rate: '', period: '', periodType: 'months', method: 'reducing', startDate: dateNow() });
  const [loanId, setLoanId] = useState('');
  const { data: loans } = useAsync(() => Promise.all([
    api.get('/accounts?status=active&category=customer'), api.get('/groups'),
  ]).then(([a, g]) => classify(a.data, g.data).loans), []);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const load = id => {
    setLoanId(id);
    const l = (loans || []).find(x => x._id === id);
    if (!l) return;
    setF(p => ({
      ...p, principal: String(l.balance || ''), rate: String(l.roi ?? ''), period: String(l.period ?? ''),
      periodType: l.periodType || 'months', method: l.emiMethod || 'reducing', startDate: l.opDate || p.startDate,
    }));
  };

  const s = buildSchedule(f);
  const ready = s.rows.length > 0;
  return (
    <div className="space-y-5">
      <div className="no-print grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-2 sm:col-span-3">
          <label className="label">Load from a loan account (optional)</label>
          <select className="select" value={loanId} onChange={e => load(e.target.value)}>
            <option value="">— Enter manually —</option>
            {(loans || []).map(l => <option key={l._id} value={l._id}>{l.accNo} — {custName(l)} ({fmt.format(l.balance)})</option>)}
          </select>
        </div>
        <div><label className="label">Loan Amount (₹)</label><input type="number" min="0" className="input" value={f.principal} onChange={e => set('principal', e.target.value)} placeholder="100000" /></div>
        <div><label className="label">Interest % per year</label><input type="number" min="0" step="0.01" className="input" value={f.rate} onChange={e => set('rate', e.target.value)} placeholder="12" /></div>
        <div>
          <label className="label">Period</label>
          <div className="flex gap-1.5">
            <input type="number" min="1" className="input" value={f.period} onChange={e => set('period', e.target.value)} placeholder="12" />
            <select className="select w-28" value={f.periodType} onChange={e => set('periodType', e.target.value)}>
              <option value="months">Months</option><option value="years">Years</option><option value="days">Days</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Interest method</label>
          <select className="select" value={f.method} onChange={e => set('method', e.target.value)}>
            <option value="reducing">Reducing balance</option><option value="fixed">Fixed (flat)</option>
          </select>
        </div>
        <div><label className="label">First instalment after</label><input type="date" className="input" value={f.startDate} onChange={e => set('startDate', e.target.value)} /></div>
      </div>

      {!ready ? <Empty text="Enter amount, interest and period to see the instalment schedule" /> : (
        <>
          <div className="text-xs text-slate-500">
            Loan {fmt.format(Number(f.principal))} @ {f.rate || 0}% p.a. for {f.period} {f.periodType}
            ({periodInMonths(f.period, f.periodType)} monthly instalments) — {f.method === 'fixed' ? 'Fixed (flat)' : 'Reducing balance'} — starting {dateDisp(f.startDate)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Monthly EMI" value={fmt.format(s.emi)} tone="text-blue-700" />
            <Stat label="Total Interest" value={fmt.format(s.totalInterest)} tone="text-amber-600" />
            <Stat label="Total Payable" value={fmt.format(s.totalPayable)} />
            <Stat label="Instalments" value={s.months} />
          </div>
          <RTable
            heads={[{ label: 'No' }, { label: 'Due Date' }, { label: 'EMI', right: true }, { label: 'Principal', right: true }, { label: 'Interest', right: true }, { label: 'Balance', right: true }]}
            rows={s.rows.map(r => [r.no, dateDisp(r.date), fmt.format(r.emi), fmt.format(r.principal), fmt.format(r.interest), fmt.format(r.balance)])}
            foot={['', 'Total', fmt.format(s.totalPayable), fmt.format(sum(s.rows, r => r.principal)), fmt.format(s.totalInterest), '']}
          />
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   exports used by ReportsPage
══════════════════════════════════════════════════════════════════════════ */
export const MORE_REPORT_CARDS = [
  { id: 'trial_bal',    label: 'Trial Balance',        icon: 'fa-list-check',           color: 'text-teal-600 bg-teal-50',     roles: ['admin'] },
  { id: 'cashbook',     label: 'Cash / Bank Book',     icon: 'fa-book-open',            color: 'text-sky-600 bg-sky-50',       roles: ['admin'] },
  { id: 'cust_stmt',    label: 'Customer Statement',   icon: 'fa-file-lines',           color: 'text-indigo-600 bg-indigo-50', roles: ['admin'] },
  { id: 'loan_ageing',  label: 'Loan Ageing / NPA',    icon: 'fa-triangle-exclamation', color: 'text-red-600 bg-red-50',       roles: ['admin'], landscape: true },
  { id: 'dep_maturity', label: 'Deposit Maturity',     icon: 'fa-hourglass-half',       color: 'text-amber-600 bg-amber-50',   roles: ['admin'], landscape: true },
  { id: 'collection',   label: 'Collection Summary',   icon: 'fa-hand-holding-dollar',  color: 'text-emerald-600 bg-emerald-50', roles: ['admin'] },
  { id: 'top_cust',     label: 'Top Depositors & Borrowers', icon: 'fa-trophy',         color: 'text-purple-600 bg-purple-50', roles: ['admin'] },
  { id: 'emi_calc',     label: 'EMI Calculator',       icon: 'fa-calculator',           color: 'text-blue-600 bg-blue-50',     roles: ['admin'] },
];

export function MoreReportView({ id, from, to }) {
  switch (id) {
    case 'trial_bal':    return <TrialBalanceReport />;
    case 'cashbook':     return <CashBookReport from={from} to={to} />;
    case 'cust_stmt':    return <CustomerStatementReport from={from} to={to} />;
    case 'loan_ageing':  return <LoanAgeingReport />;
    case 'dep_maturity': return <DepositMaturityReport from={from} to={to} />;
    case 'collection':   return <CollectionSummaryReport from={from} to={to} />;
    case 'top_cust':     return <TopCustomersReport />;
    case 'emi_calc':     return <EmiCalculator />;
    default:             return null;
  }
}
