import { createContext, useContext, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3800);
  }, []);

  const toast = { success: m => add(m,'success'), error: m => add(m,'error'), info: m => add(m,'info'), warn: m => add(m,'warn') };

  const icons = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle', warn:'fa-exclamation-triangle' };
  const colors = { success:'bg-emerald-600', error:'bg-red-500', info:'bg-blue-600', warn:'bg-amber-500' };

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium pointer-events-auto animate-[toastIn_0.3s_ease] ${colors[t.type]}`}>
            <i className={`fas ${icons[t.type]} mt-0.5 flex-shrink-0`} />
            <span className="flex-1 leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
