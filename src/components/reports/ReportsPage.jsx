import { useState, useEffect, useCallback } from 'react';
import api, { fmt, dateDisp, dateNow, getErrorMsg, agentLabel } from '../../utils/api';
import { printReport } from '../../utils/print';
import FitWidth from '../shared/FitWidth';
import { MORE_REPORT_CARDS, MoreReportView } from './MoreReports';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader, PageLoader, EmptyState, Modal } from '../shared';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const isIncoming = t => ['deposit','repay_princ','income','agent_handover'].includes(t);

function useFetch(fn, deps=[]) {
  const [data,setData]     = useState(null);
  const [loading,setLoading]= useState(true);
  const run = useCallback(async()=>{
    try { setLoading(true); const r=await fn(); setData(r); }
    catch {}
    finally { setLoading(false); }
  }, deps);
  useState(()=>{ run(); },[]);
  return { data, loading, reload:run };
}

/* ── Date Filter ─────────────────────────────────────────────────────────── */
function DateFilter({ from, to, onFrom, onTo, onClear }) {
  const quick = range => {
    const now = new Date();
    let f=new Date(), t=new Date();
    if (range==='today')  {}
    else if (range==='week') { f=new Date(now); f.setDate(now.getDate()-now.getDay()); }
    else if (range==='month'){ f=new Date(now.getFullYear(),now.getMonth(),1); t=new Date(now.getFullYear(),now.getMonth()+1,0); }
    else if (range==='3m')   { f=new Date(now.getFullYear(),now.getMonth()-2,1); }
    else if (range==='fy')   {
      const m=now.getMonth(), y=now.getFullYear();
      f=new Date(m>=3?y:y-1,3,1); t=new Date(m>=3?y+1:y,2,31);
    }
    const ymd=d=>new Date(d-d.getTimezoneOffset()*60000).toISOString().split('T')[0];
    onFrom(ymd(f)); onTo(ymd(t));
  };
  return (
    <div className="card mb-5 p-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Quick:</span>
        {[['today','Today'],['week','This Week'],['month','This Month'],['3m','3 Months'],['fy','Financial Year']].map(([k,l])=>(
          <button key={k} onClick={()=>quick(k)} className="btn btn-outline btn-sm">{l}</button>
        ))}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">From</span>
            <input type="date" className="input input-sm w-36 text-xs" value={from} onChange={e=>onFrom(e.target.value)}/>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">To</span>
            <input type="date" className="input input-sm w-36 text-xs" value={to} onChange={e=>onTo(e.target.value)}/>
          </div>
          {(from||to) && <button onClick={onClear} className="btn btn-secondary btn-sm"><i className="fas fa-times"/></button>}
        </div>
      </div>
    </div>
  );
}

/* ── Report Viewer wrapper ───────────────────────────────────────────────── */
// fit      → keep the desktop (side-by-side) layout on phones by scaling it down
// landscape→ print on a landscape page (wide tables)
function ReportViewer({ orgName, subtitle, dateRange, onBack, fit = false, landscape = false, children }) {
  const handlePrint = () => printReport({
    element: document.getElementById('report-print-area'),
    orgName, title: subtitle, period: dateRange,
    orientation: landscape ? 'landscape' : 'portrait',
  });

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <button onClick={onBack} className="btn btn-secondary btn-sm">
          <i className="fas fa-arrow-left"/> Back
        </button>
        <button onClick={handlePrint} className="btn btn-primary btn-sm">
          <i className="fas fa-print"/> Print / PDF
        </button>
        <span className="text-sm text-slate-500 truncate">{subtitle}</span>
      </div>
      <div id="report-print-area" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 sm:p-6">
        <div data-screen-header className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <div className="text-lg sm:text-xl font-bold text-slate-800 uppercase tracking-wide">{orgName}</div>
          <div className="text-base font-semibold text-slate-600 mt-1">{subtitle}</div>
          {dateRange && <div className="text-xs text-slate-400 mt-1">{dateRange}</div>}
        </div>
        {fit ? <FitWidth design={640} minScale={0.6}>{children}</FitWidth> : children}
      </div>
    </div>
  );
}

/* ── Reusable report table ───────────────────────────────────────────────── */
function RTable({ heads, rows, foot }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr>{heads.map((h,i)=><th key={i} className={`border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide ${h.right?'text-right':''}`}>{h.label}</th>)}</tr></thead>
      <tbody>{rows.map((r,ri)=>(
        <tr key={ri} className={ri%2===0?'bg-white':'bg-slate-50'}>
          {r.map((c,ci)=><td key={ci} className={`border border-slate-200 px-3 py-2 ${heads[ci]?.right?'text-right font-mono':''}`}>{c}</td>)}
        </tr>
      ))}</tbody>
      {foot && <tfoot><tr className="bg-blue-100 font-bold">{foot.map((c,i)=><td key={i} className={`border border-slate-300 px-3 py-2 ${heads[i]?.right?'text-right font-mono':''}`}>{c}</td>)}</tr></tfoot>}
    </table>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Individual Report Components
══════════════════════════════════════════════════════════════════════════ */

/* Customer List */
function CustListReport() {
  const { data:customers, loading } = useFetch(()=>api.get('/customers').then(r=>r.data));
  if (loading) return <PageLoader/>;
  return <RTable
    heads={[{label:'S.No'},{label:'ID'},{label:'Name'},{label:'Mobile'},{label:'Address'}]}
    rows={(customers||[]).map((c,i)=>[i+1, <span className="font-mono text-xs">{c.custNo}</span>, <span className="font-semibold">{c.name}</span>, c.mobile||'—', c.address||'—'])}
    foot={['','',`Total: ${(customers||[]).length} customers`,'','']}
  />;
}

/* Day Book */
function DayBookReport({ from }) {
  const target = from || dateNow();
  const { data:trans, loading } = useFetch(()=>api.get(`/transactions?from=${target}&to=${target}&limit=300`).then(r=>r.data.filter(t=>!(t.by==='agent'&&t.type!=='agent_handover'))));
  if (loading) return <PageLoader/>;
  let totalIn=0, totalOut=0;
  const rows = (trans||[]).map(t=>{
    const acc=t.accId, name=acc?.custId?.name||acc?.name||'—';
    const inc=isIncoming(t.type);
    if(inc) totalIn+=t.amt; else totalOut+=t.amt;
    return [dateDisp(t.date), <span className="font-medium">{name} {acc?.accNo&&<span className="text-xs text-slate-400">({acc.accNo})</span>}</span>, t.desc||t.type, inc?<span className="text-emerald-700 font-semibold">{fmt.format(t.amt)}</span>:'—', !inc?<span className="text-red-600 font-semibold">{fmt.format(t.amt)}</span>:'—'];
  });
  return <>
    {rows.length===0 && <div className="text-center py-8 text-slate-400">No transactions for {dateDisp(target)}</div>}
    <RTable heads={[{label:'Date'},{label:'Particulars'},{label:'Narration'},{label:'In (₹)',right:true},{label:'Out (₹)',right:true}]}
      rows={rows} foot={['','','Day Totals', fmt.format(totalIn), fmt.format(totalOut)]}/>
  </>;
}

/* Accounts Balance (by type) — supports optional type/group/customer filter */
/* Accounts Balance — filterType: single type string or '' for all */
function AccBalReport({ filterType='' }) {
  const { data:accounts, loading } = useFetch(()=>api.get('/accounts?status=active&category=customer').then(r=>r.data));
  if (loading) return <PageLoader/>;

  const filtered = filterType
    ? (accounts||[]).filter(a => a.type === filterType)
    : (accounts||[]);

  const byType = filtered.reduce((a,x)=>{ (a[x.type]=a[x.type]||[]).push(x); return a; },{});
  const grand  = filtered.reduce((s,a)=>s+a.balance, 0);

  if (filtered.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <i className="fas fa-filter text-3xl mb-3 block opacity-40"/>
      No accounts found for type: <strong>{filterType}</strong>
    </div>
  );

  return <>
    {/* Active filter badge */}
    {filterType && (
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
          <i className="fas fa-layer-group text-indigo-400"/> {filterType}
        </span>
      </div>
    )}
    {Object.entries(byType).map(([type,accs])=>{
      const sub=accs.reduce((s,a)=>s+a.balance,0);
      return <div key={type} className="mb-6">
        <div className="bg-slate-700 text-white text-sm font-bold px-3 py-2 rounded-t-lg uppercase tracking-wide">{type}</div>
        <RTable
          heads={[{label:'Acc No'},{label:'Customer'},{label:'Open Date'},{label:'Balance',right:true}]}
          rows={accs.map(a=>[<span className="font-mono text-xs">{a.accNo}</span>, a.custId?.name||a.name, dateDisp(a.opDate), <span className={a.balance<0?'text-red-600':'text-emerald-700'}>{fmt.format(a.balance)}</span>])}
          foot={['','',`Subtotal ${type}`, fmt.format(sub)]}
        />
      </div>;
    })}
    <div className={`mt-4 flex justify-between font-bold text-base p-4 rounded-xl border-2 ${grand>=0?'bg-emerald-50 border-emerald-300':'bg-red-50 border-red-300'}`}>
      <span>Grand Total Balance</span>
      <span className={`font-mono ${grand>=0?'text-emerald-700':'text-red-600'}`}>{fmt.format(grand)}</span>
    </div>
  </>;
}

/* Accounts Balance — Select Account Type modal (matches image design) */
function AccBalSelectModal({ onSelect, onClose }) {
  const [q, setQ] = useState('');
  const { data:accounts, loading } = useFetch(()=>
    api.get('/accounts?status=active&category=customer').then(r=>r.data)
  );

  // Unique sorted types from real data
  const allTypes = [...new Set((accounts||[]).map(a=>a.type).filter(Boolean))].sort();
  const filtered = allTypes.filter(t => !q || t.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="modal-body p-0">
      {/* Search */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"/>
          <input
            className="input pl-9 text-sm"
            placeholder="Search Type (e.g. Savings)..."
            value={q}
            onChange={e=>setQ(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* Type list */}
      <div className="overflow-y-auto max-h-72 divide-y divide-slate-100">
        {loading && (
          <div className="flex justify-center py-8">
            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {/* ALL ACCOUNTS row — always first */}
        {!loading && !q && (
          <button
            onClick={()=>onSelect({ filterType:'' })}
            className="w-full text-left px-5 py-3.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
          >
            <i className="fas fa-layer-group text-indigo-500"/>
            <span className="font-bold text-slate-800 text-sm tracking-wide uppercase">All Accounts</span>
          </button>
        )}

        {/* Individual type rows */}
        {!loading && filtered.map(t => (
          <button
            key={t}
            onClick={()=>onSelect({ filterType: t })}
            className="w-full text-left px-5 py-3.5 hover:bg-blue-50 transition-colors"
          >
            <span className="font-bold text-slate-700 text-sm tracking-wide uppercase">{t}</span>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">No types match "{q}"</div>
        )}
      </div>
    </div>
  );
}

/* Balance Book (customer-wise) */
function BalBookReport() {
  const { data:customers, loading:cl } = useFetch(()=>api.get('/customers').then(r=>r.data));
  const { data:accounts,  loading:al } = useFetch(()=>api.get('/accounts?status=active&category=customer').then(r=>r.data));
  if (cl||al) return <PageLoader/>;
  const grand = (accounts||[]).reduce((s,a)=>s+a.balance,0);
  return <>
    {(customers||[]).map(c=>{
      const accs=(accounts||[]).filter(a=>a.custId?._id===c._id||a.custId===c._id);
      if (!accs.length) return null;
      const total=accs.reduce((s,a)=>s+a.balance,0);
      return <div key={c._id} className="mb-4">
        <div className="flex items-center justify-between bg-blue-700 text-white text-sm font-bold px-3 py-2 rounded-t-lg">
          <span>{c.name.toUpperCase()} ({c.custNo})</span>
          <span className="font-mono">{fmt.format(total)}</span>
        </div>
        <RTable
          heads={[{label:'Acc No'},{label:'Type'},{label:'Open Date'},{label:'Balance',right:true}]}
          rows={accs.map(a=>[<span className="font-mono text-xs">{a.accNo}</span>, a.type, dateDisp(a.opDate), <span className={(a.group||'').toLowerCase().includes('loan')?'text-red-600 font-semibold':'text-emerald-700 font-semibold'}>{fmt.format(a.balance)}</span>])}
        />
      </div>;
    })}
    <div className="mt-4 flex justify-between font-bold text-base p-4 bg-blue-100 border-2 border-blue-300 rounded-xl">
      <span>Grand Total</span><span className="font-mono text-blue-800">{fmt.format(grand)}</span>
    </div>
  </>;
}

/* Loans */
function LoansReport() {
  const { data:accounts, loading } = useFetch(()=>api.get('/accounts?status=active').then(r=>r.data.filter(a=>a.category==='customer'&&((a.group||'').toLowerCase().includes('loan')||(a.type||'').toLowerCase().includes('loan'))&&a.balance>0)));
  if (loading) return <PageLoader/>;
  const total=(accounts||[]).reduce((s,a)=>s+a.balance,0);
  return <RTable
    heads={[{label:'Acc No'},{label:'Customer'},{label:'Type'},{label:'ROI %'},{label:'Maturity'},{label:'Outstanding',right:true}]}
    rows={(accounts||[]).map(a=>[
      <span className="font-mono text-xs">{a.accNo}</span>,
      a.custId?.name||a.name, a.type,
      a.roi?`${a.roi}%`:'—', dateDisp(a.maturityDate)||'—',
      <span className="text-red-600 font-bold">{fmt.format(a.balance)}</span>
    ])}
    foot={['','','','','Total Outstanding', fmt.format(total)]}
  />;
}

/* Ledger */
function LedgerReport({ accountId }) {
  const { data, loading } = useFetch(()=>Promise.all([api.get(`/accounts/${accountId}`),api.get(`/transactions?accId=${accountId}&limit=500`)]).then(([ar,tr])=>({ account:ar.data, trans:tr.data.filter(t=>t.accId?._id===accountId||t.secAccId?._id===accountId).sort((a,b)=>new Date(a.date)-new Date(b.date)) })));
  if (loading) return <PageLoader/>;
  if (!data) return null;
  const { account, trans } = data;
  let bal=0;
  const rows=trans.map(t=>{
    const isPrimary=t.accId?._id===accountId||t.accId===accountId;
    const inc=isIncoming(t.type);
    let impact=isPrimary?(inc?-t.amt:t.amt):(inc?t.amt:-t.amt);
    bal+=impact;
    return [dateDisp(t.date), t.desc||t.type, impact>0?fmt.format(impact):'—', impact<0?fmt.format(Math.abs(impact)):'—', <span className="font-semibold">{fmt.format(bal)}</span>];
  });
  return <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 p-4 bg-slate-50 rounded-xl text-sm">
      {[['Account',account.name],['Number',account.accNo||'—'],['Group',account.group],['Balance',fmt.format(account.balance)]].map(([k,v])=>(
        <div key={k}><div className="text-xs text-slate-400 font-medium">{k}</div><div className="font-bold text-slate-800 mt-0.5">{v}</div></div>
      ))}
    </div>
    <RTable heads={[{label:'Date'},{label:'Narration'},{label:'Debit',right:true},{label:'Credit',right:true},{label:'Balance',right:true}]}
      rows={rows} foot={['','','','Closing Balance', fmt.format(bal)]}/>
  </>;
}

/* P&L */
function PLReport({ from, to }) {
  const { data, loading } = useFetch(()=>Promise.all([api.get('/accounts'),api.get('/groups'),api.get(`/transactions?limit=9999${from?'&from='+from:''}${to?'&to='+to:''}`)]).then(([ar,gr,tr])=>{
    const accounts=ar.data, groups=gr.data, transactions=tr.data;
    const incGrps=groups.filter(g=>g.type==='Income').map(g=>g.name);
    const expGrps=groups.filter(g=>g.type==='Expense').map(g=>g.name);
    const getBal=id=>{
      let b=0;
      transactions.filter(t=>t.accId?._id===id||t.secAccId?._id===id).forEach(t=>{
        if(t.accId?._id===id){ b+=isIncoming(t.type)?-t.amt:t.amt; }
        else{ b+=isIncoming(t.type)?t.amt:-t.amt; }
      });
      return b;
    };
    let incItems=[],expItems=[],totalIncome=0,totalExp=0;
    accounts.filter(a=>incGrps.includes(a.group)).forEach(a=>{ const b=Math.abs(getBal(a._id)); if(b>0){incItems.push({name:a.name,amt:b});totalIncome+=b;} });
    accounts.filter(a=>expGrps.includes(a.group)).forEach(a=>{ const b=Math.abs(getBal(a._id)); if(b>0){expItems.push({name:a.name,amt:b});totalExp+=b;} });
    return { incItems, expItems, totalIncome, totalExp, net:totalIncome-totalExp };
  }), [from,to]);
  if (loading) return <PageLoader/>;
  if (!data)   return null;
  const { incItems, expItems, totalIncome, totalExp, net } = data;
  return (
    <div className="space-y-5">
      <div className="two-col">
        <div>
          <div className="bg-emerald-600 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">Income</div>
          <RTable heads={[{label:'Particulars'},{label:'Amount',right:true}]}
            rows={incItems.length?incItems.map(r=>[r.name,<span className="text-emerald-700 font-semibold">{fmt.format(r.amt)}</span>]):[['No income entries','—']]}
            foot={['Total Income', fmt.format(totalIncome)]}/>
        </div>
        <div>
          <div className="bg-red-500 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">Expenses</div>
          <RTable heads={[{label:'Particulars'},{label:'Amount',right:true}]}
            rows={expItems.length?expItems.map(r=>[r.name,<span className="text-red-600 font-semibold">{fmt.format(r.amt)}</span>]):[['No expense entries','—']]}
            foot={['Total Expenses', fmt.format(totalExp)]}/>
        </div>
      </div>
      <div className={`flex items-center justify-between p-5 rounded-2xl border-2 font-bold ${net>=0?'bg-emerald-50 border-emerald-300':'bg-red-50 border-red-300'}`}>
        <span className="text-lg">Net {net>=0?'Profit':'Loss'}</span>
        <span className={`text-3xl font-mono ${net>=0?'text-emerald-700':'text-red-600'}`}>{fmt.format(Math.abs(net))}</span>
      </div>
    </div>
  );
}

/* Receipts & Payments */
function ScheduleReport({ from, to }) {
  const { data, loading } = useFetch(()=>api.get(`/transactions?limit=9999${from?'&from='+from:''}${to?'&to='+to:''}`).then(r=>{
    const trans=r.data;
    let rGroups={}, pGroups={}, totRec=0, totPay=0;
    trans.filter(t=>!(t.by==='agent'&&t.type!=='agent_handover')).forEach(t=>{
      const acc=t.accId, name=acc?.custId?.name||acc?.name||'General';
      const label=`${name}${acc?.accNo?' ('+acc.accNo+')':''}`;
      if(isIncoming(t.type)){ rGroups[label]=(rGroups[label]||0)+t.amt; totRec+=t.amt; }
      else { pGroups[label]=(pGroups[label]||0)+t.amt; totPay+=t.amt; }
    });
    return { rGroups, pGroups, totRec, totPay };
  }), [from,to]);
  if (loading) return <PageLoader/>;
  if (!data) return null;
  const { rGroups, pGroups, totRec, totPay } = data;
  return (
    <div className="two-col">
      <div>
        <div className="bg-emerald-600 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">Receipts (In)</div>
        <RTable heads={[{label:'Account / Type'},{label:'Amount',right:true}]}
          rows={Object.entries(rGroups).length?Object.entries(rGroups).map(([k,v])=>[k,<span className="text-emerald-700">{fmt.format(v)}</span>]):[['No receipts','—']]}
          foot={['Total Receipts', fmt.format(totRec)]}/>
      </div>
      <div>
        <div className="bg-red-500 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">Payments (Out)</div>
        <RTable heads={[{label:'Account / Type'},{label:'Amount',right:true}]}
          rows={Object.entries(pGroups).length?Object.entries(pGroups).map(([k,v])=>[k,<span className="text-red-600">{fmt.format(v)}</span>]):[['No payments','—']]}
          foot={['Total Payments', fmt.format(totPay)]}/>
      </div>
    </div>
  );
}

/* Balance Sheet */
/* Balance Sheet */
function BSReport() {
  const { data, loading } = useFetch(() =>
    Promise.all([
      api.get('/accounts'),
      api.get('/groups'),
      // cash collected by agents but not yet handed over (an asset of the company)
      api.get('/reports/agent-cash').catch(() => ({ data: [] })),
    ]).then(([ar, gr, agr]) => ({
      accounts: ar.data,
      groups:   gr.data,
      agents:   Array.isArray(agr.data) ? agr.data : [],
    }))
  );

  if (loading) return <PageLoader />;
  if (!data)   return null;
  const { accounts, groups, agents } = data;

  /* ── build a section (Asset / Liability / Equity) ─────────────────────── */
  const buildSection = type => {
    const sectionGroups = groups.filter(g => g.type === type);
    let html = [], total = 0;
    sectionGroups.forEach(g => {
      const accs = accounts.filter(a => a.group === g.name);
      if (!accs.length) return;
      let sub = 0;
      accs.forEach(a => { sub += a.balance; });
      total += sub;
      html.push({ groupName: g.name, accs, sub });
    });
    return { sections: html, total };
  };

  const assets      = buildSection('Asset');
  const liabilities = buildSection('Liability');
  const equity      = buildSection('Equity');

  /* ── P&L ──────────────────────────────────────────────────────────────── */
  let totalIncome = 0, totalExp = 0;
  groups.filter(g => g.type === 'Income').forEach(g => {
    accounts.filter(a => a.group === g.name).forEach(a => {
      if (a.balance > 0) totalIncome += a.balance;
    });
  });
  groups.filter(g => g.type === 'Expense').forEach(g => {
    accounts.filter(a => a.group === g.name).forEach(a => {
      if (a.balance !== 0) totalExp += Math.abs(a.balance);
    });
  });
  const net = totalIncome - totalExp;

  /* ── Cash still held by agents (collected, not yet handed over) ──────────
     Shown under Assets only while the agent still holds more than 0.01.      */
  const agentRows = agents
    .map(ag => ({ ...ag, displayBalance: ag.balance || 0 }))
    .filter(ag => ag.displayBalance > 0.01);

  const agentTotal = agentRows.reduce((s, ag) => s + ag.displayBalance, 0);

  /* ── Grand totals ─────────────────────────────────────────────────────── */
  const liabTotal  = liabilities.total + equity.total + (net >= 0 ? net : 0);
  const assetTotal = assets.total + agentTotal + (net < 0 ? Math.abs(net) : 0);

  /* ── Reusable section table ───────────────────────────────────────────── */
  const SectionTable = ({ sections, color }) => (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={`border border-slate-300 px-3 py-2 text-left  text-xs uppercase tracking-wide ${color}`}>Particulars</th>
          <th className={`border border-slate-300 px-3 py-2 text-right text-xs uppercase tracking-wide ${color}`}>Amount</th>
          <th className={`border border-slate-300 px-3 py-2 text-right text-xs uppercase tracking-wide ${color}`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {sections.map(s => (
          <>
            <tr key={s.groupName} className="bg-slate-100">
              <td className="border border-slate-200 px-3 py-2 font-bold text-slate-700 text-xs uppercase tracking-wide">{s.groupName}</td>
              <td className="border border-slate-200 px-3 py-2" />
              <td className="border border-slate-200 px-3 py-2 text-right font-bold font-mono">{fmt.format(s.sub)}</td>
            </tr>
            {s.accs.map(a => (
              <tr key={a._id} className="bg-white">
                <td className="border border-slate-200 px-3 py-2 pl-6 text-slate-600">{a.name}</td>
                <td className="border border-slate-200 px-3 py-2 text-right font-mono text-xs text-slate-500">{fmt.format(a.balance)}</td>
                <td className="border border-slate-200 px-3 py-2" />
              </tr>
            ))}
          </>
        ))}
      </tbody>
    </table>
  );

  /* ── Agent cash-in-hand table — only unsettled agents ──────────────────
     Agents who have fully handed over (displayBalance <= 0.01) are
     completely absent from this table and from the totals.              */
  const AgentTable = () => {
    if (!agentRows.length) return null;
    return (
      <table className="w-full text-sm border-collapse">
        <tbody>
          {/* Group header */}
          <tr className="bg-slate-100">
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
              Cash in Hand – Agents
            </td>
            <td className="border border-slate-200 px-3 py-2" />
            <td className="border border-slate-200 px-3 py-2 text-right font-bold font-mono">
              {fmt.format(agentTotal)}
            </td>
          </tr>
          {/* One row per agent that still holds cash */}
          {agentRows.map(ag => (
            <tr key={ag._id} className="bg-white">
              <td className="border border-slate-200 px-3 py-2 pl-6 text-slate-600">
                <span
                  className="inline-flex w-5 h-5 rounded-full bg-indigo-100 items-center justify-center mr-1.5 flex-shrink-0"
                  style={{ verticalAlign: 'middle' }}
                >
                  <i className="fas fa-user text-indigo-500" style={{ fontSize: '9px' }} />
                </span>
                {agentLabel(ag)}
              </td>
              <td className="border border-slate-200 px-3 py-2 text-right font-mono text-xs text-slate-500">
                {fmt.format(ag.displayBalance)}
              </td>
              <td className="border border-slate-200 px-3 py-2" />
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      {/* ── Two-column body ─────────────────────────────────────────────── */}
      <div className="two-col">

        {/* Liabilities & Equity */}
        <div className="flex flex-col">
          <div className="bg-amber-600 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">
            Liabilities &amp; Equity
          </div>
          <SectionTable
            sections={[...liabilities.sections, ...equity.sections]}
            color="bg-amber-50 text-amber-800"
          />
          {net >= 0 && (
            <div className="border border-slate-200 bg-emerald-50 px-3 py-2 flex justify-between text-sm font-bold">
              <span className="text-emerald-800">Net Profit</span>
              <span className="font-mono text-emerald-700">{fmt.format(net)}</span>
            </div>
          )}
        </div>

        {/* Assets */}
        <div className="flex flex-col">
          <div className="bg-emerald-700 text-white text-center py-2.5 font-bold rounded-t-xl text-sm">
            Assets
          </div>
          <SectionTable sections={assets.sections} color="bg-emerald-50 text-emerald-800" />
          {/* Agent section only renders when at least one agent still holds cash */}
          <AgentTable />
          {net < 0 && (
            <div className="border border-slate-200 bg-red-50 px-3 py-2 flex justify-between text-sm font-bold">
              <span className="text-red-700">Net Loss</span>
              <span className="font-mono text-red-600">{fmt.format(Math.abs(net))}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Shared totals footer — both on the same horizontal line ─────── */}
      <div className="two-col" style={{marginTop:0}}>
        <div className="bg-blue-700 text-white px-4 py-3 flex justify-between items-center font-bold rounded-b-xl">
          <span className="text-sm uppercase tracking-wide">Total Liabilities &amp; Equity</span>
          <span className="font-mono text-base">{fmt.format(liabTotal)}</span>
        </div>
        <div className="bg-blue-700 text-white px-4 py-3 flex justify-between items-center font-bold rounded-b-xl">
          <span className="text-sm uppercase tracking-wide">Total Assets</span>
          <span className="font-mono text-base">{fmt.format(assetTotal)}</span>
        </div>
      </div>

      {/* Balance-check warning */}
      {Math.abs(liabTotal - assetTotal) > 0.01 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <i className="fas fa-exclamation-triangle" />
          &nbsp;Balance sheet is out of balance by {fmt.format(Math.abs(liabTotal - assetTotal))}. Please check your entries.
        </div>
      )}
    </div>
  );
}


/* Ledger Select Modal */
function LedgerSelectModal({ onSelect, onClose }) {
  const [q,setQ]=useState('');
  const { data:accounts, loading } = useFetch(()=>api.get('/accounts').then(r=>r.data));
  const filtered=(accounts||[]).filter(a=>a.name.toLowerCase().includes(q.toLowerCase())||(a.accNo&&a.accNo.toLowerCase().includes(q.toLowerCase()))||(a.custId?.name&&a.custId.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="modal-body space-y-3">
      <input className="input" placeholder="Search account name or number…" value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
      <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
        {loading?<div className="flex justify-center py-6"><span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
          :filtered.map(a=>(
            <button key={a._id} onClick={()=>onSelect(a)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors">
              <div className="flex justify-between">
                <span className="font-semibold text-sm text-slate-800">{a.custId?.name||a.name} {a.accNo&&<span className="font-mono text-xs text-slate-400">({a.accNo})</span>}</span>
                <span className={`font-mono text-sm font-bold ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{a.type} · {a.group}</div>
            </button>
          ))
        }
      </div>
      <button onClick={onClose} className="btn btn-secondary w-full">Cancel</button>
    </div>
  );
}


function AgentCommissionReport({ from, to, agentId }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded,setExpanded]= useState({});
  const toast = useToast();

  useEffect(() => {
    const p = new URLSearchParams();
    if (from)    p.append('from', from);
    if (to)      p.append('to', to);
    if (agentId) p.append('agentId', agentId);
    api.get(`/reports/agent-commission?${p}`)
      .then(r => setData(r.data || []))
      .catch(err => toast.error(getErrorMsg(err)))
      .finally(() => setLoading(false));
  }, [from, to, agentId]);

  if (loading) return <PageLoader />;
  if (data.length === 0) return (
    <EmptyState icon="fa-user-tie" title="No commission data" message="No agent transactions found for this period" />
  );

  // Recalculate totals dynamically based on correct account type percentages
  const processedData = data.map(agent => {
    let computedTotalComm = 0;
    
    // Map individual transaction rows using the agent's account type commission configurations
    const updatedRows = (agent.rows || []).map(row => {
      // Find the specific rate configured for this account type (e.g. Savings -> 4%, Personal Loan -> 2%)
      const matchingConfig = (agent.typeCommissions || []).find(
        tc => tc.typeName.toLowerCase() === (row.accountType || row.type || '').toLowerCase()
      );
      
      const rate = matchingConfig ? matchingConfig.rate : (row.rate || 0);
      const commAmt = (parseFloat(row.amt || 0) * rate) / 100;
      computedTotalComm += commAmt;

      return {
        ...row,
        rate,
        comm: commAmt
      };
    });

    // Rebuild the Account Type Breakdown mapping object using correct rates
    const updatedByType = {};
    updatedRows.forEach(row => {
      const typeKey = row.accountType || row.type || 'General';
      if (!updatedByType[typeKey]) {
        updatedByType[typeKey] = { amt: 0, rate: row.rate, comm: 0 };
      }
      updatedByType[typeKey].amt += parseFloat(row.amt || 0);
      updatedByType[typeKey].comm += row.comm;
    });

    return {
      ...agent,
      rows: updatedRows,
      byType: updatedByType,
      totalComm: computedTotalComm
    };
  });

  const grandTotal = processedData.reduce((s, a) => s + a.totalComm, 0);
  const grandAmt   = processedData.reduce((s, a) => s + (a.totalAmt || 0), 0);

  const toggle = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-4">
      {/* Summary table */}
      <div className="table-wrap rounded-xl">
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th className="text-right">Total Collection</th>
              <th className="text-right">Commission Earned</th>
              <th className="text-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map(a => (
              <tr key={a.agentId} className="hover:bg-violet-50/40 transition-colors">
                <td colSpan={4} className="p-0">
                  {/* Primary Summary row */}
                  <div className="flex items-center justify-between p-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-user-tie text-violet-600 text-xs" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-800 text-sm">{a.agentCode ? `${a.agentCode} — ` : ''}{a.username}</div>
                        {a.name && <div className="text-xs text-slate-400">{a.name}</div>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="text-right font-mono text-sm font-medium">{fmt.format(a.totalAmt || 0)}</div>
                      <div className="text-right font-bold font-mono text-sm text-violet-700 min-w-24">{fmt.format(a.totalComm)}</div>
                      <div className="text-center">
                        <button type="button" onClick={() => toggle(a.agentId)} className="btn btn-secondary btn-sm">
                          <i className={`fas fa-chevron-${expanded[a.agentId] ? 'up' : 'down'} text-xs`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Panels */}
                  {expanded[a.agentId] && (
                    <div className="bg-slate-50/80 px-4 py-4 border-b border-slate-200 text-left space-y-4">
                      
                      {/* 1. Account Type Breakdown Table */}
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Account Type Breakdown</div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="text-left py-1.5 bg-transparent border-none">Account Type</th>
                              <th className="text-right py-1.5 bg-transparent border-none">Collection</th>
                              <th className="text-right py-1.5 bg-transparent border-none">Commission %</th>
                              <th className="text-right py-1.5 bg-transparent border-none">Commission Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(a.byType).map(([type, vals]) => (
                              <tr key={type} className="border-b border-slate-100">
                                <td className="py-1.5 font-medium text-slate-700">{type || '—'}</td>
                                <td className="py-1.5 text-right font-mono">{fmt.format(vals.amt || 0)}</td>
                                <td className="py-1.5 text-right text-slate-500">{vals.rate || 0}%</td>
                                <td className="py-1.5 text-right font-mono text-violet-700 font-semibold">{fmt.format(vals.comm || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-violet-200 bg-violet-50/50">
                              <td colSpan={2} className="py-1.5 font-bold text-slate-700 pl-1">Agent Total</td>
                              <td />
                              <td className="py-1.5 text-right font-bold font-mono text-violet-700 pr-1">{fmt.format(a.totalComm)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* 2. Transaction Level Details Table */}
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Transaction Detail</div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="text-left py-1 bg-transparent border-none">Date</th>
                              <th className="text-left py-1 bg-transparent border-none">Account</th>
                              <th className="text-left py-1 bg-transparent border-none">Type</th>
                              <th className="text-right py-1 bg-transparent border-none">Amount</th>
                              <th className="text-right py-1 bg-transparent border-none">Commission %</th>
                              <th className="text-right py-1 bg-transparent border-none">Commission Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.rows.map((row, i) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="py-1 text-slate-500">{dateDisp(row.date)}</td>
                                <td className="py-1 font-mono text-slate-700">{row.accNo || row.accName}</td>
                                <td className="py-1">
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                    {row.accountType || row.type || 'deposit'}
                                  </span>
                                </td>
                                <td className="py-1 text-right font-mono">{fmt.format(row.amt || 0)}</td>
                                <td className="py-1 text-right text-slate-400">{row.rate || 0}%</td>
                                <td className="py-1 text-right font-mono text-violet-700">{fmt.format(row.comm || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-violet-200 bg-violet-50">
              <td className="px-3 py-2.5 font-bold text-slate-800">Grand Total</td>
              <td className="px-3 py-2.5 text-right font-bold font-mono">{fmt.format(grandAmt)}</td>
              <td className="px-3 py-2.5 text-right font-bold font-mono text-violet-700">{fmt.format(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const REPORT_CARDS = [
  { id:'cust_list',  label:'Customer List',     icon:'fa-users',           color:'text-blue-600 bg-blue-50',    roles:['admin','agent'] },
  { id:'daybook',    label:'Day Book',           icon:'fa-calendar-day',    color:'text-emerald-600 bg-emerald-50', roles:['admin'] },
  { id:'bal_book',   label:'Balance Book',       icon:'fa-book',            color:'text-purple-600 bg-purple-50', roles:['admin','agent'] },
  { id:'acc_bal',    label:'Accounts Balance',   icon:'fa-list-ol',         color:'text-indigo-600 bg-indigo-50', roles:['admin'] },
  { id:'ledger',     label:'Ledger',             icon:'fa-file-invoice',    color:'text-amber-600 bg-amber-50',  roles:['admin','agent'] },
  { id:'loans',      label:'Loans',              icon:'fa-money-bill-wave', color:'text-red-600 bg-red-50',      roles:['admin','agent'] },
  { id:'schedule',   label:'Receipts & Payments',icon:'fa-exchange-alt',    color:'text-cyan-600 bg-cyan-50',    roles:['admin'] },
  { id:'pl',         label:'Profit & Loss',      icon:'fa-chart-line',      color:'text-emerald-700 bg-emerald-50', roles:['admin'] },
  { id:'bs',         label:'Balance Sheet',      icon:'fa-balance-scale',   color:'text-slate-700 bg-slate-100', roles:['admin'] },
  { id:'agent_comm', label:'Agent Commission',    icon:'fa-user-tie',        color:'text-violet-600 bg-violet-50', roles:['admin'] },
  ...MORE_REPORT_CARDS,
];

/* ── Main ReportsPage ────────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [active,     setActive]     = useState(null);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [ledgerAcc,  setLedgerAcc]  = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showAccBal, setShowAccBal] = useState(false);
  const [accBalFilter, setAccBalFilter] = useState({ filterType:'' });
  const [agentCommAgent, setAgentCommAgent] = useState('');  // agentId or '' = all
  const { user } = useAuth();
  const orgName = user?.companyName || 'Company';

  const dateRange = from&&to ? `From: ${dateDisp(from)}  To: ${dateDisp(to)}` : from ? `From: ${dateDisp(from)}` : to ? `Up to: ${dateDisp(to)}` : `As on: ${dateDisp(dateNow())}`;
  const visible   = REPORT_CARDS.filter(r=>r.roles.includes(user?.role));

  const open = id => {
    if (id==='ledger')  { setShowLedger(true);  return; }
    if (id==='acc_bal') { setShowAccBal(true);  return; }
    setActive(id);
  };
  const selectLedger = acc => { setLedgerAcc(acc); setShowLedger(false); setActive('ledger'); };
  const selectAccBal = ({ filterType }) => {
    setAccBalFilter({ filterType });
    setShowAccBal(false);
    setActive('acc_bal');
  };

  if (active) {
    const card = REPORT_CARDS.find(r=>r.id===active);
    return (
      <ReportViewer
        orgName={orgName}
        subtitle={
          card?.label +
          (ledgerAcc && active==='ledger' ? `: ${ledgerAcc.custId?.name||ledgerAcc.name}` : '') +
          (active==='acc_bal' && accBalFilter.filterType ? `: ${accBalFilter.filterType}` : '')
        }
        dateRange={dateRange}
        fit={['bs','pl','schedule'].includes(active)}
        landscape={!!card?.landscape}
        onBack={()=>{ setActive(null); setLedgerAcc(null); setAccBalFilter({ filterType:'' }); }}>
        {active==='cust_list'  && <CustListReport/>}
        {active==='daybook'    && <DayBookReport from={from}/>}
        {active==='bal_book'   && <BalBookReport/>}
        {active==='acc_bal'    && <AccBalReport filterType={accBalFilter.filterType}/>}
        {active==='ledger'     && ledgerAcc && <LedgerReport accountId={ledgerAcc._id}/>}
        {active==='loans'      && <LoansReport/>}
        {active==='schedule'   && <ScheduleReport from={from} to={to}/>}
        {active==='pl'         && <PLReport from={from} to={to}/>}
        {active==='bs'         && <BSReport/>}
        {active==='agent_comm' && <AgentCommissionReport from={from} to={to} agentId={agentCommAgent}/>}
        <MoreReportView id={active} from={from} to={to}/>
      </ReportViewer>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and print all financial reports"/>
      <DateFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={()=>{setFrom('');setTo('');}}/>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visible.map(card=>(
          <button key={card.id} onClick={()=>open(card.id)}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color} group-hover:scale-110 transition-transform`}>
              <i className={`fas ${card.icon} text-sm`}/>
            </div>
            <div className="font-semibold text-slate-700 text-sm leading-tight">{card.label}</div>
          </button>
        ))}
      </div>

      <Modal isOpen={showLedger} onClose={()=>setShowLedger(false)} title="Select Account for Ledger">
        <LedgerSelectModal onSelect={selectLedger} onClose={()=>setShowLedger(false)}/>
      </Modal>

      <Modal isOpen={showAccBal} onClose={()=>setShowAccBal(false)} title="Accounts Balance — Filter">
        <AccBalSelectModal onSelect={selectAccBal} onClose={()=>setShowAccBal(false)}/>
      </Modal>
    </div>
  );
}
