import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Eye, EyeOff } from 'lucide-react';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try { await signup(email, password, name || undefined); navigate('/'); }
    catch (e) { setError((e as { message?: string })?.message ?? 'Signup failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="app-header__brand" style={{ marginBottom: 'var(--s-5)' }}>
          <span className="app-header__logo" aria-hidden="true">M</span>
          <span>MedSearch</span>
        </Link>
        <h1>Create your account</h1>
        <p className="hint">Bookmark results and keep a searchable history you can re-run anytime. Free for researchers.</p>
        {error && <Alert variant="danger">{error}</Alert>}
        <form onSubmit={onSubmit} noValidate>
          <Field id="su-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
          <Field id="su-name" label="Name (optional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" />
          <div className="pw-wrap">
            <Field id="su-password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" hint="Use 8+ characters with letters and numbers." />
            <button type="button" className="pw-toggle" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <Button type="submit" loading={loading} fullWidth size="lg">Create account</Button>
        </form>
        <div className="auth-divider">or</div>
        <p className="auth-foot">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
