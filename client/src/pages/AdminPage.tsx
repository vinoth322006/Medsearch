import { useEffect, useState } from 'react';
import { api, AnalyticsOverview, AdminUser } from '../api';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { Users, Activity, HeartPulse, TrendingUp, Database, ShieldOff, Lock, Trash2, UserCog } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

export function AdminPage() {
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [topTerms, setTopTerms] = useState<{ term: string; count: number }[]>([]);
  const [termView, setTermView] = useState<'aggregate' | 'none'>('aggregate');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Obtain current admin's own id from the users list after load
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [an, us, tt] = await Promise.all([api.admin.analytics(), api.admin.users(), api.admin.topTerms(30)]);
        if (cancelled) return;
        setAnalytics(an); setUsers(us.users); setTopTerms(tt.topTerms);
        setTermView(tt.attributed ? 'aggregate' : 'aggregate');
        // Identify the current admin from the session
        try { const me = await api.auth.me(); if (!cancelled) setSelfId(me.user.id); } catch { /* ignore */ }
      } catch { if (!cancelled) setError('Could not load admin data.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(u: AdminUser) {
    setTogglingId(u.id);
    try {
      await api.admin.setUserActive(u.id, !u.active);
      setUsers((prev) => (prev ?? []).map((x) => x.id === u.id ? { ...x, active: !x.active } : x));
      notify(`${u.email} ${u.active ? 'deactivated' : 'reactivated'}.`, 'success');
    } catch { notify('Could not update user.', 'error'); }
    finally { setTogglingId(null); }
  }

  async function changeRole(u: AdminUser, newRole: 'user' | 'admin') {
    if (newRole === u.role) return;
    setChangingRoleId(u.id);
    try {
      await api.admin.setUserRole(u.id, newRole);
      setUsers((prev) => (prev ?? []).map((x) => x.id === u.id ? { ...x, role: newRole } : x));
      notify(`${u.email} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}.`, 'success');
    } catch { notify('Could not change role.', 'error'); }
    finally { setChangingRoleId(null); }
  }

  async function deleteUser(u: AdminUser) {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      await api.admin.deleteUser(u.id);
      setUsers((prev) => (prev ?? []).filter((x) => x.id !== u.id));
      notify(`${u.email} has been deleted.`, 'success');
    } catch { notify('Could not delete user.', 'error'); }
    finally { setDeletingId(null); }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s-12)' }}><Spinner size={28} /></div>;
  if (error) return <div className="container" style={{ paddingTop: 'var(--s-6)' }}><Alert variant="danger">{error}</Alert></div>;
  if (!analytics || !users) return null;

  const chartData = analytics.dailyTrend.map((d) => ({ day: d.day.slice(5), count: d.count }));
  const pieData = [
    { name: 'Anonymous', value: analytics.totals.anonSearches },
    { name: 'Authenticated', value: analytics.totals.authedSearches },
  ];
  const healthPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="container page-content">
      <div className="row-between page-content__header" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1>Admin dashboard</h1>
          <p className="hint">System usage and health metrics.</p>
        </div>
        <Badge variant="info" icon={<Lock size={12} />}>Privacy: anonymized by default</Badge>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <KPI label="Total searches" value={analytics.totals.totalSearches.toLocaleString()} icon={<Activity size={18} />} sub={`${analytics.totals.searches1d.toLocaleString()} today · ${analytics.totals.searches7d.toLocaleString()} this week`} />
        <KPI label="Users" value={analytics.totals.totalUsers.toLocaleString()} icon={<Users size={18} />} sub={`${analytics.totals.activeUsers7d} active 7d · ${analytics.totals.activeUsers30d} active 30d`} />
        <KPI label="SemanticEngine success" value={healthPct(analytics.health.semanticEngineSuccessRate)} icon={<HeartPulse size={18} />} tone={analytics.health.semanticEngineSuccessRate > 0.95 ? 'good' : 'warn'} />
        <KPI label="Cache hit rate" value={healthPct(analytics.health.cacheHitRate)} icon={<Database size={18} />} sub={`${analytics.health.cacheHits} cache hits`} />
        <KPI label="Avg latency" value={`${analytics.health.avgLatencyMs}ms`} icon={<TrendingUp size={18} />} />
      </div>

      {/* Trend */}
      <section className="card chart-card">
        <h2>Searches over time</h2>
        <p className="hint">Daily search count, last 30 days.</p>
        <div className="chart-frame" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--text-subtle)" fontSize={12} tickMargin={6} aria-label="Day" />
              <YAxis stroke="var(--text-subtle)" fontSize={12} allowDecimals={false} aria-label="Search count" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="var(--brand-500)" strokeWidth={2.5} dot={false} name="Searches" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Anon vs auth */}
      <section className="card chart-card">
        <h2>Anonymous vs authenticated</h2>
        <p className="hint">Cumulative split across all searches.</p>
        <div className="chart-frame" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pieData} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-subtle)" fontSize={12} tickMargin={6} />
              <YAxis stroke="var(--text-subtle)" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="value" name="Searches" fill="var(--brand-500)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top terms */}
      <section className="card chart-card">
        <div className="row-between" style={{ marginBottom: 'var(--s-2)' }}>
          <div>
            <h2>Most common query themes</h2>
            <p className="hint">Aggregated from logged-in users' search history · <strong>not attributed to individuals</strong>.</p>
          </div>
          <Badge variant="neutral" icon={<ShieldOff size={12} />}>anonymized</Badge>
        </div>
        <div className="terms-cloud">
          {topTerms.length === 0 && <Alert variant="info">No query-term data yet.</Alert>}
          {topTerms.map((t) => (
            <span key={t.term} className="term-pill" title={`${t.count} occurrences`}>{t.term}<b>{t.count}</b></span>
          ))}
        </div>
        <input type="hidden" value={termView} readOnly />
      </section>

      {/* User management */}
      <section className="card">
        <div className="row-between" style={{ marginBottom: 'var(--s-3)' }}>
          <div><h2>Users</h2><p className="hint">{users.length} registered accounts. Bookmark contents and raw query text are <strong>not shown</strong> by default.</p></div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Email</th><th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th><th scope="col">Searches</th><th scope="col">Bookmarks</th>
                <th scope="col">Last active</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === selfId;
                return (
                  <tr key={u.id}>
                    <td><strong>{u.email}</strong></td>
                    <td>{u.name || <span className="subtle">—</span>}</td>
                    <td>
                      <select
                        id={`role-select-${u.id}`}
                        className="role-select"
                        value={u.role}
                        disabled={isSelf || changingRoleId === u.id}
                        aria-label={`Change role for ${u.email}`}
                        onChange={(e) => changeRole(u, e.target.value as 'user' | 'admin')}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{u.active ? <Badge variant="success">active</Badge> : <Badge variant="danger">inactive</Badge>}</td>
                    <td>{u._count.searches}</td>
                    <td>{u._count.bookmarks}</td>
                    <td>{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : <span className="subtle">—</span>}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', gap: 'var(--s-1)', alignItems: 'center' }}>
                      <button className="btn btn--ghost btn--sm" disabled={togglingId === u.id || isSelf}
                        onClick={() => toggleActive(u)} aria-pressed={u.active}
                        aria-label={u.active ? `Deactivate ${u.email}` : `Reactivate ${u.email}`}>
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        id={`delete-user-${u.id}`}
                        className="btn btn--ghost btn--sm btn--danger"
                        disabled={deletingId === u.id || isSelf}
                        onClick={() => deleteUser(u)}
                        aria-label={`Delete ${u.email}`}
                        title={isSelf ? 'Cannot delete your own account' : `Delete ${u.email}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, icon, sub, tone }: { label: string; value: string; icon: React.ReactNode; sub?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={`kpi-card ${tone === 'warn' ? 'kpi-card--warn' : tone === 'good' ? 'kpi-card--good' : ''}`}>
      <div className="kpi-card__top">
        <span className="kpi-card__icon" aria-hidden="true">{icon}</span>
        <span className="kpi-card__label">{label}</span>
      </div>
      <div className="kpi-card__value">{value}</div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  );
}
