import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [cur, setCur] = useState(''); const [np, setNp] = useState('');
  const [savingPw, setSavingPw] = useState(false); const [pwErr, setPwErr] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState(user?.geminiApiKey ?? '');
  const [geminiModel, setGeminiModel] = useState(user?.geminiModel ?? 'gemini-1.5-pro');
  const [savingGemini, setSavingGemini] = useState(false);

  useEffect(() => { 
    if (user) {
      setName(user.name ?? ''); 
      setGeminiApiKey(user.geminiApiKey ?? '');
      setGeminiModel(user.geminiModel ?? 'gemini-1.5-pro');
    }
  }, [user]);

  if (!user) return null;

  async function saveName() {
    setSavingName(true);
    try { await api.auth.updateProfile({ name }); await refreshUser(); notify('Profile updated.', 'success'); }
    catch { notify('Could not update profile.', 'error'); }
    finally { setSavingName(false); }
  }

  async function saveGemini() {
    setSavingGemini(true);
    try { 
      await api.auth.updateProfile({ geminiApiKey, geminiModel }); 
      await refreshUser(); 
      notify('Gemini configuration updated.', 'success'); 
    }
    catch { notify('Could not update Gemini configuration.', 'error'); }
    finally { setSavingGemini(false); }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault(); setPwErr(null); setSavingPw(true);
    try { await api.auth.changePassword({ currentPassword: cur, newPassword: np }); setCur(''); setNp(''); notify('Password changed. Please sign in again.', 'success'); await logout(); navigate('/login'); }
    catch (e) { setPwErr((e as { message?: string })?.message ?? 'Could not change password.'); }
    finally { setSavingPw(false); }
  }
  async function doDelete() {
    setDeleting(true);
    try { await api.auth.deleteAccount(); await logout(); notify('Your account has been deleted.', 'success'); navigate('/'); }
    catch { notify('Could not delete account.', 'error'); }
    finally { setDeleting(false); }
  }

  return (
    <div className="container page-content" style={{ maxWidth: 720 }}>
      <h1>Profile</h1>
      <p className="hint">Manage your account and security.</p>

      <section className="profile-card">
        <div className="row" style={{ gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
          <span className="profile-avatar" aria-hidden="true"><UserIcon size={22} /></span>
          <div>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <strong>{user.email}</strong>
              {user.role === 'admin' && <Badge variant="brand" icon={<ShieldCheck size={12} />}>admin</Badge>}
            </div>
            <span className="hint">Member since {new Date(user.createdAt ?? Date.now()).toLocaleDateString()}</span>
          </div>
        </div>

        <Field id="display-name" label="Display name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <Button variant="primary" onClick={saveName} loading={savingName}>Save name</Button>
      </section>

      <section className="profile-card">
        <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-18)' }}>✨ Gemini Configuration</h2>
        </div>
        <p className="hint" style={{ marginBottom: '1rem' }}>
          Configure your Gemini API key to enable AI-powered query enhancement. 
          To get your free API key, visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
        </p>
        
        <Field id="gemini-key" label="Gemini API Key" type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." />
        
        <Button variant="primary" onClick={saveGemini} loading={savingGemini}>Save configuration</Button>
      </section>

      <section className="profile-card">
        <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
          <KeyRound size={20} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ margin: 0, fontSize: 'var(--fs-18)' }}>Change password</h2>
        </div>
        {pwErr && <Alert variant="danger">{pwErr}</Alert>}
        <form onSubmit={changePw}>
          <Field id="cur-pw" label="Current password" type="password" required value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <Field id="new-pw" label="New password" type="password" required value={np} onChange={(e) => setNp(e.target.value)} min={8} autoComplete="new-password" hint="8+ characters with letters and numbers." />
          <Button type="submit" variant="secondary" loading={savingPw}>Update password</Button>
        </form>
      </section>

      <section className="profile-card profile-card--danger">
        <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
          <Trash2 size={20} style={{ color: 'var(--danger)' }} />
          <h2 style={{ margin: 0, fontSize: 'var(--fs-18)', color: 'var(--danger)' }}>Delete account</h2>
        </div>
        <p className="hint" style={{ marginBottom: 'var(--s-3)' }}>Permanently delete your account, bookmarks and history. This cannot be undone.</p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete account</Button>
      </section>

      <ConfirmDialog open={confirmDelete} destructive title="Delete your account?" loading={deleting}
        description={<>This permanently deletes your account along with all bookmarks and search history. This action cannot be undone. Type confirmation is not required — simply confirm below if you're sure.</>}
        confirmLabel="Delete forever" onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
