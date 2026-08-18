import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search as SearchIcon, X, FilterX } from 'lucide-react';
import { api, SearchResultItem, SearchResponse } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert } from '../components/ui/Alert';
import { SearchResultCard } from '../components/search/SearchResultCard';
import { FilterSidebar } from '../components/search/FilterSidebar';
import { ResultsActionBar } from '../components/search/ResultsActionBar';
import { Pagination } from '../components/search/ResultsActionBar';
import { useFilters } from '../hooks/useFilters';
import { PER_PAGE_OPTIONS, type PerPage } from '../components/search/filterConfig';
import { applyFilters, labelFor, FILTER_GROUP_LABELS, calculateFilterCounts } from '../components/search/applyFilters';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PubMedLogo } from '../components/layout/AppHeader';


function SkeletonCard() {
  return (
    <div className="pm-result pm-result--skeleton" aria-hidden="true">
      <div className="pm-result__left">
        <div className="skeleton" style={{ width: 18, height: 18 }} />
      </div>
      <div className="pm-result__main">
        <div className="skeleton skeleton-text skeleton-text--lg" style={{ width: '80%' }} />
        <div className="skeleton skeleton-text" style={{ width: '50%' }} />
        <div className="skeleton skeleton-text" style={{ width: '70%' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%' }} />
        <div className="skeleton skeleton-text" style={{ width: '90%' }} />
        <div className="skeleton skeleton-text skeleton-text--last" style={{ width: '35%' }} />
      </div>
    </div>
  );
}

/** Sort results based on selected sort option
 */
function sortResults(results: SearchResultItem[], sortBy: string): SearchResultItem[] {
  const copy = [...results];
  switch (sortBy) {
    case 'mostRecent':
      return copy.sort((a, b) => {
        const dateA = a.meta?.pubDate ?? '';
        const dateB = b.meta?.pubDate ?? '';
        return dateB.localeCompare(dateA);
      });
    case 'pubDateAsc':
      return copy.sort((a, b) => {
        const dateA = a.meta?.pubDate ?? '';
        const dateB = b.meta?.pubDate ?? '';
        return dateA.localeCompare(dateB);
      });
    case 'firstAuthor':
      return copy.sort((a, b) => {
        const authA = a.meta?.authors?.[0] ?? '';
        const authB = b.meta?.authors?.[0] ?? '';
        return authA.localeCompare(authB);
      });
    case 'lastAuthor':
      return copy.sort((a, b) => {
        const authA = a.meta?.authors?.slice(-1)[0] ?? '';
        const authB = b.meta?.authors?.slice(-1)[0] ?? '';
        return authA.localeCompare(authB);
      });
    case 'journal':
      return copy.sort((a, b) => {
        const jA = a.meta?.journal ?? '';
        const jB = b.meta?.journal ?? '';
        return jA.localeCompare(jB);
      });
    case 'title':
      return copy.sort((a, b) => {
        const tA = a.meta?.title ?? '';
        const tB = b.meta?.title ?? '';
        return tA.localeCompare(tB);
      });
    case 'bestMatch':
    default:
      return copy; // already sorted by score from SemanticEngine
  }
}

/** Format a list of results as a plain-text bundle for email / clipboard / download. */
function formatItemsAsText(items: SearchResultItem[], query: string): string {
  const header = [
    'MedScholar — Results Export',
    '='.repeat(40),
    '',
    `Search query: ${query}`,
    `Results: ${items.length}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    '='.repeat(40),
    '',
  ].join('\n');

  const blocks = items.map((r, i) => {
    const meta = r.meta;
    const lines: string[] = [];
    lines.push(`[${i + 1}] ${meta?.title ?? r.text.slice(0, 120)}`);
    if (meta?.authors?.length) lines.push(`    Authors: ${meta.authors.join(', ')}`);
    if (meta?.journal) lines.push(`    Journal: ${meta.journal}`);
    if (meta?.pubDate) lines.push(`    Date: ${meta.pubDate}`);
    if (r.pmid) lines.push(`    PMID: ${r.pmid}`);
    if (r.pmcid) lines.push(`    PMCID: ${r.pmcid}`);
    if (meta?.pubType?.length) lines.push(`    Type: ${meta.pubType.join(', ')}`);
    lines.push(`    Confidence: ${Math.round(r.score * 100)}%`);
    if (r.pmid) lines.push(`    URL: https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`);
    if (r.pmcid) lines.push(`    PMC: https://www.ncbi.nlm.nih.gov/pmc/articles/${r.pmcid}/`);
    lines.push('');
    lines.push('    Excerpt:');
    r.text.split('\n').forEach((l) => lines.push('    ' + l));
    lines.push('');
    lines.push('-'.repeat(40));
    return lines.join('\n');
  });

  return header + blocks.join('\n');
}

export function SearchPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize from URL params so navigating back preserves state
  const initialQ = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(initialQ ? 'loading' : 'idle');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQ));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);

  // Sort
  const [sortBy, setSortBy] = useState('bestMatch');

  // Display
  const [displayFormat, setDisplayFormat] = useState('summary');

  // Filters
  const filtersHook = useFilters();
  const { filters, clearAll, activeCount, customRange, yearRange } = filtersHook;

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1); }, [filters, customRange, yearRange]);

  // Selection (for bulk actions)
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => { if (!hasSearched) inputRef.current?.focus(); }, [hasSearched]);

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) { setError('Please enter at least 3 characters.'); return; }
    setError(null); setStatus('loading'); setHasSearched(true); setPage(1);
    setSelected(new Set());
    try {
      const res = await api.search({ query: trimmed, rerank: true });
      setData(res);
      setStatus('success');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Search failed.');
      setStatus('error');
    }
  }, []);

  // Handle URL params for re-running searches, and reset when navigating home
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      run(q);
    } else {
      // Navigated to / without ?q= → reset to homepage
      setHasSearched(false);
      setStatus('idle');
      setData(null);
      setError(null);
      setQuery('');
    }
  }, [location.search, run]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (query.trim().length >= 3) navigate(`/?q=${encodeURIComponent(query.trim())}`); };

  // Calculate matching counts for all filter choices
  const filterCounts = useMemo(() => {
    if (!data?.results) return {};
    return calculateFilterCounts(data.results);
  }, [data?.results]);

  // Process results: sort, then apply filters
  const processedResults = useMemo(() => {
    if (!data?.results) return [];
    const sorted = sortResults(data.results, sortBy);
    return applyFilters(sorted, filters, customRange, yearRange);
  }, [data?.results, sortBy, filters, customRange, yearRange]);

  // Total counts
  const totalRaw = data?.results?.length ?? 0;

  const totalPages = Math.max(1, Math.ceil(processedResults.length / perPage));
  const pagedResults = useMemo(() => {
    const start = (page - 1) * perPage;
    return processedResults.slice(start, start + perPage);
  }, [processedResults, page, perPage]);

  // Year data for sidebar chart
  const yearData = useMemo(() => {
    if (!data?.results) return [];
    const counts: Record<number, number> = {};
    for (const r of data.results) {
      const dateStr = r.meta?.pubDate;
      if (!dateStr) continue;
      const match = dateStr.match(/(\d{4})/);
      if (match) {
        const year = parseInt(match[1], 10);
        counts[year] = (counts[year] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([y, c]) => ({ year: parseInt(y, 10), count: c }))
      .sort((a, b) => a.year - b.year);
  }, [data?.results]);


  const [existingBookmarks, setExistingBookmarks] = useState<Set<string>>(new Set());

  // Fetch existing bookmarks on mount/login
  useEffect(() => {
    if (user) {
      api.bookmarks.list().then(res => {
        const set = new Set<string>();
        res.bookmarks.forEach(b => set.add((b.pmid ?? 'null') + '|' + b.resultText));
        setExistingBookmarks(set);
      }).catch(() => {});
    } else {
      setExistingBookmarks(new Set());
    }
  }, [user]);

  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  
  const isBookmarked = useCallback((_pmid: number | null, text: string) => {
    const key = (_pmid ?? 'null') + '|' + text;
    return justSaved.has(key) || existingBookmarks.has(key);
  }, [justSaved, existingBookmarks]);

  // Update parent justSaved Set when an individual card is bookmarked
  const handleSingleBookmark = useCallback((pmid: number | null, text: string) => {
    const key = (pmid ?? 'null') + '|' + text;
    setJustSaved((prev) => new Set([...prev, key]));
  }, []);
  // ============================================================
  // Bulk actions (Save / Email / Send to) — operate on the
  // checkbox-selected results, or fall back to the entire page.
  // ============================================================
  const [bulkSaving, setBulkSaving] = useState(false);

  const selectedItems = useMemo(() => {
    if (selected.size === 0) return [];
    return pagedResults.filter((_, i) => selected.has((page - 1) * perPage + i + 1));
  }, [pagedResults, selected, page, perPage]);

  const handleBulkSave = useCallback(async (items: SearchResultItem[]) => {
    if (items.length === 0) { notify('No results to save.', 'info'); return; }
    if (!user) { notify('Sign up or sign in to bookmark results.', 'info'); return; }
    setBulkSaving(true);
    const savedKeys: string[] = [];
    let ok = 0;
    let dup = 0;
    let fail = 0;
    await Promise.all(items.map(async (r) => {
      const key = (r.pmid ?? 'null') + '|' + r.text;
      if (justSaved.has(key)) { dup++; return; }
      try {
        await api.bookmarks.create({
          query, resultText: r.text, score: r.score,
          pmid: r.pmid, pmcid: r.pmcid, section: r.section,
          articleTitle: r.meta?.title ?? null, articleAuthors: r.meta?.authors ?? [],
          articleJournal: r.meta?.journal ?? null, articlePubDate: r.meta?.pubDate ?? null,
        });
        savedKeys.push(key);
        ok++;
      } catch {
        fail++;
      }
    }));
    if (savedKeys.length > 0) {
      setJustSaved((prev) => new Set([...prev, ...savedKeys]));
    }
    setBulkSaving(false);
    if (ok > 0 && fail === 0) notify(`Saved ${ok} of ${items.length} result${ok === 1 ? '' : 's'} to bookmarks.`, 'success');
    else if (ok > 0 && fail > 0) notify(`Saved ${ok} of ${items.length} result${ok === 1 ? '' : 's'}; ${fail} failed.`, 'error');
    else if (dup === items.length) notify('All selected results are already saved.', 'info');
    else notify('Could not save bookmarks.', 'error');
  }, [user, justSaved, query, notify]);

  const handleBulkEmail = useCallback((items: SearchResultItem[]) => {
    if (items.length === 0) { notify('No results to email.', 'info'); return; }
    const subject = encodeURIComponent(`MedScholar — ${items.length} result${items.length === 1 ? '' : 's'}`);
    const body = encodeURIComponent(formatItemsAsText(items, query));
    const url = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = url;
    notify(`Opened your email client with ${items.length} result${items.length === 1 ? '' : 's'}.`, 'success');
  }, [query, notify]);

  const handleSendTo = useCallback((action: 'copy' | 'download', items: SearchResultItem[]) => {
    if (items.length === 0) { notify('No results to send.', 'info'); return; }
    const text = formatItemsAsText(items, query);
    if (action === 'copy') {
      try {
        navigator.clipboard.writeText(text).then(
          () => notify(`Copied ${items.length} result${items.length === 1 ? '' : 's'} to clipboard.`, 'success'),
          () => {
            // execCommand fallback for browsers/contexts without Clipboard API
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            notify(`Copied ${items.length} result${items.length === 1 ? '' : 's'} to clipboard.`, 'success');
          },
        );
      } catch {
        notify('Could not copy to clipboard.', 'error');
      }
    } else if (action === 'download') {
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medscholar-results-${items.length}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify(`Downloaded ${items.length} result${items.length === 1 ? '' : 's'} as text.`, 'success');
      } catch {
        notify('Could not generate download.', 'error');
      }
    }
  }, [query, notify]);

  // ============================================================
  // Render: Homepage (no search yet)
  // ============================================================
  if (!hasSearched) {
    return (
      <div className="pm-home">
        <section className="pm-hero" aria-labelledby="pm-hero-title">
          <div className="pm-hero__inner">
            <div className="pm-hero__logo">
              <PubMedLogo white />
            </div>
            <p className="pm-hero__tagline">Advanced Semantic Search Engine</p>
            <form className="pm-hero__form" role="search" onSubmit={onSubmit}>
              <div className="pm-hero__search-box">
                <SearchIcon size={20} className="pm-hero__search-icon" />
                <input
                  ref={inputRef}
                  id="search-query"
                  type="text"
                  className="pm-hero__input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search PubMed — try natural language queries"
                  autoComplete="off"
                  aria-label="Search query"
                />
                {query && (
                  <button type="button" className="pm-hero__clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear">
                    <X size={18} />
                  </button>
                )}
                <button type="submit" className="pm-hero__search-btn">Search</button>
              </div>
            </form>

            <p className="pm-hero__desc">
              Search over 40 million biomedical citations from MEDLINE, life science journals, and online books with AI-powered semantic understanding.
            </p>
          </div>
        </section>

        {/* Feature cards */}
        <section className="pm-home__features container" aria-label="Features">
          <div className="pm-home__feature-grid">
            <button
              id="feature-search"
              className="pm-home__feature-card"
              onClick={() => { inputRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              <span className="pm-home__feature-icon pm-home__feature-icon--search" aria-hidden="true">
                <SearchIcon size={22} />
              </span>
              <span className="pm-home__feature-title">Semantic Search</span>
              <span className="pm-home__feature-desc">AI-powered natural language search across 40M+ PubMed articles.</span>
            </button>
            <Link
              id="feature-bookmarks"
              to={user ? '/bookmarks' : '/signup'}
              className="pm-home__feature-card"
            >
              <span className="pm-home__feature-icon pm-home__feature-icon--bookmarks" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
              </span>
              <span className="pm-home__feature-title">Bookmarks</span>
              <span className="pm-home__feature-desc">Save and organize articles for quick future reference.</span>
            </Link>
            <Link
              id="feature-history"
              to={user ? '/history' : '/signup'}
              className="pm-home__feature-card"
            >
              <span className="pm-home__feature-icon pm-home__feature-icon--history" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <span className="pm-home__feature-title">Search History</span>
              <span className="pm-home__feature-desc">Re-run past searches and track your research over time.</span>
            </Link>
            <Link
              id="feature-account"
              to={user ? '/profile' : '/signup'}
              className="pm-home__feature-card"
            >
              <span className="pm-home__feature-icon pm-home__feature-icon--profile" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span className="pm-home__feature-title">{user ? 'Your Profile' : 'Free Account'}</span>
              <span className="pm-home__feature-desc">{user ? 'Manage your account settings and preferences.' : 'Sign up free to unlock bookmarks, history & more.'}</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // ============================================================
  // Render: Results page (after search)
  // ============================================================
  return (
    <div className="pm-results-page container-wide">
      {/* Action bar: Save | Email | Sort | Pagination */}
      {status === 'success' && data && (
        <ResultsActionBar
          resultCount={processedResults.length}
          sortBy={sortBy}
          onSortChange={(v) => { setSortBy(v); setPage(1); }}
          displayFormat={displayFormat}
          onDisplayFormatChange={setDisplayFormat}
          perPage={perPage}
          onPerPageChange={(v) => { setPerPage(v); setPage(1); }}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedItems={selectedItems}
          currentPageItems={pagedResults}
          onSave={handleBulkSave}
          onEmail={handleBulkEmail}
          onSendTo={handleSendTo}
          saving={bulkSaving}
        />
      )}

      {/* Active filter chips + clear all */}
      {status === 'success' && data && activeCount > 0 && (
        <div className="pm-active-filters" aria-label="Active filters">
          <span className="pm-active-filters__label">
            <FilterX size={14} /> {activeCount} active filter{activeCount === 1 ? '' : 's'}:
          </span>
          {Object.entries(filters).flatMap(([groupKey, values]) =>
            [...values].map((val) => (
              <button
                key={`${groupKey}:${val}`}
                className="pm-active-filters__chip"
                onClick={() => {
                  if (groupKey === 'publicationDate') {
                    if (val === 'custom') {
                      filtersHook.setCustomRange(null);
                    } else {
                      filtersHook.setRadioFilter(groupKey, null);
                    }
                  } else if (groupKey === 'yearRange') {
                    filtersHook.setYearRange(null);
                  } else {
                    filtersHook.toggleFilter(groupKey, val);
                  }
                }}
                aria-label={`Remove ${FILTER_GROUP_LABELS[groupKey] ?? groupKey}: ${labelFor(groupKey, val, customRange)}`}
              >
                {FILTER_GROUP_LABELS[groupKey] ?? groupKey}: <strong>{labelFor(groupKey, val, customRange)}</strong>
                <X size={12} />
              </button>
            )),
          )}
          <button className="pm-active-filters__clear" onClick={clearAll}>Clear all</button>
          <span className="pm-active-filters__count">
            Showing {processedResults.length} of {totalRaw} results
          </span>
        </div>
      )}

      <div className="pm-results-layout">
        {/* Left sidebar: Filters */}
        {status === 'success' && data && (
          <FilterSidebar filtersHook={filtersHook} yearData={yearData} filterCounts={filterCounts} />
        )}

        {/* Main results column */}
        <div className="pm-results-main">
          {/* Loading */}
          {status === 'loading' && (
            <div className="pm-results-loading" role="status" aria-live="polite">
              <p className="pm-results-loading__hint">Searching the database…</p>
              {[0,1,2,3].map((i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <Alert variant="danger">
              {error}{' '}
              <button className="alert-link" onClick={() => run(query)}>Try again</button>
            </Alert>
          )}

          {/* Results */}
          {status === 'success' && data && (
            <>
              {data.degradedMessage && <Alert variant="warning">{data.degradedMessage}</Alert>}
              {pagedResults.length === 0 && (
                <Alert variant="info">
                  {activeCount > 0
                    ? `No results match your current filters (showing 0 of ${totalRaw}). Try removing some filters or clearing all.`
                    : 'No results matched your query. Try rephrasing or using more specific biomedical terms.'}
                </Alert>
              )}

              <ol className="pm-results-list" start={(page - 1) * perPage + 1}>
                {pagedResults.map((r: SearchResultItem, i: number) => {
                  const globalIdx = (page - 1) * perPage + i + 1;
                  const uniqueKey = r.pmid ? `pmid-${r.pmid}` : `idx-${globalIdx}-${r.text.slice(0, 40)}`;
                  return (
                    <li key={uniqueKey} className="pm-results-list__item">
                      <SearchResultCard
                        result={r}
                        query={query}
                        index={i}
                        globalIndex={globalIdx}
                        isBookmarked={isBookmarked}
                        onBookmarkChange={handleSingleBookmark}
                        displayFormat={displayFormat}
                        selected={selected.has(globalIdx)}
                        onSelect={(checked) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(globalIdx); else next.delete(globalIdx);
                            return next;
                          });
                        }}
                      />
                    </li>
                  );
                })}
              </ol>

              {/* Bottom pagination */}
              {totalPages > 1 && (
                <div className="pm-results-bottom-pagination">
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  <label className="pm-per-page">
                    Per page:
                    <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value) as PerPage); setPage(1); }}>
                      {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {/* Sign-up nudge for anonymous users */}
              {!user && data.results.length > 0 && (
                <div className="pm-signup-nudge">
                  <div>
                    <p className="pm-signup-nudge__title">Found something useful?</p>
                    <p className="hint">Create a free account to bookmark results and keep a search history you can re-run anytime.</p>
                  </div>
                  <div className="pm-signup-nudge__actions">
                    <Link to="/signup" className="btn btn--primary btn--sm">Sign up free</Link>
                    <Link to="/login" className="btn btn--outline btn--sm">Sign in</Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
