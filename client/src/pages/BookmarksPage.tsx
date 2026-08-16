import { useEffect, useState, useMemo } from 'react';
import { api, Bookmark } from '../api';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { Bookmark as BookmarkIcon, Trash2, ExternalLink, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';

export function BookmarksPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState('');
  const folders = useMemo(() => {
    const f = new Set<string>();
    (bookmarks ?? []).forEach((b) => { if (b.folder) f.add(b.folder); });
    return [...f].sort();
  }, [bookmarks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try { const { bookmarks } = await api.bookmarks.list(); if (!cancelled) setBookmarks(bookmarks); }
      catch { if (!cancelled) setError('Could not load bookmarks.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try { await api.bookmarks.remove(toDelete.id); setBookmarks((b) => (b ?? []).filter((x) => x.id !== toDelete.id)); notify('Bookmark removed.', 'success'); setToDelete(null); }
    catch { notify('Could not delete bookmark.', 'error'); }
    finally { setDeleting(false); }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return bookmarks ?? [];
    return (bookmarks ?? []).filter((b) => b.resultText.toLowerCase().includes(q) || b.query.toLowerCase().includes(q) || (b.articleTitle ?? '').toLowerCase().includes(q));
  }, [bookmarks, filter]);

  return (
    <div className="container page-content">
      <div className="row-between page-content__header">
        <div>
          <h1>Bookmarks</h1>
          <p className="hint">{bookmarks?.length ?? 0} saved results {folders.length > 0 && <>· {folders.length} folder{folders.length > 1 ? 's' : ''}</>}</p>
        </div>
        <input className="filter-input inline-filter" placeholder="Filter bookmarks..." value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter bookmarks" />
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s-8)' }}><Spinner size={26} /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (bookmarks?.length ?? 0) === 0 && (
        <div className="empty-state">
          <BookmarkIcon size={40} aria-hidden="true" />
          <h2>No bookmarks yet</h2>
          <p className="hint">Run a search and tap the bookmark icon next to any result to save it here.</p>
          <button className="btn btn--primary btn--sm" onClick={() => navigate('/')}><Search size={16} />Go to Search</button>
        </div>
      )}
      {!loading && !error && (bookmarks?.length ?? 0) > 0 && filtered.length === 0 && (
        <Alert variant="info">No bookmarks match "{filter}".</Alert>
      )}

      <ul className="list-clean" aria-label="Saved bookmarks">
        {filtered.map((b) => {
          const pmidHref = b.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${b.pmid}/` : null;
          return (
            <li key={b.id} className="bmark">
              <div className="bmark__main">
                {b.articleTitle && <h3 className="bmark__article">{b.articleTitle}</h3>}
                <p className="bmark__text">{b.resultText}</p>
                <div className="bmark__meta">
                  <span className="hint">Query: "{b.query}"</span>
                  {b.section && <Badge variant="neutral">{b.section}</Badge>}
                  <Badge variant="info">Score {b.score.toFixed(3)}</Badge>
                  {pmidHref && <a className="src-card__link" href={pmidHref} target="_blank" rel="noopener noreferrer">PMID: {b.pmid}<ExternalLink size={12} /></a>}
                  {b.articleJournal && <Badge variant="neutral"><i>{b.articleJournal}</i></Badge>}
                </div>
              </div>
              <div className="bmark__aside">
                <button className="icon-btn" aria-label="Delete this bookmark" onClick={() => setToDelete(b)}><Trash2 size={20} style={{ color: 'var(--danger)' }} /></button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!toDelete} destructive title="Delete bookmark?" loading={deleting}
        description={<>This will permanently remove this saved result from your bookmarks. This cannot be undone.</>}
        confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
      />
    </div>
  );
}


