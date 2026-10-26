import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fs_token');
      localStorage.removeItem('fs_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

export const fmt    = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export const fmtNum = new Intl.NumberFormat('en-IN');

export const dateDisp = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0];
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

export const dateNow = () => new Date().toISOString().split('T')[0];

export const getErrorMsg = (err) =>
  err?.response?.data?.error || err?.message || 'Something went wrong';

export const PLAN_COLORS = {
  trial:    'bg-slate-100 text-slate-600',
  basic:    'bg-blue-100 text-blue-700',
  standard: 'bg-purple-100 text-purple-700',
  premium:  'bg-amber-100 text-amber-700',
};

export const PLAN_LABELS = {
  trial: 'Trial', basic: 'Basic', standard: 'Standard', premium: 'Premium'
};

// "ag01 — Ramesh" (code + name, falls back to username when the agent has no name)
export const agentLabel = (a) =>
  [a?.agentCode, a?.name || a?.username].filter(Boolean).join(' — ') || 'Agent';
