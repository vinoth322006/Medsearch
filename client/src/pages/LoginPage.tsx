import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, sendPasswordResetEmail } from '../lib/firebase';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const redirect = (loc.state as { from?: string })?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function onGoogleLogin() {
    setError(null); setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate(redirect);
    } catch (e: any) {
      setError(e.message || 'Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  }

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
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSent(true);
    } catch (e: any) {
      setForgotError(e.message || 'Could not send reset email.');
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
            
            <button 
              type="button" 
              className="btn btn--block btn--google" 
              onClick={onGoogleLogin} 
              disabled={googleLoading || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </button>

            <div className="auth-divider">or sign in with email</div>
            
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
              <Button type="submit" loading={loading} fullWidth size="lg" disabled={googleLoading}>Sign in</Button>
            </form>
            <p className="auth-foot">New here? <Link to="/signup">Create an account</Link></p>
          </>
        ) : (
          <>
            <h1>Reset password</h1>
            <p className="hint">Enter your email address and we'll send you a link to reset your password.</p>
            {forgotSent ? (
              <Alert variant="success">
                A password reset link has been sent to <strong>{forgotEmail}</strong>. Please check your inbox.
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
