// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl', full:'max-w-6xl' };
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${sizes[size]}`}>
        <div className="modal-header">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-sm">
            <i className="fas fa-times" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Spinner / Loader ─────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const s = { sm:'w-4 h-4 border-2', md:'w-8 h-8 border-2', lg:'w-12 h-12 border-[3px]' };
  return <div className={`${s[size]} border-slate-200 border-t-blue-600 rounded-full animate-spin ${className}`} />;
}
export function PageLoader() {
  return <div className="flex items-center justify-center min-h-[240px]"><Spinner size="lg" /></div>;
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon='fa-inbox', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <i className={`fas ${icon} text-2xl text-slate-300`} />
      </div>
      <h4 className="font-semibold text-slate-600 mb-1">{title}</h4>
      {message && <p className="text-sm text-slate-400 mb-4 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, confirmText='Confirm', type='danger' }) {
  if (!isOpen) return null;
  const colorMap = { danger:'btn-danger', warning:'btn-warning', primary:'btn-primary' };
  const bgMap    = { danger:'bg-red-100', warning:'bg-amber-100', primary:'bg-blue-100' };
  const icMap    = { danger:'text-red-500', warning:'text-amber-500', primary:'text-blue-500' };
  return (
    <div className="modal-backdrop">
      <div className="modal-box max-w-sm">
        <div className="modal-body text-center py-8">
          <div className={`w-14 h-14 ${bgMap[type]} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <i className={`fas fa-exclamation-triangle text-xl ${icMap[type]}`} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} className={`btn ${colorMap[type]} flex-1`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Search Input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder='Search...', className='' }) {
  return (
    <div className={`relative ${className}`}>
      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
      <input className="input pl-8 text-sm" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon, color='blue', sub, onClick }) {
  const colors = {
    blue:'bg-blue-50 text-blue-600 border-blue-100',
    green:'bg-emerald-50 text-emerald-600 border-emerald-100',
    red:'bg-red-50 text-red-500 border-red-100',
    amber:'bg-amber-50 text-amber-600 border-amber-100',
    purple:'bg-purple-50 text-purple-600 border-purple-100',
    slate:'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <div className={`stat-card ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 border ${colors[color]}`}>
        <i className={`fas ${icon} text-sm`} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1 font-medium">{sub}</div>}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = { active:'badge-green', inactive:'badge-slate', closed:'badge-red', suspended:'badge-red' };
  return <span className={`badge ${map[status]||'badge-slate'}`}>{status}</span>;
}

// ─── Info Banner ──────────────────────────────────────────────────────────────
export function InfoBanner({ type='info', message, onClose }) {
  const s = {
    info:   { bg:'bg-blue-50 border-blue-200',  ic:'fa-info-circle text-blue-500',  tx:'text-blue-800' },
    warn:   { bg:'bg-amber-50 border-amber-200', ic:'fa-exclamation-triangle text-amber-500', tx:'text-amber-800' },
    danger: { bg:'bg-red-50 border-red-200',     ic:'fa-times-circle text-red-500',  tx:'text-red-800' },
    success:{ bg:'bg-emerald-50 border-emerald-200', ic:'fa-check-circle text-emerald-600', tx:'text-emerald-800' },
  }[type] || {};
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm mb-4 ${s.bg}`}>
      <i className={`fas ${s.ic} mt-0.5 flex-shrink-0`} />
      <span className={`flex-1 font-medium ${s.tx}`}>{message}</span>
      {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2"><i className="fas fa-times text-xs" /></button>}
    </div>
  );
}
