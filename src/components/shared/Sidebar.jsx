import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { group: 'Main', items: [
    { key:'dashboard',    label:'Dashboard',       icon:'fa-home',          roles:['admin','agent'] },
    { key:'customers',    label:'Customers',        icon:'fa-users',         roles:['admin','agent'] },
    { key:'transactions', label:'Transactions',     icon:'fa-exchange-alt',  roles:['admin','agent'] },
    { key:'adjustment',   label:'Adjustment Entry', icon:'fa-balance-scale', roles:['admin'] },
    { key:'reports',      label:'Reports',          icon:'fa-chart-bar',     roles:['admin','agent'] },
  ]},
  { group: 'Management', items: [
    { key:'agents',       label:'Agents',           icon:'fa-user-tie',      roles:['admin'] },
  ]},
  { group: 'Master Data', items: [
    { key:'master',       label:'Account Master',   icon:'fa-book',          roles:['admin'] },
    { key:'groups',       label:'Groups',           icon:'fa-layer-group',   roles:['admin'] },
    { key:'account-types',label:'Account Types',    icon:'fa-tags',          roles:['admin'] },
  ]},
  { group: 'System', items: [
    { key:'settings',     label:'Settings',         icon:'fa-cog',           roles:['admin','agent'] },
    { key:'mis-reports',  label:'MIS Reports',      icon:'fa-file-invoice',  roles:['admin'] },
  ]},
];

export default function Sidebar({ activePage, onNavigate, onClose }) {
  const { user, logout } = useAuth();

  const planColors = { trial:'bg-slate-600 text-slate-200', basic:'bg-blue-700 text-blue-200', standard:'bg-purple-700 text-purple-200', premium:'bg-amber-600 text-amber-100' };

  return (
    <div className="h-full flex flex-col bg-[#111827] text-white overflow-hidden">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <i className="fas fa-chart-line text-white text-sm" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm leading-tight">FinSphere</div>
            <div className="text-[11px] text-slate-400 truncate font-medium">{user?.companyName}</div>
          </div>
        </div>
      </div>

      {/* User pill */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 bg-white/[0.06] rounded-xl px-3 py-2.5">
          <div className="w-7 h-7 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className={`fas ${user?.role === 'admin' ? 'fa-shield-halved' : 'fa-user'} text-blue-300 text-xs`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{user?.username}</div>
            <div className="text-[10px] text-slate-400 capitalize">{user?.role}</div>
          </div>
          {user?.plan && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${planColors[user.plan] || 'bg-slate-600 text-slate-200'}`}>
              {user.plan.toUpperCase()}
            </span>
          )}
        </div>
        {/* Expiry warning */}
        {user?.daysRemaining !== undefined && user.daysRemaining <= 7 && (
          <div className={`mt-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 ${user.daysRemaining === 0 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
            <i className="fas fa-clock" />
            {user.daysRemaining === 0 ? 'Subscription expired!' : `${user.daysRemaining} days left`}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {NAV.map(section => {
          const visible = section.items.filter(i => i.roles.includes(user?.role));
          if (!visible.length) return null;
          return (
            <div key={section.group}>
              <div className="sidebar-group-label">{section.group}</div>
              {visible.map(item => (
                <button
                  key={item.key}
                  onClick={() => { onNavigate(item.key); onClose?.(); }}
                  className={`sidebar-link ${activePage === item.key ? 'active' : ''}`}
                >
                  <i className={`fas ${item.icon} w-4 text-center flex-shrink-0 text-sm`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/[0.07] flex-shrink-0">
        <button
          onClick={() => { if (window.confirm('Are you sure you want to logout?')) logout(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-sm font-medium"
        >
          <i className="fas fa-sign-out-alt w-4 text-center text-sm" />
          Logout
        </button>
      </div>
    </div>
  );
}