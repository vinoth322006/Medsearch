import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { api, SearchResultItem, SearchResponse } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/Alert';
import { SearchResultCard } from '../components/search/SearchResultCard';
import { FilterSidebar } from '../components/search/FilterSidebar';
import { ResultsActionBar } from '../components/search/ResultsActionBar';
import { Pagination } from '../components/search/ResultsActionBar';
import { useFilters } from '../hooks/useFilters';
import { PER_PAGE_OPTIONS, type PerPage } from '../components/search/filterConfig';
import { Link, useLocation } from 'react-router-dom';
import { PubMedLogo } from '../components/layout/AppHeader';

const SAMPLE_QUERIES = [
  'mechanism of insulin resistance in type 2 diabetes',
  'CRISPR base editing off-target effects',
  'role of the microbiome in Alzheimer progression',
  'efficacy of mRNA vaccines against SARS-CoV-2 variants',
];

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

/**
 * Sort results based on selected sort option
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
      return copy; // already sorted by score from LitSense
  }
}

export function SearchPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
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

  // Handle URL params for re-running searches
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') ?? (location.state as { rerun?: string } | null)?.rerun;
    if (q) { setQuery(q); run(q); }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); run(query); };

  // Process results: sort, paginate
  const processedResults = useMemo(() => {
    if (!data?.results) return [];
    return sortResults(data.results, sortBy);
  }, [data?.results, sortBy]);

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

  const justSaved = useMemo(() => new Set<string>(), [data]);
  const isBookmarked = useCallback((_pmid: number | null, text: string) => justSaved.has(_pmid + '|' + text), [justSaved]);

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
            <form className="pm-hero__form" role="search" onSubmit={onSubmit}>
              <div className="pm-hero__search-box">
                <input
                  ref={inputRef}
                  id="search-query"
                  type="text"
                  className="pm-hero__input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search PubMed"
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
            <div className="pm-hero__links">
              <a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" rel="noopener noreferrer">Advanced</a>
            </div>
            <p className="pm-hero__desc">
              PubMed® comprises more than 40 million citations for biomedical literature from MEDLINE, life science journals, and online books. Citations may include links to full text content from PubMed Central and publisher web sites.
            </p>
          </div>
        </section>

        {/* Example queries */}
        <section className="pm-home__samples container">
          <h2>Try a search</h2>
          <div className="pm-home__chips">
            {SAMPLE_QUERIES.map((q) => (
              <button key={q} className="pm-home__chip" onClick={() => { setQuery(q); run(q); }}>
                <SearchIcon size={14} /> {q}
              </button>
            ))}
          </div>

          {!user && (
            <div className="pm-home__cta">
              <p>Create a free account to save bookmarks and keep search history.</p>
              <Link to="/signup" className="btn btn--primary btn--sm">Sign up free</Link>
            </div>
          )}
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
        />
      )}

      <div className="pm-results-layout">
        {/* Left sidebar: Filters */}
        {status === 'success' && data && (
          <FilterSidebar filtersHook={filtersHook} yearData={yearData} />
        )}

        {/* Main results column */}
        <div className="pm-results-main">
          {/* Loading */}
          {status === 'loading' && (
            <div className="pm-results-loading" role="status" aria-live="polite">
              <p className="pm-results-loading__hint">Searching NCBI LitSense…</p>
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
                <Alert variant="info">No results matched your query. Try rephrasing or using more specific biomedical terms.</Alert>
              )}

              <ol className="pm-results-list" start={(page - 1) * perPage + 1}>
                {pagedResults.map((r: SearchResultItem, i: number) => {
                  const globalIdx = (page - 1) * perPage + i + 1;
                  return (
                    <li key={i} className="pm-results-list__item">
                      <SearchResultCard
                        result={r}
                        query={query}
                        index={i}
                        globalIndex={globalIdx}
                        isBookmarked={isBookmarked}
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
