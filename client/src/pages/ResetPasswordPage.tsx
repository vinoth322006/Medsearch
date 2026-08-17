import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Eye, EyeOff } from 'lucide-react';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError('Invalid reset link — no token found.'); return; }
    setError(null); setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setSuccess(true);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Alert variant="danger">Invalid reset link — no token found in the URL.</Alert>
          <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="app-header__brand" style={{ marginBottom: 'var(--s-5)' }}>
          <span className="app-header__logo" aria-hidden="true">M</span>
          <span>edSearch</span>
        </Link>
        <h1>Set new password</h1>
        <p className="hint">Enter your new password below.</p>

        {success ? (
          <>
            <Alert variant="success">
              Your password has been reset successfully! You can now sign in with your new password.
            </Alert>
            <div style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
              <button className="btn btn--primary btn--lg btn--block" onClick={() => navigate('/login')}>
                Go to sign in
              </button>
            </div>
          </>
        ) : (
          <>
            {error && <Alert variant="danger">{error}</Alert>}
            <form onSubmit={onSubmit} noValidate>
              <div className="pw-wrap">
                <Field
                  id="new-password"
                  label="New password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  hint="Use 8+ characters with letters and numbers."
                />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button type="submit" loading={loading} fullWidth size="lg">Reset password</Button>
            </form>
          </>
        )}

        <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
