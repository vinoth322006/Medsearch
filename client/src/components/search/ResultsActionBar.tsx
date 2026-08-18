import { useState, useRef, useEffect } from 'react';
import { SORT_OPTIONS, type PerPage } from './filterConfig';
import type { SearchResultItem } from '../../api';

interface ResultsActionBarProps {
  resultCount: number;
  sortBy: string;
  onSortChange: (value: string) => void;

  perPage: PerPage;
  onPerPageChange: (value: PerPage) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Currently checkbox-selected results (may be empty) */
  selectedItems: SearchResultItem[];
  /** All results visible on the current page (used when nothing is selected) */
  currentPageItems: SearchResultItem[];
  /** Bulk-save items to bookmarks */
  onSave: (items: SearchResultItem[]) => void;
  /** Open mailto: with formatted items body */
  onEmail: (items: SearchResultItem[]) => void;
  /** Send items somewhere (clipboard / file) */
  onSendTo: (action: 'copy' | 'download', items: SearchResultItem[]) => void;
  /** True while a bulk save is in flight (disables the Save button) */
  saving?: boolean;
}

export function ResultsActionBar({
  resultCount,
  sortBy,
  onSortChange,

  page,
  totalPages,
  onPageChange,
  selectedItems,
  currentPageItems,
  onSave,
  onEmail,
  onSendTo,
  saving = false,
}: ResultsActionBarProps) {
  const hasSelection = selectedItems.length > 0;
  const target = hasSelection ? selectedItems : currentPageItems;
  const count = hasSelection ? selectedItems.length : currentPageItems.length;
  const countLabel = hasSelection ? ` (${count})` : '';

  return (
    <div className="pm-action-bar">
      <div className="pm-action-bar__left">
        <button
          className="pm-action-bar__btn"
          onClick={() => onSave(target)}
          disabled={saving}
          title={hasSelection ? `Save ${count} selected result${count === 1 ? '' : 's'} to bookmarks` : `Save all ${count} results on this page to bookmarks`}
        >
          {saving ? 'Saving…' : `Save${countLabel}`}
        </button>
        <button
          className="pm-action-bar__btn"
          onClick={() => onEmail(target)}
          title={hasSelection ? `Email ${count} selected result${count === 1 ? '' : 's'}` : `Email all ${count} results on this page`}
        >
          Email{countLabel}
        </button>
        <SendToMenu
          onSendTo={(action) => onSendTo(action, target)}
          hasSelection={hasSelection}
          count={count}
        />
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

      </div>
      <div className="pm-action-bar__results-meta">
        <span className="pm-action-bar__count">{resultCount.toLocaleString()} results</span>
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

/** Send-to dropdown with clipboard + download actions. */
function SendToMenu({
  onSendTo,
  hasSelection,
  count,
}: {
  onSendTo: (action: 'copy' | 'download') => void;
  hasSelection: boolean;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`sendto-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const label = `Send to${hasSelection ? ` (${count})` : ''}`;

  return (
    <div className="pm-action-bar__sendto" ref={ref}>
      <button
        className="pm-action-bar__btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={idRef.current}
        title={hasSelection ? `Send ${count} selected result${count === 1 ? '' : 's'}` : `Send all ${count} results on this page`}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="pm-action-bar__menu" role="menu" id={idRef.current}>
          <button
            role="menuitem"
            className="pm-action-bar__menu-item"
            onClick={() => { setOpen(false); onSendTo('copy'); }}
          >
            Copy to clipboard
          </button>
          <button
            role="menuitem"
            className="pm-action-bar__menu-item"
            onClick={() => { setOpen(false); onSendTo('download'); }}
          >
            Download as text file
          </button>
        </div>
      )}
    </div>
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

export { Pagination };
