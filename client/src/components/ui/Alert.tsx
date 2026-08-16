import { ReactNode } from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cx } from '../../lib/utils';
type Variant = 'info' | 'warning' | 'danger' | 'success';
const icon: Record<Variant, ReactNode> = { info: <Info size={18} />, warning: <AlertTriangle size={18} />, danger: <AlertCircle size={18} />, success: <CheckCircle2 size={18} /> };
export function Alert({ variant = 'info', children }: { variant?: Variant; children: ReactNode }) {
  return (
    <div className={cx('alert', `alert--${variant}`)} role="alert">
      <span className="alert__icon" aria-hidden="true">{icon[variant]}</span>
      <span className="alert__msg">{children}</span>
    </div>
  );
}
