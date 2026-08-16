import { useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { SearchResultItem } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api';
import { CiteDialog } from './CiteDialog';

interface Props {
  result: SearchResultItem;
  query: string;
  index: number;
  globalIndex: number;
  isBookmarked: (pmid: number | null, text: string) => boolean;
  onBookmarkChange?: () => void;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}

/** Highlight query terms in text by wrapping them in <strong> */
function highlightTerms(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [text];
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <strong key={i}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

export function SearchResultCard({ result, query, index, globalIndex, isBookmarked, onBookmarkChange, selected, onSelect }: Props) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [justSaved, setJustSaved] = useState(false);
  const bookmarked = justSaved || isBookmarked(result.pmid, result.text);
  const [saving, setSaving] = useState(false);
  const [showCite, setShowCite] = useState(false);

  const saveBookmark = useCallback(async () => {
    if (!user) { notify('Sign up or sign in to bookmark results.', 'info'); return; }
    if (bookmarked) { notify('This result is already in your bookmarks.', 'info'); return; }
    setSaving(true);
    try {
      await api.bookmarks.create({
        query, resultText: result.text, score: result.score,
        pmid: result.pmid, pmcid: result.pmcid, section: result.section,
        articleTitle: result.meta?.title ?? null, articleAuthors: result.meta?.authors ?? [],
        articleJournal: result.meta?.journal ?? null, articlePubDate: result.meta?.pubDate ?? null,
      });
      notify('Saved to bookmarks.', 'success');
      setJustSaved(true);
      onBookmarkChange?.();
    } catch (e) {
      notify((e as { message?: string })?.message ?? 'Could not save bookmark.', 'error');
    } finally { setSaving(false); }
  }, [user, bookmarked, query, result, notify, onBookmarkChange]);

  const pmidHref = result.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/` : null;
  const pmcidHref = result.pmid && result.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${result.pmcid}/` : null;
  const openAccess = Boolean(result.pmcid);
  const authors = result.meta?.authors ?? [];
  const authorsText = authors.length > 0 ? authors.join(', ') + '.' : '';
  const journalLine = [
    result.meta?.journal ? result.meta.journal : null,
    result.meta?.pubDate ? result.meta.pubDate : null,
  ].filter(Boolean).join('. ');

  return (
    <>
      <article className="pm-result" aria-labelledby={`result-${index}-title`}>
        {/* Left column: checkbox + number + cite */}
        <div className="pm-result__left">
          <input
            type="checkbox"
            className="pm-result__checkbox"
            checked={selected ?? false}
            onChange={(e) => onSelect?.(e.target.checked)}
            aria-label={`Select result ${globalIndex}`}
          />
          <span className="pm-result__number">{globalIndex}</span>
          <button className="pm-result__cite-btn" onClick={() => setShowCite(true)}>Cite</button>
        </div>

        {/* Main content */}
        <div className="pm-result__main">
          {/* Title */}
          {result.meta?.title ? (
            <h3 id={`result-${index}-title`} className="pm-result__title">
              {pmidHref ? (
                <a href={pmidHref} target="_blank" rel="noopener noreferrer">{result.meta.title}</a>
              ) : result.meta.title}
            </h3>
          ) : (
            <h3 id={`result-${index}-title`} className="pm-result__title pm-result__title--fallback">
              {result.text.slice(0, 120)}...
            </h3>
          )}

          {/* Authors */}
          {authorsText && <p className="pm-result__authors">{authorsText}</p>}

          {/* Journal + citation line */}
          {journalLine && (
            <p className="pm-result__journal">{journalLine}.</p>
          )}

          {/* PMID + PMC + article type row */}
          <p className="pm-result__ids">
            {result.pmid && <span className="pm-result__pmid">PMID: {result.pmid}</span>}
            {openAccess && (
              <a href={pmcidHref ?? '#'} target="_blank" rel="noopener noreferrer" className="pm-result__pmc-link">
                Free PMC article.
              </a>
            )}
            {result.section && <span className="pm-result__type">{result.section}.</span>}
          </p>

          {/* Abstract snippet with highlighted terms */}
          <p className="pm-result__snippet">
            {highlightTerms(result.text, query)}
          </p>

          {/* Bookmark action */}
          <div className="pm-result__actions">
            <button
              className={`pm-result__bookmark-btn ${bookmarked ? 'pm-result__bookmark-btn--saved' : ''}`}
              onClick={saveBookmark}
              disabled={saving}
              title={bookmarked ? 'Already saved' : 'Save to bookmarks'}
            >
              {bookmarked ? '★ Saved' : '☆ Save'}
            </button>
            {pmidHref && (
              <a href={pmidHref} target="_blank" rel="noopener noreferrer" className="pm-result__ext-link">
                View on PubMed <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </article>

      {showCite && <CiteDialog result={result} index={index} onClose={() => setShowCite(false)} />}
    </>
  );
}
