import { ReactNode } from 'react';
import { cx } from '../../lib/utils';
type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export function Badge({ children, variant = 'neutral', icon, title }: { children: ReactNode; variant?: BadgeVariant; icon?: ReactNode; title?: string }) {
  return (
    <span className={cx('badge', `badge--${variant}`)} title={title}>
      {icon && <span className="badge__icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
