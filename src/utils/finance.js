/* ─────────────────────────────────────────────────────────────────────────────
   Pure finance / data helpers (no React) — used by reports, CSV import, EMI tool
───────────────────────────────────────────────────────────────────────────── */

/* ── Dates ───────────────────────────────────────────────────────────────── */
export const ymd = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

export function addMonths(dateStr, n) {
  const [y, m, d] = (dateStr || ymd(new Date())).split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));          // 31 Jan + 1 month = 28/29 Feb
  return ymd(target);
}

export function daysBetween(fromStr, toStr) {      // toStr - fromStr in whole days
  const a = new Date(fromStr + 'T00:00:00'), b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */
// Reads CSV text → array of rows (array of cells). Handles quotes, "" escapes,
// commas/line-breaks inside quotes, Windows/Mac line ends, BOM, and ; or TAB files.
export function parseCSV(text) {
  let s = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = s.split(/\r\n|\n|\r/)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of firstLine) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const sep = counts[delim] > 0 ? delim : ',';

  const rows = [];
  let row = [], cell = '', inQ = false;
  let line = 1, rowStart = 1;          // real line number in the file (blank lines count)
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else { if (ch === '\n') line++; cell += ch; }
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); row.line = rowStart; rows.push(row);
      row = []; cell = ''; line++; rowStart = line;
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); row.line = rowStart; rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

const norm = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  name:    ['name', 'customername', 'customer', 'fullname', 'partyname', 'holdername', 'accountholder'],
  mobile:  ['mobile', 'mobileno', 'mobilenumber', 'phone', 'phoneno', 'phonenumber', 'contact', 'contactno', 'cell', 'whatsapp'],
  address: ['address', 'addr', 'fulladdress', 'location', 'city', 'village'],
};

// CSV text → { rows:[{row,name,mobile,address}], hasHeader }
// `row` is the line number in the file (1 = first line) so error messages match Excel.
export function customersFromCSV(text) {
  const table = parseCSV(text);
  if (!table.length) return { rows: [], hasHeader: false };

  const head = table[0].map(norm);
  const idx = {};
  Object.keys(ALIASES).forEach(k => { idx[k] = head.findIndex(h => ALIASES[k].includes(h)); });
  const hasHeader = idx.name >= 0;
  if (!hasHeader) { idx.name = 0; idx.mobile = 1; idx.address = 2; }   // no header → name, mobile, address

  const get = (r, i) => (i >= 0 && i < r.length ? String(r[i]).trim() : '');
  const rows = [];
  table.slice(hasHeader ? 1 : 0).forEach((r, i) => {
    rows.push({
      row: r.line || i + (hasHeader ? 2 : 1),
      name: get(r, idx.name).replace(/\s+/g, ' '),
      mobile: get(r, idx.mobile),
      address: get(r, idx.address),
    });
  });
  return { rows, hasHeader };
}

export const CUSTOMER_CSV_TEMPLATE =
  'Name,Mobile,Address\r\nRavi Kumar,9876543210,"12 Main Road, Pune"\r\nSita Devi,9123456780,Nashik\r\n';

/* ── Loans: EMI + schedule ───────────────────────────────────────────────── */
export function periodInMonths(period, periodType) {
  const p = Number(period) || 0;
  if (periodType === 'years') return Math.round(p * 12);
  if (periodType === 'days')  return Math.max(1, Math.ceil(p / 30));
  return Math.round(p);
}

const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * method 'reducing' → interest on the remaining balance (standard EMI formula)
 * method 'fixed'    → flat interest on the original amount for the whole period
 * rate = % per year, monthly instalments
 */
export function buildSchedule({ principal, rate, period, periodType = 'months', method = 'reducing', startDate }) {
  const P = Number(principal) || 0;
  const R = Number(rate) || 0;
  const n = periodInMonths(period, periodType);
  if (P <= 0 || n <= 0) return { emi: 0, totalInterest: 0, totalPayable: 0, months: n, rows: [] };

  const start = startDate || ymd(new Date());
  const rows = [];
  let balance = P, totalInterest = 0, emi;

  if (method === 'fixed') {
    const interestTotal = P * (R / 100) * (n / 12);
    emi = (P + interestTotal) / n;
    for (let i = 1; i <= n; i++) {
      const principalPart = i === n ? balance : r2(P / n);
      const interest = i === n ? r2(interestTotal - totalInterest) : r2(interestTotal / n);
      balance = r2(balance - principalPart);
      totalInterest = r2(totalInterest + interest);
      rows.push({ no: i, date: addMonths(start, i), emi: r2(principalPart + interest), principal: principalPart, interest, balance: Math.max(0, balance) });
    }
  } else {
    const r = R / 12 / 100;
    emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    emi = r2(emi);
    for (let i = 1; i <= n; i++) {
      const interest = r2(balance * r);
      let principalPart = r2(emi - interest);
      if (i === n || principalPart > balance) principalPart = balance;   // last instalment clears the loan
      balance = r2(balance - principalPart);
      totalInterest = r2(totalInterest + interest);
      rows.push({ no: i, date: addMonths(start, i), emi: r2(principalPart + interest), principal: principalPart, interest, balance: Math.max(0, balance) });
    }
  }
  const totalPayable = r2(rows.reduce((s, x) => s + x.emi, 0));
  return { emi: r2(emi), totalInterest: r2(totalInterest), totalPayable, months: n, rows };
}

/* ── Ageing (overdue loans) ──────────────────────────────────────────────── */
export const AGEING_BUCKETS = [
  { key: 'current', label: 'Not Due',          min: -Infinity, max: 0 },
  { key: 'b30',     label: '1 – 30 days',      min: 1,  max: 30 },
  { key: 'b60',     label: '31 – 60 days',     min: 31, max: 60 },
  { key: 'b90',     label: '61 – 90 days',     min: 61, max: 90 },
  { key: 'npa',     label: 'Above 90 days (NPA)', min: 91, max: Infinity },
];

export function overdueDays(maturityDate, today) {
  if (!maturityDate) return 0;
  return Math.max(0, daysBetween(String(maturityDate).slice(0, 10), today));
}

export function bucketOf(days) {
  return AGEING_BUCKETS.find(b => days >= b.min && days <= b.max) || AGEING_BUCKETS[0];
}

/* ── Account classification (same rule the backend uses) ─────────────────── */
export function classify(accounts, groups) {
  const gt = {};
  groups.forEach(g => { gt[g.name] = g.type; });
  const cust = accounts.filter(a => a.category === 'customer');
  return {
    loans:    cust.filter(a => gt[a.group] === 'Asset' && a.roi != null && a.period),
    deposits: cust.filter(a => gt[a.group] === 'Liability'),
    groupType: gt,
  };
}

/* ── Trial balance ───────────────────────────────────────────────────────── */
// Assets & Expenses carry a DEBIT balance, Liabilities / Income / Equity a CREDIT balance.
export function trialBalance(accounts, groups, agentCash = 0) {
  const gt = {};
  groups.forEach(g => { gt[g.name] = g.type; });
  const rows = [];
  accounts.forEach(a => {
    const type = gt[a.group] || 'Asset';
    const debitNature = type === 'Asset' || type === 'Expense';
    const bal = a.balance || 0;
    if (Math.abs(bal) < 0.005) return;
    const dr = debitNature ? (bal >= 0 ? bal : 0) : (bal < 0 ? -bal : 0);
    const cr = debitNature ? (bal < 0 ? -bal : 0) : (bal >= 0 ? bal : 0);
    rows.push({ group: a.group, type, name: a.name, accNo: a.accNo, dr, cr });
  });
  if (agentCash > 0.005) rows.push({ group: 'Cash', type: 'Asset', name: 'Cash with Agents', accNo: '', dr: agentCash, cr: 0 });

  const byGroup = {};
  rows.forEach(r => { (byGroup[r.group] = byGroup[r.group] || { group: r.group, type: r.type, rows: [], dr: 0, cr: 0 }); const g = byGroup[r.group]; g.rows.push(r); g.dr += r.dr; g.cr += r.cr; });
  const order = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
  const groupsOut = Object.values(byGroup).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.group.localeCompare(b.group));
  const totalDr = rows.reduce((s, r) => s + r.dr, 0);
  const totalCr = rows.reduce((s, r) => s + r.cr, 0);
  return { groups: groupsOut, totalDr, totalCr, diff: totalDr - totalCr };
}

/* ── Account movement (used by statements / cash book) ───────────────────── */
export const isIncoming = t => ['deposit', 'repay_princ', 'income', 'agent_handover'].includes(t);

// Effect of ONE transaction on ONE account's balance. Mirrors the server's rules.
export function accountImpact(tx, accountId, groupType) {
  const id = x => (x && x._id) || x;
  const isPrimary = id(tx.accId) === accountId;
  const isSecondary = id(tx.secAccId) === accountId;
  const debitNature = groupType === 'Asset' || groupType === 'Expense';
  const amt = tx.amt || 0;

  if (tx.type === 'adjustment') {
    if (isPrimary)   return debitNature ? amt : -amt;
    if (isSecondary) return debitNature ? -amt : amt;
    return 0;
  }
  if (isPrimary) {
    const t = tx.type;
    if (debitNature) {
      if (['disburse', 'withdraw', 'expense'].includes(t)) return amt;
      if (['deposit', 'repay_princ', 'income'].includes(t)) return -amt;
    } else if (groupType === 'Liability') {
      if (['deposit', 'repay_princ'].includes(t)) return amt;
      if (['withdraw', 'disburse'].includes(t)) return -amt;
    }
    return amt;
  }
  if (isSecondary) {
    if (tx.by === 'agent' && tx.type !== 'agent_handover') return 0;   // agent collections don't touch cash until handover
    return isIncoming(tx.type) ? amt : -amt;
  }
  return 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   ACCOUNT TERMS — interest / late fee / grace period / due day
   (the company's defaults come from Configuration; each account keeps its own copy in account.terms)
══════════════════════════════════════════════════════════════════════════ */
export const LATE_FEE_TYPES = [
  { value: 'none',    label: 'No late fee' },
  { value: 'flat',    label: 'Flat amount per overdue EMI' },
  { value: 'per_day', label: 'Amount per day overdue' },
  { value: 'percent', label: '% of EMI per month overdue' },
];
export const lateFeeText = t => {
  const type = t?.lateFeeType || 'none', fee = Number(t?.lateFee) || 0;
  if (type === 'none' || fee <= 0) return 'No late fee';
  if (type === 'flat') return `₹${fee} per overdue EMI`;
  if (type === 'per_day') return `₹${fee} per day`;
  return `${fee}% of EMI per month`;
};

// loan | deposit | pigmy | other  — by the group TYPE (Asset = loan, Liability = deposit), pigmy by name
export function accountCategory(account, groupTypeMap = {}) {
  if (!account || account.category === 'ledger') return 'other';
  if (/pigmy/i.test(account.type || '')) return 'pigmy';
  const gt = groupTypeMap[account.group];
  if (gt === 'Asset') return 'loan';
  if (gt === 'Liability') return 'deposit';
  const t = `${account.type || ''} ${account.group || ''}`.toLowerCase();
  if (t.includes('loan')) return 'loan';
  if (/deposit|saving|current|recurring|fixed|\b(fd|rd)\b/.test(t)) return 'deposit';
  return 'other';
}

const TERM_FIELDS = ['lateFeeType', 'lateFeeFrom', 'lateFee', 'graceDays', 'dueDay', 'processingFeePct', 'foreclosurePct', 'interestPayout', 'prematurePenaltyPct', 'minDailyAmount'];
// account's own terms first, company defaults for anything it does not have (older accounts)
export function termsFor(account, config, category) {
  const sec = (config && config[category]) || {};
  const base = {};
  TERM_FIELDS.forEach(k => { if (sec[k] !== undefined) base[k] = sec[k]; });
  return { ...base, ...((account && account.terms) || {}) };
}

// simple interest accrued on the current balance from the opening date
export function accruedInterest(account, asOf) {
  if (!account || !account.roi || !account.opDate) return 0;
  const principal = Math.abs(account.balance || 0);
  if (!principal) return 0;
  const days = Math.max(0, daysBetween(account.opDate, asOf || ymd(new Date())));
  return r2((principal * Number(account.roi) * days) / 36500);
}

// day-of-month helper: 2026-03-20 + day 5  →  2026-03-05 (clamped to month length)
function withDay(dateStr, day) {
  const [y, m] = dateStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * Which EMIs are overdue?  Uses the instalment schedule built from the loan's terms and compares
 * the principal repaid so far with the principal that should have been repaid by today.
 * needs account.stats (from GET /accounts/:id): { disbursed, firstDisburseDate }
 */
export function loanArrears(account, terms, asOf) {
  const st = (account && account.stats) || {};
  const principal = Number(st.disbursed) || 0;
  if (!principal || !account.period) return null;

  const sched = buildSchedule({
    principal, rate: Number(account.roi) || 0, period: account.period, periodType: account.periodType,
    method: account.emiMethod || 'reducing', startDate: st.firstDisburseDate || account.opDate,
  });
  if (!sched.rows.length) return null;

  const today = asOf || ymd(new Date());
  const dueDay = Number(terms?.dueDay) || 0;
  const rows = sched.rows.map(r => ({ ...r, date: dueDay ? withDay(r.date, dueDay) : r.date }));
  const paidPrincipal = principal - Math.max(0, Number(account.balance) || 0);

  let cum = 0;
  const unpaid = [];
  rows.forEach(r => {
    cum += r.principal;
    if (r.date <= today && cum > paidPrincipal + 0.5) {
      unpaid.push({ no: r.no, date: r.date, emi: r.emi, daysOverdue: daysBetween(r.date, today) });
    }
  });
  return {
    emi: sched.emi,
    totalInstalments: rows.length,
    unpaid,
    arrearsAmount: r2(unpaid.reduce((s, u) => s + u.emi, 0)),
    overdueDays: unpaid.length ? unpaid[0].daysOverdue : 0,
    nextDue: rows.find(r => r.date > today) || null,
  };
}

// late fee payable today for the overdue EMIs
export function lateFeeAmount(terms, arrears) {
  if (!terms || !arrears || !arrears.unpaid.length) return 0;
  const type = terms.lateFeeType || 'none';
  const fee = Number(terms.lateFee) || 0;
  const grace = Number(terms.graceDays) || 0;
  if (type === 'none' || fee <= 0) return 0;

  let total = 0;
  arrears.unpaid.forEach(u => {
    if (u.daysOverdue <= grace) return;                                   // still inside the grace period
    const days = terms.lateFeeFrom === 'due' ? u.daysOverdue : u.daysOverdue - grace;
    if (type === 'flat') total += fee;
    else if (type === 'per_day') total += fee * days;
    else if (type === 'percent') total += u.emi * (fee / 100) * (days / 30);
  });
  return r2(total);
}
