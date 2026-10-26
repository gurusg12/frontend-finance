import { useState, useEffect } from 'react';
import api, { fmt, dateDisp, getErrorMsg } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PageLoader, Modal, EmptyState } from '../shared';

const TYPE_COLORS = {
  deposit:'badge-green', withdraw:'badge-red', disburse:'badge-amber',
  repay_princ:'badge-blue', adjustment:'badge-slate', agent_handover:'badge-green',
  income:'badge-green', expense:'badge-red'
};
const TYPE_LABELS = {
  deposit:'Deposit', withdraw:'Withdraw', disburse:'Disburse',
  repay_princ:'Repayment', adjustment:'Adjustment', agent_handover:'Handover',
  income:'Income', expense:'Expense'
};
const isIncoming = type => ['deposit','repay_princ','income'].includes(type);

/* ── Mobile stat card ───────────────────────────────────────────────────── */
function MobileStatCard({ label, value, icon, grad, sub }) {
  return (
    <div className={`bg-gradient-to-r ${grad} rounded-2xl p-4 shadow-md flex items-center gap-3 text-white relative overflow-hidden`}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 relative">
        <i className={`fas ${icon} text-sm`} />
      </div>
      <div className="min-w-0 flex-1 relative">
        <div className="text-xs font-bold text-white/80 uppercase tracking-wide leading-none mb-1">{label}</div>
        <div className="text-lg font-bold font-mono leading-tight truncate">{value}</div>
        {sub && <div className="text-xs text-white/80 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [trans, setTrans] = useState([]);
  const [tenantData, setTenantData] = useState(null); 
  const [showReminderDetail, setShowReminderDetail] = useState(false); 
  const [drillDown, setDrillDown] = useState(null); 
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const calls = [
        api.get('/reports/dashboard'),
        api.get('/transactions?limit=12'),
      ];
      if (isAdmin) calls.push(api.get('/reports/dashboard-tenant'));

      const [sr, tr, xr] = await Promise.all(calls);
      setStats(sr.data);
      setTrans(tr.data);
      if (isAdmin && xr) setTenantData(xr.data);
    } catch (e) { toast.error(getErrorMsg(e)); }
    finally { setLoading(false); }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) return <PageLoader />;

  const net = (stats?.totalIncome || 0) - (stats?.totalExpense || 0);

  const quickActions = [
    { label:'New Transaction', icon:'fa-exchange-alt', color:'blue', page:'transactions' },
    { label:'Add Customer', icon:'fa-user-plus', color:'green', page:'customers' },
    { label:'Reports', icon:'fa-chart-bar', color:'purple', page:'reports' },
    { label:'Agents', icon:'fa-user-tie', color:'amber', page:'agents', adminOnly:true },
    { label:'Settings', icon:'fa-cog', color:'slate', page:'settings' },
  ].filter(a => !a.adminOnly || isAdmin);

  const iconBg = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  const statCards = [
    { label:'Cash In Hand', value:fmt.format(stats?.cashBalance||0), icon:'fa-wallet', grad:'from-blue-500 to-indigo-600' },
    { label:'Total Receipts', value:fmt.format(stats?.totalReceipts||0), icon:'fa-arrow-down', grad:'from-emerald-500 to-teal-600' },
    { label:'Total Income', value:fmt.format(stats?.totalIncome||0), icon:'fa-chart-line', grad:'from-violet-500 to-purple-600',
      sub: isAdmin ? `Exp: ${fmt.format(stats?.totalExpense||0)}` : null },
    { label:'Transactions', value:(stats?.totalCount||0).toLocaleString(), icon:'fa-list-check', grad:'from-amber-500 to-orange-600' },
  ];

  return (
    <div className="space-y-4">

      {/* ── Sticky Header & Top Stats Group ───────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-1 pb-3 bg-slate-100/95 backdrop-blur-md space-y-3 shadow-sm">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-slate-800 leading-tight">
              {greeting}, {user?.username} 👋
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {user?.companyName} &nbsp;·&nbsp;
              <span className="hidden sm:inline">
                {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
              </span>
              <span className="sm:hidden">
                {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
              </span>
            </p>
          </div>
          <button
            onClick={load}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 flex-shrink-0 shadow-sm active:scale-95 transition-all"
          >
            <i className="fas fa-sync-alt text-xs" />
          </button>
        </div>

        {/* Stat cards (compact) */}
        <div className="block lg:hidden space-y-2">
          {statCards.map(s => (
            <MobileStatCard key={s.label} {...s} />
          ))}
        </div>
        <div className="hidden lg:grid grid-cols-4 gap-3">
          {statCards.map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.grad} rounded-2xl p-3.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-white relative overflow-hidden`}>
              <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-white/10" />
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-2 relative">
                <i className={`fas ${s.icon} text-xs`} />
              </div>
              <div className="!text-lg text-lg font-bold font-mono relative">{s.value}</div>
              <div className="text-xs font-bold text-white/80 uppercase tracking-wide relative">{s.label}</div>
              {s.sub && <div className="text-[11px] text-white/80 mt-0.5 font-medium relative">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Sticky Net P&L + Today's Payment + Reminders & Alerts ── */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch pt-1">
            {/* Net Profit / Loss */}
            <div className={`flex items-center justify-between rounded-2xl px-4 py-3.5 shadow-md text-white bg-gradient-to-r ${
              net >= 0 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <i className={`fas ${net>=0?'fa-trophy':'fa-arrow-trend-down'} text-sm`} />
                </div>
                <div>
                  <div className="font-bold text-sm">Net {net>=0?'Profit':'Loss'}</div>
                  <div className="text-xs text-white/80">Overall P&amp;L</div>
                </div>
              </div>
              <div className="text-lg lg:text-xl font-bold font-mono">
                {fmt.format(Math.abs(net))}
              </div>
            </div>

            {tenantData && (
              <>
                {/* Today's Payments */}
                <div className="flex items-center justify-between rounded-2xl px-4 py-3.5 shadow-md text-white bg-gradient-to-r from-cyan-500 to-sky-600">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-calendar-day text-sm" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Today's Payment</div>
                      <div className="text-xs text-white/80 truncate">{tenantData.todayPayments?.count || 0} txn today</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold font-mono">+{fmt.format(tenantData.todayPayments?.received || 0)}</div>
                    <div className="text-xs font-bold font-mono text-rose-100">-{fmt.format(tenantData.todayPayments?.paid || 0)}</div>
                  </div>
                </div>

                {/* Reminders & Alerts */}
                <button
                  type="button"
                  onClick={() => setShowReminderDetail(v => !v)}
                  aria-expanded={showReminderDetail}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 shadow-md text-white bg-gradient-to-r from-amber-500 to-orange-500 text-left w-full cursor-pointer hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-bell text-sm" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Reminders &amp; Alerts</div>
                      <div className="text-xs text-white/85 truncate">
                        {tenantData.alerts?.length
                          ? `${tenantData.alerts.length} item(s) this week`
                          : 'No alerts this week'}
                      </div>
                    </div>
                  </div>
                  <i className={`fas fa-chevron-down text-white/80 text-xs transition-transform duration-300 flex-shrink-0 ${showReminderDetail ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
        )}

      </div>

      {/* ── This Month detail cards + drill-down modal ─────────────────────── */}
      {isAdmin && tenantData && (
        <>
          <div className={`grid transition-all duration-300 ease-in-out ${showReminderDetail ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setDrillDown('deposits')}
                  className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl shadow-md p-4 text-left cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">This Month Deposit Maturity</div>
                  <div className="text-lg font-bold font-mono">{fmt.format(tenantData.monthDepositsMaturity?.totalAmt || 0)}</div>
                  <div className="text-xs text-white/80 mt-0.5">{tenantData.monthDepositsMaturity?.count || 0} account(s) &middot; view details</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillDown('loans')}
                  className="bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-2xl shadow-md p-4 text-left cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">This Month Loan Due</div>
                  <div className="text-lg font-bold font-mono">{fmt.format(tenantData.monthLoanDue?.totalAmt || 0)}</div>
                  <div className="text-xs text-white/80 mt-0.5">{tenantData.monthLoanDue?.count || 0} account(s) &middot; view details</div>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('mis-reports')}
                  className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-md p-4 text-left cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">This Month EMI</div>
                  <div className="text-sm font-bold font-mono">
                    Receivable: {fmt.format(tenantData.monthEmi?.receivable || 0)}
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-100">
                    Received: {fmt.format(tenantData.monthEmi?.received || 0)}
                  </div>
                  <div className="text-xs text-white/80 mt-1.5">Open MIS Reports for full EMI breakdown</div>
                </button>
              </div>
            </div>
          </div>

          <Modal
            isOpen={!!drillDown}
            onClose={() => setDrillDown(null)}
            title={drillDown === 'deposits' ? 'This Month Deposit Maturity' : 'This Month Loan Due'}
          >
            {(() => {
              const list = drillDown === 'deposits'
                ? tenantData.monthDepositsMaturity?.accounts
                : tenantData.monthLoanDue?.accounts;
              if (!list || list.length === 0) {
                return <EmptyState icon="fa-inbox" title="No accounts" message="Nothing maturing this month" />;
              }
              return (
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                        <th className="py-2 pr-3">Customer / Account</th>
                        <th className="py-2 pr-3">Maturity Date</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {list.map(a => (
                        <tr key={a._id}>
                          <td className="py-2 pr-3">
                            <div className="font-semibold text-slate-700">{a.name}</div>
                            <div className="text-xs text-slate-400">{a.accNo}</div>
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{dateDisp(a.maturityDate)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-bold text-slate-800">{fmt.format(a.amt || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Modal>
        </>
      )}

      {/* ── Quick Actions (mobile: horizontal scroll row) ───────────── */}
      <div className="block lg:hidden">
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scroll-smooth" style={{scrollbarWidth:'none'}}>
          {quickActions.map(a => (
            <button
              key={a.page}
              onClick={() => onNavigate(a.page)}
              className="flex flex-col items-center gap-2 min-w-[72px] p-3 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all flex-shrink-0"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[a.color]}`}>
                <i className={`fas ${a.icon} text-sm`} />
              </div>
              <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight whitespace-nowrap">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop layout: transactions + right column side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 lg:px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm lg:text-base">Recent Transactions</h3>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              View All <i className="fas fa-arrow-right text-[10px]" />
            </button>
          </div>

          {trans.filter(t => t.type !== 'agent_handover').slice(0, 5).length === 0
            ? <div className="py-12 text-center text-slate-400 text-sm">No transactions yet</div>
            : <div className="divide-y divide-slate-50">
                {trans.filter(t => t.type !== 'agent_handover').slice(0, 5).map(t => {
                  const acc = t.accId;
                  const name = acc?.custId?.name || acc?.name || '—';
                  const accNo = acc?.accNo || '';
                  const inc = isIncoming(t.type);
                  return (
                    <div key={t._id} className="flex items-center gap-3 px-4 lg:px-5 py-3 active:bg-slate-50 hover:bg-slate-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${inc?'bg-emerald-50':'bg-red-50'}`}>
                        <i className={`fas ${inc?'fa-arrow-down':'fa-arrow-up'} text-xs ${inc?'text-emerald-500':'text-red-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-700 truncate">
                          {name}
                          {accNo && <span className="ml-1 text-slate-400 font-normal font-mono text-xs">({accNo})</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {dateDisp(t.date)}
                          {t.desc && ` · ${t.desc}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge ${TYPE_COLORS[t.type]||'badge-slate'} hidden sm:inline-flex text-[10px]`}>
                          {TYPE_LABELS[t.type]||t.type}
                        </span>
                        <span className={`font-bold font-mono text-sm ${inc?'text-emerald-600':'text-red-500'}`}>
                          {fmt.format(t.amt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Right column — desktop only */}
        <div className="hidden lg:flex flex-col gap-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map(a => (
                <button key={a.page} onClick={() => onNavigate(a.page)}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${iconBg[a.color]}`}>
                    <i className={`fas ${a.icon} text-sm`} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 text-center leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Info card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <i className="fas fa-lightbulb text-sm" />
            </div>
            <div className="font-bold text-sm mb-1">Pro Tip</div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Use <strong>Adjustment Entry</strong> to move balance between any two accounts — great for opening balance corrections or internal transfers.
            </p>
            {isAdmin && (
              <button onClick={() => onNavigate('adjustment')}
                className="mt-3 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 w-fit">
                Open Adjustment <i className="fas fa-arrow-right" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Cash Transfer / Handover History ──────────────────────────── */}
      {(stats?.recentHandovers?.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 lg:px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm lg:text-base">Cash Transfer / Handover History</h3>
            <span className="text-xs font-semibold text-slate-400">
              Total handed over: <span className="text-slate-700 font-mono">{fmt.format(stats?.totalHandover || 0)}</span>
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentHandovers.map(h => (
              <div key={h._id} className="flex items-center gap-3 px-4 lg:px-5 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-50">
                  <i className="fas fa-right-left text-xs text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">
                    {h.agentId?.name || h.agentId?.username || 'Agent'} → Office
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {dateDisp(h.date)}
                    {h.accId?.name && ` · ${h.accId.name}`}
                  </div>
                </div>
                <span className="font-bold font-mono text-sm text-blue-600">
                  {fmt.format(h.amt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}