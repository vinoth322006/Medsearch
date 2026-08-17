import { useEffect, useState, useMemo } from 'react';
import { api, SearchHistoryItem } from '../api';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { History as HistoryIcon, Play, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '../lib/utils';

function dayKey(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toDateString();
}

export function HistoryPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [history, setHistory] = useState<SearchHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try { if (!cancelled) { const { history } = await api.history.list(); setHistory(history); } }
      catch { if (!cancelled) setError('Could not load history.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHistoryItem[]>();
    (history ?? []).forEach((h) => {
      const k = dayKey(h.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    });
    return [...map.entries()];
  }, [history]);

  async function doClear() {
    setClearing(true);
    try { await api.history.clear(); setHistory([]); notify('Search history cleared.', 'success'); setConfirmClear(false); }
    catch { notify('Could not clear history.', 'error'); }
    finally { setClearing(false); }
  }

  async function deleteItem(id: string) {
    try {
      await api.history.remove(id);
      setHistory(prev => (prev || []).filter(h => h.id !== id));
    } catch {
      notify('Could not delete history item.', 'error');
    }
  }

  function rerun(q: string) {
    navigate(`/?q=${encodeURIComponent(q)}`);
  }

  // re-run when arriving with ?q=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) navigate('/', { replace: true, state: { rerun: q } });
  }, [navigate]);

  return (
    <div className="container page-content">
      <div className="row-between page-content__header">
        <div>
          <h1>Search history</h1>
          <p className="hint">{history?.length ?? 0} searches · Tap a query to re-run it instantly.</p>
        </div>
        {(history?.length ?? 0) > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(true)}><Trash2 size={16} />Clear history</button>
        )}
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s-8)' }}><Spinner size={26} /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (history?.length ?? 0) === 0 && (
        <div className="empty-state">
          <HistoryIcon size={40} aria-hidden="true" />
          <h2>No history yet</h2>
          <p className="hint">Your searches will appear here once you perform a search while signed in.</p>
        </div>
      )}

      {!loading && grouped.map(([day, items]) => (
        <section key={day} className="hist-group">
          <h2 className="hist-group__day">{day}</h2>
          <ul className="hist-clean list-clean">
            {items.map((h) => (
              <li key={h.id} className="hist-item">
                <button className="hist-item__run" onClick={() => rerun(h.query)} aria-label={`Re-run search: ${h.query}`}>
                  <Play size={16} aria-hidden="true" />
                </button>
                <div className="hist-item__body">
                  <p className="hist-item__query">{h.query}</p>
                  <span className="hint">{h.resultCount} results · {formatRelative(h.createdAt)}</span>
                </div>
                <button 
                  className="btn btn--ghost btn--icon" 
                  onClick={() => deleteItem(h.id)} 
                  aria-label={`Delete search: ${h.query}`}
                  style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ConfirmDialog open={confirmClear} destructive title="Clear all history?" loading={clearing}
        description={<>This will permanently delete your full search history. Your bookmarks are not affected.</>}
        confirmLabel="Clear all" onConfirm={doClear} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}

