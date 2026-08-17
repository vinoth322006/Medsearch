import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const redirect = (loc.state as { from?: string })?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try { await login(email, password); navigate(redirect); }
    catch (e) { setError((e as { message?: string })?.message ?? 'Login failed.'); }
    finally { setLoading(false); }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null); setForgotLoading(true);
    try {
      await api.auth.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (e) {
      setForgotError((e as { message?: string })?.message ?? 'Could not process request.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="app-header__brand" style={{ marginBottom: 'var(--s-5)' }}>
          <span className="app-header__logo" aria-hidden="true">M</span>
          <span>edSearch</span>
        </Link>

        {!showForgot ? (
          <>
            <h1>Welcome back</h1>
            <p className="hint">Sign in to access your bookmarks and search history.</p>
            {error && <Alert variant="danger">{error}</Alert>}
            <form onSubmit={onSubmit} noValidate>
              <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
              <div className="pw-wrap">
                <Field id="password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: 'right', marginBottom: 'var(--s-3)' }}>
                <button type="button" className="link-btn" style={{ fontSize: 'var(--fs-13)' }} onClick={() => { setShowForgot(true); setForgotEmail(email); }}>
                  Forgot password?
                </button>
              </div>
              <Button type="submit" loading={loading} fullWidth size="lg">Sign in</Button>
            </form>
            <div className="auth-divider">or</div>
            <p className="auth-foot">New here? <Link to="/signup">Create an account</Link></p>
          </>
        ) : (
          <>
            <h1>Reset password</h1>
            <p className="hint">Enter your email address and we'll send you a link to reset your password.</p>
            {forgotSent ? (
              <Alert variant="success">
                If an account exists for <strong>{forgotEmail}</strong>, a password reset link has been generated. Check your server console (dev) or email (production).
              </Alert>
            ) : (
              <>
                {forgotError && <Alert variant="danger">{forgotError}</Alert>}
                <form onSubmit={onForgot} noValidate>
                  <Field id="forgot-email" label="Email" type="email" autoComplete="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@university.edu" />
                  <Button type="submit" loading={forgotLoading} fullWidth size="lg">Send reset link</Button>
                </form>
              </>
            )}
            <div style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
              <button type="button" className="link-btn" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotError(null); }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
