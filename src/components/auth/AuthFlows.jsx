import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api, { getErrorMsg } from '../../utils/api';

/* ─────────────────────────────────────────────────────────────────────────────
   New Register (email + OTP, 20-day free trial) · Forgot Password · Reset Password
   Shown inside the login card (see LoginPage.jsx).
───────────────────────────────────────────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const inputCls = 'w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';
const labelCls = 'block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider';
const primaryBtn = 'w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25 text-sm';

function Field({ label, icon, hint, right, ...props }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <i className={`fas ${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm`} />
        <input className={`${inputCls} ${right ? 'pr-11' : ''}`} {...props} />
        {right}
      </div>
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, autoComplete = 'new-password', hint }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label} icon="fa-lock" type={show ? 'text' : 'password'} value={value} onChange={onChange}
      placeholder={placeholder} autoComplete={autoComplete} required hint={hint}
      right={
        <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
          <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
        </button>
      }
    />
  );
}

function Header({ icon, title, subtitle, badge }) {
  return (
    <div className="text-center mb-6">
      <div className="w-14 h-14 bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/10 shadow-inner">
        <i className={`fas ${icon} text-blue-400 text-lg`} />
      </div>
      <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
      {badge && <span className="inline-block mt-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">{badge}</span>}
    </div>
  );
}

function BackLink({ onClick, children = 'Back to Sign In' }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white transition-colors pt-2">
      <i className="fas fa-arrow-left mr-1.5 text-[10px]" />{children}
    </button>
  );
}

const Spin = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block align-middle mr-2" />;

/* ════════════════════════ NEW REGISTER ════════════════════════════════════ */
export function RegisterFlow({ onBack }) {
  const { login } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);                       // 1 = details, 2 = OTP
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ companyName: '', adminName: '', email: '', mobile: '', adminUsername: '', password: '', confirm: '' });
  const [regId, setRegId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {                                          // resend countdown
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleError = err => {
    toast.error(getErrorMsg(err));
    if (err?.response?.data?.code === 'REGISTRATION_EXPIRED') { setStep(1); setOtp(''); }
  };

  const sendDetails = async e => {
    e.preventDefault();
    if (!EMAIL_RE.test(form.email.trim())) return toast.error('Enter a valid email address');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      const r = await api.post('/auth/register/request', payload);
      setRegId(r.data.registrationId);
      setMaskedEmail(r.data.email);
      setCooldown(r.data.resendAfterSeconds || 60);
      setOtp('');
      setStep(2);
      toast.success('Verification code sent to your email');
    } catch (err) { handleError(err); }
    finally { setBusy(false); }
  };

  const verify = async e => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit code');
    setBusy(true);
    try {
      const r = await api.post('/auth/register/verify', { registrationId: regId, otp });
      login(r.data.token, r.data);                           // signed in → App shows the dashboard
      toast.success(r.data.message || 'Welcome! Your 20-day free trial has started.');
    } catch (err) { handleError(err); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const r = await api.post('/auth/register/resend', { registrationId: regId });
      setCooldown(r.data.resendAfterSeconds || 60);
      setOtp('');
      toast.success('A new code has been sent');
    } catch (err) { handleError(err); }
    finally { setBusy(false); }
  };

  /* ── step 2: enter OTP ── */
  if (step === 2) {
    return (
      <>
        <Header icon="fa-envelope-open-text" title="Verify your email"
          subtitle={<>We sent a 6-digit code to <span className="text-white font-semibold">{maskedEmail}</span></>} />
        <form onSubmit={verify} className="space-y-4">
          <div>
            <label className={labelCls}>Verification Code</label>
            <input
              className="w-full text-center tracking-[0.6em] text-2xl font-bold py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" autoFocus
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <p className="text-[11px] text-slate-500 mt-1.5 text-center">Valid for 10 minutes. Check your spam folder too.</p>
          </div>
          <button type="submit" disabled={busy || otp.length !== 6} className={primaryBtn}>
            {busy ? <><Spin />Verifying…</> : <><i className="fas fa-check-circle mr-2 text-xs" />Verify &amp; Start Free Trial</>}
          </button>
          <div className="text-center text-xs">
            {cooldown > 0
              ? <span className="text-slate-500">Resend code in {cooldown}s</span>
              : <button type="button" onClick={resend} disabled={busy} className="font-semibold text-blue-400 hover:text-blue-300">Resend code</button>}
          </div>
          <BackLink onClick={() => { setStep(1); setOtp(''); }}>Change email / details</BackLink>
        </form>
      </>
    );
  }

  /* ── step 1: details ── */
  return (
    <>
      <Header icon="fa-user-plus" title="Create your account" subtitle="Set up your company in a minute" badge="20-day FREE trial" />
      <form onSubmit={sendDetails} className="space-y-3.5">
        <Field label="Company Name" icon="fa-building" value={form.companyName} onChange={e => f('companyName', e.target.value)} placeholder="e.g. Sunrise Finance" required autoFocus />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Your Name" icon="fa-user" value={form.adminName} onChange={e => f('adminName', e.target.value)} placeholder="Owner name" required />
          <Field label="Mobile (optional)" icon="fa-phone" type="tel" value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="Mobile number" />
        </div>
        <Field label="Email Address" icon="fa-envelope" type="email" value={form.email} onChange={e => f('email', e.target.value)}
          placeholder="you@company.com" required autoComplete="email" hint="We will send a verification code to this email." />
        <Field label="Choose Username" icon="fa-at" value={form.adminUsername} onChange={e => f('adminUsername', e.target.value.replace(/\s/g, ''))}
          placeholder="Login username" required autoComplete="username" hint="3–30 letters, numbers, . - _" />
        <PasswordField label="Password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="At least 6 characters" />
        <PasswordField label="Confirm Password" value={form.confirm} onChange={e => f('confirm', e.target.value)} placeholder="Re-enter password" />
        <button type="submit" disabled={busy} className={`${primaryBtn} mt-1`}>
          {busy ? <><Spin />Sending code…</> : <><i className="fas fa-paper-plane mr-2 text-xs" />Send Verification Code</>}
        </button>
        <BackLink onClick={onBack} />
      </form>
    </>
  );
}

/* ════════════════════════ FORGOT PASSWORD ═════════════════════════════════ */
export function ForgotFlow({ onBack }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return toast.error('Enter a valid email address');
    setBusy(true);
    try {
      const r = await api.post('/auth/forgot-password', { email: email.trim() });
      setSentTo(r.data.email);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setBusy(false); }
  };

  if (sentTo) {
    return (
      <>
        <Header icon="fa-paper-plane" title="Check your email"
          subtitle={<>We sent a password reset link to <span className="text-white font-semibold">{sentTo}</span></>} />
        <div className="text-xs text-slate-400 bg-black/20 border border-white/10 rounded-xl p-3.5 space-y-1.5 mb-4">
          <p><i className="fas fa-clock text-blue-400 mr-2" />The link is valid for 30 minutes and works once.</p>
          <p><i className="fas fa-folder-open text-blue-400 mr-2" />Not there? Look in your spam / junk folder.</p>
        </div>
        <button type="button" onClick={() => setSentTo('')} className="w-full text-center text-xs font-semibold text-blue-400 hover:text-blue-300 mb-1">Use a different email</button>
        <BackLink onClick={onBack} />
      </>
    );
  }

  return (
    <>
      <Header icon="fa-key" title="Forgot password?" subtitle="Enter your registered email and we'll send you a reset link" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Registered Email" icon="fa-envelope" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" required autoFocus autoComplete="email" />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? <><Spin />Sending…</> : <><i className="fas fa-link mr-2 text-xs" />Send Reset Link</>}
        </button>
        <BackLink onClick={onBack} />
      </form>
    </>
  );
}

/* ════════════════════════ RESET PASSWORD (from the email link) ════════════ */
export function ResetFlow({ onDone }) {
  const toast = useToast();
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [state, setState] = useState('checking');            // checking | ready | invalid | done
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); setError('This reset link is invalid. Please request a new one.'); return; }
    api.get('/auth/reset-password/validate', { params: { token } })
      .then(() => setState('ready'))
      .catch(err => { setState('invalid'); setError(getErrorMsg(err)); });
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setState('done');
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setBusy(false); }
  };

  if (state === 'checking') {
    return <div className="text-center text-slate-400 text-sm py-10"><Spin />Checking your link…</div>;
  }
  if (state === 'invalid') {
    return (
      <>
        <Header icon="fa-link-slash" title="Link not valid" subtitle={error} />
        <button type="button" onClick={() => onDone('forgot')} className={primaryBtn}>Request a new link</button>
        <BackLink onClick={() => onDone('login')} />
      </>
    );
  }
  if (state === 'done') {
    return (
      <>
        <Header icon="fa-circle-check" title="Password updated" subtitle="You can now sign in with your new password." />
        <button type="button" onClick={() => onDone('login')} className={primaryBtn}>Go to Sign In</button>
      </>
    );
  }
  return (
    <>
      <Header icon="fa-lock" title="Set a new password" subtitle="Choose a strong password you don't use elsewhere" />
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label="New Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
        <PasswordField label="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? <><Spin />Saving…</> : 'Update Password'}
        </button>
        <BackLink onClick={() => onDone('login')} />
      </form>
    </>
  );
}
