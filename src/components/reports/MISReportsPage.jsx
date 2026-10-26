import { useState, useEffect } from 'react';
import api, { fmt, dateDisp, getErrorMsg, agentLabel } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader, PageLoader, EmptyState, Modal } from '../shared';

/* ── Detail table used by all the drill-down modals ─────────────────────── */
function AccountTable({ rows, extraCols = [] }) {
  if (!rows || rows.length === 0) return <EmptyState icon="fa-inbox" title="No accounts" message="Nothing to show here" />;
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
            <th className="py-2 pr-3">Customer</th>
            <th className="py-2 pr-3">Account</th>
            <th className="py-2 pr-3 text-right">Balance</th>
            {extraCols.map(c => <th key={c.key} className="py-2 pr-3">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(a => (
            <tr key={a._id}>
              <td className="py-2 pr-3">
                <div className="font-semibold text-slate-700">{a.custName || '—'}</div>
                <div className="text-xs text-slate-400">{a.custNo}</div>
              </td>
              <td className="py-2 pr-3">
                <div className="text-slate-700">{a.name}</div>
                <div className="text-xs text-slate-400">{a.accNo}</div>
              </td>
              <td className="py-2 pr-3 text-right font-mono font-bold text-slate-800">{fmt.format(a.balance || 0)}</td>
              {extraCols.map(c => <td key={c.key} className="py-2 pr-3 text-slate-600">{c.render ? c.render(a) : a[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── MIS Summary Card (Total Deposits / Total Loans / Total Loan Due) ──── */
function MisCard({ icon, color, label, amt, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left hover:shadow-md hover:border-blue-200 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-50`}>
          <i className={`fas ${icon} text-${color}-600 text-sm`} />
        </div>
        <i className="fas fa-chevron-right text-slate-300 text-xs" />
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">{fmt.format(amt || 0)}</div>
      <div className="text-xs text-slate-400 mt-0.5">{count || 0} account(s)</div>
    </button>
  );
}

/* ── Agent Collection & Activity ─────────────────────────────────────────── */
function AgentActivity() {
  const [agents, setAgents]   = useState([]);
  const [agentId, setAgentId] = useState('');
  const [mode, setMode]       = useState('day'); // 'day' | 'month'
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { api.get('/agents').then(r => setAgents(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({ mode });
    if (agentId) p.set('agentId', agentId);
    api.get(`/reports/mis/agent-activity?${p}`)
      .then(r => { if (!cancelled) setRows(r.data); })
      .catch(e => toast.error(getErrorMsg(e)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, mode]);

  const totals = rows.reduce((s, r) => ({
    collectionAmt: s.collectionAmt + r.collectionAmt,
    handoverAmt:   s.handoverAmt   + r.handoverAmt,
    commission:    s.commission    + r.commission,
  }), { collectionAmt: 0, handoverAmt: 0, commission: 0 });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-slate-800">Agent Collection &amp; Activity</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select className="select select-sm" value={agentId} onChange={e => setAgentId(e.target.value)}>
            <option value="">All Agents</option>
            {agents.map(a => <option key={a._id} value={a._id}>{agentLabel(a)}</option>)}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button onClick={() => setMode('day')}   className={`px-3 py-1.5 text-xs font-semibold ${mode==='day'   ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>Day-wise</button>
            <button onClick={() => setMode('month')} className={`px-3 py-1.5 text-xs font-semibold ${mode==='month' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>Month-wise</button>
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : rows.length === 0
        ? <EmptyState icon="fa-user-tie" title="No activity" message="No agent collections in this range" />
        : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2 pr-3">{mode === 'month' ? 'Month' : 'Date'}</th>
                  <th className="py-2 pr-3 text-right">Collection</th>
                  <th className="py-2 pr-3 text-right">Handover</th>
                  <th className="py-2 pr-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(r => (
                  <tr key={r.period}>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{r.period}</td>
                    <td className="py-2 pr-3 text-right font-mono text-emerald-600">{fmt.format(r.collectionAmt)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-blue-600">{fmt.format(r.handoverAmt)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-purple-600">{fmt.format(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-100 font-bold">
                  <td className="py-2 pr-3 text-slate-700">Total</td>
                  <td className="py-2 pr-3 text-right font-mono text-emerald-700">{fmt.format(totals.collectionAmt)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-blue-700">{fmt.format(totals.handoverAmt)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-purple-700">{fmt.format(totals.commission)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
    </div>
  );
}

/* ── MIS Reports Page (tenant/admin only) ────────────────────────────────── */
export default function MISReportsPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // 'deposits' | 'loans' | 'loan-due' | null
  const [detail, setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loanDueTab, setLoanDueTab] = useState('emi'); // 'emi' | 'maturity'
  const toast = useToast();

  useEffect(() => {
    api.get('/reports/mis/summary')
      .then(r => setSummary(r.data))
      .catch(e => toast.error(getErrorMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  const openModal = async (which) => {
    setModal(which);
    setDetailLoading(true);
    try {
      const url = which === 'deposits' ? '/reports/mis/deposits'
                : which === 'loans'    ? '/reports/mis/loans'
                : '/reports/mis/loan-due';
      const r = await api.get(url);
      setDetail(r.data);
      if (which === 'loan-due') setLoanDueTab('emi');
    } catch (e) { toast.error(getErrorMsg(e)); }
    finally { setDetailLoading(false); }
  };

  const closeModal = () => { setModal(null); setDetail(null); };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <PageHeader title="MIS Reports" subtitle="Tenant-wide deposit, loan, and agent activity overview" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MisCard icon="fa-piggy-bank"      color="blue"   label="Total Deposits"  amt={summary?.totalDeposits} count={summary?.depositCount} onClick={() => openModal('deposits')} />
        <MisCard icon="fa-hand-holding-usd" color="red"    label="Total Loans"     amt={summary?.totalLoans}    count={summary?.loanCount}    onClick={() => openModal('loans')} />
        <MisCard icon="fa-triangle-exclamation" color="amber" label="Total Loan Due" amt={summary?.totalLoanDue} count={summary?.loanDueCount} onClick={() => openModal('loan-due')} />
      </div>

      <AgentActivity />

      {/* Total Deposits detail */}
      <Modal isOpen={modal === 'deposits'} onClose={closeModal} title="Total Deposits">
        {detailLoading ? <PageLoader /> : (
          <AccountTable rows={detail} extraCols={[
            { key: 'roi', label: 'ROI %' },
            { key: 'maturityDate', label: 'Maturity', render: a => a.maturityDate ? dateDisp(a.maturityDate) : '—' },
          ]} />
        )}
      </Modal>

      {/* Total Loans detail */}
      <Modal isOpen={modal === 'loans'} onClose={closeModal} title="Total Loans">
        {detailLoading ? <PageLoader /> : (
          <AccountTable rows={detail} extraCols={[
            { key: 'roi', label: 'ROI %' },
            { key: 'emiMethod', label: 'EMI Method', render: a => a.emiMethod === 'fixed' ? 'Fixed' : 'Reducing' },
            { key: 'maturityDate', label: 'Maturity', render: a => a.maturityDate ? dateDisp(a.maturityDate) : '—' },
          ]} />
        )}
      </Modal>

      {/* Total Loan Due detail — EMI / Maturity tabs */}
      <Modal isOpen={modal === 'loan-due'} onClose={closeModal} title="Total Loan Due">
        {detailLoading ? <PageLoader /> : (
          <>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-4 w-fit">
              <button onClick={() => setLoanDueTab('emi')}      className={`px-4 py-1.5 text-xs font-semibold ${loanDueTab==='emi'      ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>
                EMI ({detail?.emi?.count || 0})
              </button>
              <button onClick={() => setLoanDueTab('maturity')} className={`px-4 py-1.5 text-xs font-semibold ${loanDueTab==='maturity' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>
                Maturity ({detail?.maturity?.count || 0})
              </button>
            </div>
            <AccountTable
              rows={loanDueTab === 'emi' ? detail?.emi?.accounts : detail?.maturity?.accounts}
              extraCols={[
                { key: 'roi', label: 'ROI %' },
                { key: 'maturityDate', label: 'Maturity', render: a => a.maturityDate ? dateDisp(a.maturityDate) : '—' },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}