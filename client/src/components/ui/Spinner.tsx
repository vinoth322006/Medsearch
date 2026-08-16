import { Loader2 } from 'lucide-react';
export function Spinner({ label = 'Loading', size = 18 }: { label?: string; size?: number }) {
  return (
    <span className="spinner" role="status">
      <Loader2 size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
