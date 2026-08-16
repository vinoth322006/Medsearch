import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cx } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType }

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div role="region" aria-live="polite" aria-label="Notifications" style={{ position: 'fixed', bottom: 'var(--s-6)', right: 'var(--s-6)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', `toast--${t.type}`)} role="status">
            <span className="toast__icon" aria-hidden="true">
              {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
            </span>
            <span className="toast__msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// styles injected via global toast.css
import '../styles/toast.css';
