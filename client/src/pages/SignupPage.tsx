import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, createUserWithEmailAndPassword, sendEmailVerification } from '../lib/firebase';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

function calculateStrength(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const getStrengthLabel = (score: number) => {
  switch (score) {
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    default: return '';
  }
};

export function SignupPage() {
  const { loginWithGoogle, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Verification step state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // If waiting for verification, check auth state occasionally or let user press a button
    let interval: ReturnType<typeof setInterval>;
    if (needsVerification && auth.currentUser) {
      interval = setInterval(async () => {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(interval);
          handleVerified();
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [needsVerification]);

  async function handleVerified() {
    setIsVerifying(true);
    try {
      // Create user on our backend now that they are verified
      await signup(email, password, name || undefined);
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Error finalizing signup');
    } finally {
      setIsVerifying(false);
    }
  }

  async function onGoogleLogin() {
    setError(null); setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try { 
      // Instead of immediate signup, we create Firebase user first for OTP
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setNeedsVerification(true);
    } catch (e: any) { 
      setError(e.message || 'Signup failed.'); 
    } finally { 
      setLoading(false); 
    }
  }
  
  async function resendVerification() {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        alert('Verification email resent.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to resend email');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="app-header__brand" style={{ marginBottom: 'var(--s-5)' }}>
          <span className="app-header__logo" aria-hidden="true">M</span>
          <span>edSearch</span>
        </Link>
        
        {needsVerification ? (
          <div className="verification-step">
            <h1>Verify your email</h1>
            <p className="hint">
              We've sent a verification link to <strong>{email}</strong>. 
              Please click the link in that email to continue.
            </p>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <div className="verify-spinner-wrap">
               <RefreshCw className={`spinner ${isVerifying ? 'spin' : ''}`} size={32} color="var(--pm-navy)" />
               <p>{isVerifying ? 'Finalizing setup...' : 'Waiting for verification...'}</p>
            </div>

            <div style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
              <button type="button" className="btn btn--outline" onClick={resendVerification}>
                Resend email
              </button>
            </div>
            
            <div style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
              <button type="button" className="link-btn" onClick={() => { setNeedsVerification(false); auth.signOut(); }}>
                ← Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1>Create your account</h1>
            <p className="hint">Bookmark results and keep a searchable history you can re-run anytime. Free for researchers.</p>
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
              {googleLoading ? 'Signing in...' : 'Sign up with Google'}
            </button>

            <div className="auth-divider">or sign up with email</div>
            
            <form onSubmit={onSubmit} noValidate>
              <Field id="su-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
              <Field id="su-name" label="Name (optional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" />
              <div className="pw-wrap" style={{ marginBottom: password ? 0 : 'var(--s-4)' }}>
                <Field id="su-password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" hint="Use 8+ characters with letters and numbers." />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {password && (
                  <div className="pw-strength">
                    <div className="pw-bars">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`pw-bar ${calculateStrength(password) >= level ? `active-${calculateStrength(password)}` : ''}`}
                        />
                      ))}
                    </div>
                    <div className="pw-label">{getStrengthLabel(calculateStrength(password))}</div>
                  </div>
                )}
              </div>
              <Button type="submit" loading={loading} fullWidth size="lg" disabled={googleLoading}>Create account</Button>
            </form>
            <p className="auth-foot">Already have an account? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
