import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';
import { cx } from '../../lib/utils';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, required, type = 'text', ...rest }, ref
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descId = `${fieldId}-desc`;
  const errId = `${fieldId}-err`;
  const describedBy = [error? errId : null, hint ? descId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field__label">
        {label}{required && <span aria-hidden="true" className="field__req"> *</span>}
      </label>
      <input
        ref={ref}
        id={fieldId}
        type={type}
        required={!!required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx('field__input', error && 'field__input--error', className)}
        {...rest}
      />
      {hint && !error && <p id={descId} className="field__hint">{hint}</p>}
      {error && <p id={errId} className="field__error" role="alert">{error}</p>}
    </div>
  );
});
