import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const base = 'btn';
const variantCls: Record<Variant, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
};
const sizeCls: Record<Size, string> = { sm: 'btn--sm', md: 'btn--md', lg: 'btn--lg' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className, disabled, children, ...rest }, ref
) {
  return (
    <button
      ref={ref}
      className={cx(base, variantCls[variant], sizeCls[size], fullWidth && 'btn--block', loading && 'btn--loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 size={16} aria-hidden="true" className="btn__spinner" />}
      {children}
    </button>
  );
});
