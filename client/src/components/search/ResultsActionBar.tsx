import { SORT_OPTIONS, type PerPage } from './filterConfig';

interface ResultsActionBarProps {
  resultCount: number;
  sortBy: string;
  onSortChange: (value: string) => void;
  displayFormat: string;
  onDisplayFormatChange: (value: string) => void;
  perPage: PerPage;
  onPerPageChange: (value: PerPage) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ResultsActionBar({
  resultCount,
  sortBy,
  onSortChange,
  page,
  totalPages,
  onPageChange,
}: ResultsActionBarProps) {
  return (
    <div className="pm-action-bar">
      <div className="pm-action-bar__left">
        <button className="pm-action-bar__btn" title="Save results">Save</button>
        <button className="pm-action-bar__btn" title="Email results">Email</button>
        <button className="pm-action-bar__btn" title="Send to clipboard or collection">Send to</button>
      </div>
      <div className="pm-action-bar__right">
        <label className="pm-action-bar__sort">
          Sort by:
          <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <DisplayOptionsButton />
      </div>
      <div className="pm-action-bar__results-meta">
        <span className="pm-action-bar__count">{resultCount.toLocaleString()} results</span>
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

/** Display Options button (placeholder — can expand to a panel) */
function DisplayOptionsButton() {
  return (
    <button className="pm-action-bar__btn pm-action-bar__display-btn" title="Display options">
      Display options ⚙
    </button>
  );
}

/** PubMed-style pagination: « < Page [n] of N > » */
function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pm-pagination" aria-label="Pagination">
      <button
        className="pm-pagination__btn"
        disabled={page <= 1}
        onClick={() => onPageChange(1)}
        aria-label="First page"
        title="First page"
      >
        «
      </button>
      <button
        className="pm-pagination__btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
        title="Previous page"
      >
        ‹
      </button>
      <span className="pm-pagination__info">
        Page
        <input
          className="pm-pagination__input"
          type="number"
          min={1}
          max={totalPages}
          value={page}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1 && v <= totalPages) onPageChange(v);
          }}
          aria-label="Page number"
        />
        of {totalPages.toLocaleString()}
      </span>
      <button
        className="pm-pagination__btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
        title="Next page"
      >
        ›
      </button>
      <button
        className="pm-pagination__btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(totalPages)}
        aria-label="Last page"
        title="Last page"
      >
        »
      </button>
    </nav>
  );
}

export { Pagination, DisplayOptionsButton };
