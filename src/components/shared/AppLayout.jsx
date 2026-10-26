import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { InfoBanner } from './index';

/* ── Mobile bottom navigation items ─────────────────────────────────────── */
const BOTTOM_NAV = [
  { page:'dashboard',    icon:'fa-home',            label:'Home'         },
  { page:'transactions', icon:'fa-right-left',      label:'Transactions' },
  { page:'customers',    icon:'fa-users',           label:'Customers'    },
  { page:'reports',      icon:'fa-chart-bar',       label:'Reports'      },
  { page:'settings',     icon:'fa-cog',             label:'More'         },
];

export default function AppLayout({ activePage, onNavigate, children }) {
  const [open, setOpen] = useState(false);
  const { user }        = useAuth();

  const expiredBanner = user?.daysRemaining === 0;
  const warningBanner = user?.daysRemaining > 0 && user?.daysRemaining <= 7;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 shadow-xl">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex-shrink-0 shadow-2xl">
            <Sidebar activePage={activePage} onNavigate={onNavigate} onClose={() => setOpen(false)} />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#111827] text-white shadow-lg flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-bars text-sm" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-chart-line text-white text-xs" />
            </div>
            <span className="font-bold text-sm truncate">{user?.companyName || 'FinSphere'}</span>
          </div>
          {user?.daysRemaining !== undefined && user.daysRemaining <= 7 && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 ${
              user.daysRemaining === 0 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {user.daysRemaining === 0 ? 'EXPIRED' : `${user.daysRemaining}d left`}
            </span>
          )}
        </header>

        {/* Content — extra bottom padding on mobile to clear the bottom nav */}
        <main className="flex-1 overflow-y-auto">
          {(expiredBanner || warningBanner) && (
            <div className="px-4 pt-4">
              <InfoBanner
                type={expiredBanner ? 'danger' : 'warn'}
                message={
                  expiredBanner
                    ? 'Your subscription has expired. Please contact the administrator to renew.'
                    : `Your subscription expires in ${user.daysRemaining} day${user.daysRemaining === 1 ? '' : 's'}. Please renew soon.`
                }
              />
            </div>
          )}
          <div className="p-4 lg:p-6 pb-24 lg:pb-6">{children}</div>
        </main>

        {/* ── Mobile bottom navigation bar ──────────────────────────────────
            Shown only on mobile (lg:hidden). Fixed at the bottom of the
            screen. Five key pages accessible with one tap.               */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-stretch h-16 safe-pb">
            {BOTTOM_NAV.map(item => {
              const active = activePage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-w-0 transition-colors active:scale-95 ${
                    active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {/* Active indicator dot */}
                  <div className={`w-1 h-1 rounded-full mb-0.5 transition-opacity ${
                    active ? 'bg-blue-600 opacity-100' : 'opacity-0'
                  }`}/>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                    active ? 'bg-blue-50 scale-105' : ''
                  }`}>
                    <i className={`fas ${item.icon} text-base`} />
                  </div>
                  <span className={`text-[10px] font-semibold truncate leading-none ${
                    active ? 'text-blue-600' : 'text-slate-400'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

      </div>
    </div>
  );
}
