import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api, { getErrorMsg } from '../../utils/api';
import { RegisterFlow, ForgotFlow, ResetFlow } from './AuthFlows';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  // which screen is shown in the card: login | register | forgot | reset (reset = link opened from the email)
  const [view, setView] = useState(window.location.pathname === '/reset-password' ? 'reset' : 'login');
  const { login } = useAuth();
  const toast = useToast();

  const goTo = (v) => {
    if (window.location.pathname === '/reset-password') window.history.replaceState({}, '', '/');
    setView(v);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post('/auth/login', { username, password, rememberMe });
      login(r.data.token, r.data);
      toast.success(`Welcome back, ${r.data.username}!`);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">

      {/* Background ambient glows matching the reference design */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Main container: Split grid on desktop, single column centered on mobile */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column: Branding, Hero copy & features (Hidden or stacked nicely on mobile) */}
        <div className="lg:col-span-7 space-y-8 text-left hidden lg:block pr-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <i className="fas fa-chart-line text-white text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">FinSphere</h2>
              <p className="text-xs text-blue-400 font-medium tracking-wide">Smart Finance. Better Decisions.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Manage <span className="text-blue-500">Today.</span> <br />
              Grow <span className="text-purple-400">Tomorrow.</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
              Track your finances, analyze performance, and make smarter decisions for a better future with enterprise-grade security.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">
                <i className="fas fa-shield-alt text-sm" />
              </div>
              <h4 className="text-white text-xs font-semibold">Bank-grade Security</h4>
              <p className="text-slate-500 text-[11px]">256-bit encryption</p>
            </div>
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
                <i className="fas fa-bolt text-sm" />
              </div>
              <h4 className="text-white text-xs font-semibold">Fast & Reliable</h4>
              <p className="text-slate-500 text-[11px]">99.9% uptime sync</p>
            </div>
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
                <i className="fas fa-chart-pie text-sm" />
              </div>
              <h4 className="text-white text-xs font-semibold">Smart Analytics</h4>
              <p className="text-slate-500 text-[11px]">Advanced reports</p>
            </div>
          </div>
        </div>

        {/* Right Column: Glassmorphism Login Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          
          {/* Mobile Brand Header */}
          <div className="text-center mb-0 lg:hidden">
            </div>
          

          <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative">
            
            {view === 'register' && <RegisterFlow onBack={() => goTo('login')} />}
            {view === 'forgot'   && <ForgotFlow   onBack={() => goTo('login')} />}
            {view === 'reset'    && <ResetFlow    onDone={goTo} />}

            {view === 'login' && (<>
            {/* Card Top Avatar Icon */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/10 shadow-inner">
                <i className="fas fa-user text-blue-400 text-lg" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Welcome Back!</h2>
              <p className="text-slate-400 text-xs mt-1">Sign in to continue to FinSphere</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Username Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <i className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="w-full pl-10 pr-11 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox Option */}
              <div className="flex items-center justify-between text-sm pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-black/20 border-white/20 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-slate-300 text-xs font-medium">Remember me</span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25 mt-2 text-sm"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </span>
                  : <span className="flex items-center justify-center gap-2">
                      <i className="fas fa-sign-in-alt text-xs" />
                      Sign In
                    </span>
                }
              </button>

              {/* Forgot password — directly below the Sign In button */}
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="w-full text-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors pt-1"
              >
                Forgot password?
              </button>

            </form>

            {/* New Register */}
            <div className="mt-5 pt-5 border-t border-white/10">
              <p className="text-center text-slate-400 text-xs mb-3">New to FinSphere?</p>
              <button
                type="button"
                onClick={() => setView('register')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold text-sm transition-all active:scale-[0.98]"
              >
                <i className="fas fa-user-plus text-xs" />
                New Register
                <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-bold">20-day free trial</span>
              </button>
            </div>
            </>)}

            {/* Footer copyright inside/below card */}
            <div className="text-center mt-6 pt-4 border-t border-white/5">
              <p className="text-slate-500 text-[11px]">
                FinSphere &copy; {new Date().getFullYear()} — Secure &amp; Multi-Tenant
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}