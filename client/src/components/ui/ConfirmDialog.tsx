import { ReactNode, useEffect, useRef } from 'react';
import { Button } from './Button';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <div className="dialog" aria-describedby="confirm-desc">
        <div className="dialog__header">
          <h2 id="confirm-title" className="dialog__title">{destructive && <span className="dialog__destr-icon" aria-hidden="true"><AlertTriangle size={20} /></span>}{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onCancel}><X size={20} aria-hidden="true" /></button>
        </div>
        {description && <div id="confirm-desc" className="dialog__body">{description}</div>}
        <div className="dialog__actions">
          <Button ref={confirmRef} variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
