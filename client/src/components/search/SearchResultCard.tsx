import { useState, useCallback } from 'react';
import { ExternalLink, Lock, Unlock, FileText, Bookmark } from 'lucide-react';
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
  onBookmarkChange?: (pmid: number | null, text: string) => void;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  displayFormat?: string;
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

/** Convert 0-1 similarity score → { pct, level, label } for accessible display */
function scoreInfo(score: number): { pct: number; level: 'high' | 'med' | 'low'; label: string } {
  const pct = Math.round(score * 100);
  if (pct >= 85) return { pct, level: 'high', label: 'Very high confidence' };
  if (pct >= 70) return { pct, level: 'med', label: 'High confidence' };
  if (pct >= 55) return { pct, level: 'low', label: 'Moderate confidence' };
  return { pct, level: 'low', label: 'Low confidence' };
}

export function SearchResultCard({ result, query, index, globalIndex, isBookmarked, onBookmarkChange, selected, onSelect, displayFormat = 'summary' }: Props) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [justSaved, setJustSaved] = useState(false);
  const bookmarked = justSaved || isBookmarked(result.pmid, result.text);
  const [saving, setSaving] = useState(false);
  const [showCite, setShowCite] = useState(false);

  const fmt = displayFormat;

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
      onBookmarkChange?.(result.pmid, result.text);
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

  const score = scoreInfo(result.score);

  // ---- PMID-only format: minimal one-line rows ----
  if (fmt === 'pmid') {
    return (
      <article className="pm-result pm-result--compact" aria-labelledby={`result-${index}-title`}>
        <div className="pm-result__left">
          <input type="checkbox" className="pm-result__checkbox" checked={selected ?? false} onChange={(e) => onSelect?.(e.target.checked)} aria-label={`Select result ${globalIndex}`} />
          <span className="pm-result__number">{globalIndex}</span>
        </div>
        <div className="pm-result__main">
          <h3 id={`result-${index}-title`} className="pm-result__title">
            {pmidHref ? <a href={pmidHref} target="_blank" rel="noopener noreferrer">{result.meta?.title ?? result.text.slice(0, 80)}</a> : (result.meta?.title ?? result.text.slice(0, 80))}
          </h3>
          <p className="pm-result__ids">
            <span className={`pm-access-badge pm-access-badge--${openAccess ? 'open' : 'closed'}`}>
              {openAccess ? <Unlock size={11} aria-hidden="true" /> : <Lock size={11} aria-hidden="true" />}
              <span>{openAccess ? 'OA' : 'Closed'}</span>
            </span>
            {result.pmid && <span className="pm-result__pmid">PMID: {result.pmid}</span>}
            <span className={`pm-score-badge pm-score-badge--${score.level}`} role="img" aria-label={`Confidence ${score.pct} percent`}><span className="pm-score-badge__dot" />{score.pct}%</span>
          </p>
        </div>
      </article>
    );
  }

  // ---- Summary (text) format: no card chrome, just title + snippet + ids ----
  if (fmt === 'summaryText') {
    return (
      <article className="pm-result pm-result--text" aria-labelledby={`result-${index}-title`}>
        <div className="pm-result__main">
          <h3 id={`result-${index}-title`} className="pm-result__title">
            {pmidHref ? <a href={pmidHref} target="_blank" rel="noopener noreferrer">{result.meta?.title ?? result.text.slice(0, 120)}</a> : (result.meta?.title ?? result.text.slice(0, 120))}
          </h3>
          {authorsText && <p className="pm-result__authors">{authorsText}</p>}
          {journalLine && <p className="pm-result__journal">{journalLine}.</p>}
          <p className="pm-result__snippet">{highlightTerms(result.text, query)}</p>
          <p className="pm-result__ids">
            <span className={`pm-access-badge pm-access-badge--${openAccess ? 'open' : 'closed'}`} title={openAccess ? 'Open access' : 'Closed access'}>
              {openAccess ? <Unlock size={11} aria-hidden="true" /> : <Lock size={11} aria-hidden="true" />} <span>{openAccess ? 'Open access' : 'Closed'}</span>
            </span>
            {result.pmid && <span className="pm-result__pmid">PMID: {result.pmid}</span>}
            <span className={`pm-score-badge pm-score-badge--${score.level}`} role="img" aria-label={`Confidence ${score.pct} percent`}><span className="pm-score-badge__dot" />{score.pct}%</span>
          </p>
        </div>
      </article>
    );
  }

  // ---- Abstract format: emphasis on the full snippet, less chrome ----
  const isAbstract = fmt === 'abstract';

  return (
    <>
      <article className={`pm-result ${isAbstract ? 'pm-result--abstract' : ''}`} aria-labelledby={`result-${index}-title`}>
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
          {/* Top row: open-access badge + confidence score */}
          <div className="pm-result__meta-row">
            <span
              className={`pm-access-badge pm-access-badge--${openAccess ? 'open' : 'closed'}`}
              title={openAccess ? 'Open access — full text available in PubMed Central' : 'Closed access — abstract only'}
              aria-label={openAccess ? 'Open access article' : 'Closed access article'}
            >
              {openAccess ? <Unlock size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
              <span>{openAccess ? 'Open access' : 'Closed'}</span>
            </span>

            <span
              className={`pm-score-badge pm-score-badge--${score.level}`}
              role="img"
              aria-label={`Confidence ${score.pct} percent — ${score.label}`}
              title={`${score.label}: ${score.pct}%`}
            >
              <span className="pm-score-badge__dot" aria-hidden="true" />
              {score.pct}% match
            </span>
          </div>

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

          {/* Abstract snippet with highlighted terms (full text in abstract mode) */}
          <p className="pm-result__snippet">
            {highlightTerms(isAbstract ? result.text : result.text.slice(0, 400) + (result.text.length > 400 ? '…' : ''), query)}
          </p>

          {/* Action row — Save, Full text (open access), PubMed */}
          <div className="pm-result__actions">
            <button
              className={`pm-result__action-btn pm-result__action-btn--save ${bookmarked ? 'pm-result__action-btn--saved' : ''}`}
              onClick={saveBookmark}
              disabled={saving}
              aria-pressed={bookmarked}
              title={bookmarked ? 'Already saved' : 'Save to bookmarks'}
            >
              <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
              {bookmarked ? 'Saved' : 'Save'}
            </button>

            {openAccess && pmcidHref && (
              <a
                href={pmcidHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pm-result__action-btn pm-result__action-btn--link"
                title="Open full text in PubMed Central"
              >
                <FileText size={14} aria-hidden="true" />
                <span>Full text</span>
              </a>
            )}

            {pmidHref && (
              <a href={pmidHref} target="_blank" rel="noopener noreferrer" className="pm-result__action-btn pm-result__action-btn--link pm-result__ext-link">
                PubMed <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </article>

      {showCite && <CiteDialog result={result} index={index} onClose={() => setShowCite(false)} />}
    </>
  );
}
