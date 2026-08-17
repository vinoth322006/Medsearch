import { useState, useEffect } from 'react';
import { Info, Minus, Plus, Calendar, RotateCcw } from 'lucide-react';
import { FILTER_CONFIG, type FilterGroup } from './filterConfig';
import type { UseFiltersReturn } from '../../hooks/useFilters';

interface FilterSidebarProps {
  filtersHook: UseFiltersReturn;
  /** Year distribution data for the chart - array of { year, count } */
  yearData?: { year: number; count: number }[];
  /** Counts of matching results for each filter option */
  filterCounts?: Record<string, number>;
}

export function FilterSidebar({ filtersHook, yearData, filterCounts = {} }: FilterSidebarProps) {
  const { toggleFilter, setRadioFilter, isSelected, clearGroup, customRange, setCustomRange, yearRange, setYearRange } = filtersHook;
  const [additionalOpen, setAdditionalOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const mainFilters = FILTER_CONFIG.filter((g) => !g.additional);
  const additionalFilters = FILTER_CONFIG.filter((g) => g.additional);

  function toggleExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="pm-sidebar" aria-label="Search filters">
      {/* Custom Filters section */}
      <div className="pm-sidebar__section">
        <h3 className="pm-sidebar__heading">Filter Options</h3>
        <p className="pm-sidebar__desc">Narrow your search results by date, article type, and attributes.</p>
      </div>

      {/* Main filter groups */}
      {mainFilters.map((group) => (
        <FilterGroupRenderer
          key={group.key}
          group={group}
          isSelected={isSelected}
          toggleFilter={toggleFilter}
          setRadioFilter={setRadioFilter}
          clearGroup={clearGroup}
          expanded={expandedGroups.has(group.key)}
          onToggleExpand={() => toggleExpand(group.key)}
          yearData={group.type === 'chart' ? yearData : undefined}
          yearRange={yearRange}
          setYearRange={setYearRange}
          customRange={customRange}
          setCustomRange={setCustomRange}
          filterCounts={filterCounts}
        />
      ))}

      {/* Additional filters — collapsible section */}
      {additionalFilters.length > 0 && (
        <div className="pm-sidebar__additional">
          <button
            className="pm-sidebar__additional-toggle"
            onClick={() => setAdditionalOpen((v) => !v)}
            aria-expanded={additionalOpen}
            type="button"
          >
            <span>Additional filters</span>
            {additionalOpen ? <Minus size={16} /> : <Plus size={16} />}
          </button>
          {additionalOpen &&
            additionalFilters.map((group) => (
              <FilterGroupRenderer
                key={group.key}
                group={group}
                isSelected={isSelected}
                toggleFilter={toggleFilter}
                setRadioFilter={setRadioFilter}
                clearGroup={clearGroup}
                expanded={expandedGroups.has(group.key)}
                onToggleExpand={() => toggleExpand(group.key)}
                filterCounts={filterCounts}
              />
            ))}
        </div>
      )}
    </aside>
  );
}

/* ---- Individual filter group renderer ---- */
interface FilterGroupRendererProps {
  group: FilterGroup;
  isSelected: (key: string, val: string) => boolean;
  toggleFilter: (key: string, val: string) => void;
  setRadioFilter: (key: string, val: string | null) => void;
  clearGroup?: (key: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  yearData?: { year: number; count: number }[];
  yearRange?: [number, number] | null;
  setYearRange?: (range: [number, number] | null) => void;
  customRange?: { from: string; to: string } | null;
  setCustomRange?: (range: { from: string; to: string } | null) => void;
  filterCounts?: Record<string, number>;
}

function FilterGroupRenderer({
  group,
  isSelected,
  toggleFilter,
  setRadioFilter,
  clearGroup,
  expanded,
  onToggleExpand,
  yearData,
  yearRange,
  setYearRange,
  customRange,
  setCustomRange,
  filterCounts = {},
}: FilterGroupRendererProps) {
  // Local state for custom range inputs
  const [fromYear, setFromYear] = useState(customRange?.from ?? '');
  const [toYear, setToYear] = useState(customRange?.to ?? '');

  useEffect(() => {
    setFromYear(customRange?.from ?? '');
    setToYear(customRange?.to ?? '');
  }, [customRange]);

  if (group.type === 'chart') {
    return (
      <div className="pm-sidebar__section">
        <div className="pm-sidebar__section-header">
          <h3 className="pm-sidebar__heading">{group.label}</h3>
          {yearRange && (
            <button
              type="button"
              className="pm-sidebar__clear"
              onClick={() => setYearRange?.(null)}
              aria-label="Reset year range"
            >
              Reset
            </button>
          )}
        </div>
        <YearTimelineChart
          data={yearData}
          yearRange={yearRange}
          onRangeChange={(r) => setYearRange?.(r)}
        />
      </div>
    );
  }

  const options = expanded && group.allOptions ? group.allOptions : (group.options ?? []);
  const isCustomDateSelected = group.key === 'publicationDate' && isSelected(group.key, 'custom');
  const activeCount = (group.options ?? []).filter((o) => isSelected(group.key, o.value)).length;

  const handleCustomRangeApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromYear.trim() || toYear.trim()) {
      setCustomRange?.({ from: fromYear.trim(), to: toYear.trim() });
    }
  };

  return (
    <div className="pm-sidebar__section">
      <div className="pm-sidebar__section-header">
        <h3 className="pm-sidebar__heading">
          {group.label}
          {group.infoTooltip && (
            <span className="pm-sidebar__info" title={`Filter by ${group.label.toLowerCase()}`}>
              <Info size={13} />
            </span>
          )}
        </h3>
        {activeCount > 0 && clearGroup && (
          <button
            type="button"
            className="pm-sidebar__clear"
            onClick={() => clearGroup(group.key)}
            aria-label={`Clear ${group.label} filters`}
          >
            Clear
          </button>
        )}
      </div>

      <div className="pm-sidebar__options">
        {options.map((opt) => {
          const checked = isSelected(group.key, opt.value);
          const countKey = `${group.key}:${opt.value}`;
          const count = filterCounts[countKey];

          return (
            <label key={opt.value} className={`pm-sidebar__option ${checked ? 'pm-sidebar__option--checked' : ''}`}>
              <input
                type={group.type === 'radio' ? 'radio' : 'checkbox'}
                name={group.key}
                checked={checked}
                onChange={() => {
                  if (group.type === 'radio') {
                    setRadioFilter(group.key, checked ? null : opt.value);
                  } else {
                    toggleFilter(group.key, opt.value);
                  }
                }}
              />
              <span className="pm-sidebar__option-label">{opt.label}</span>
              {typeof count === 'number' && opt.value !== 'custom' && (
                <span className="pm-sidebar__option-count">({count})</span>
              )}
            </label>
          );
        })}
      </div>

      {/* Custom Range Input fields for Publication Date */}
      {group.key === 'publicationDate' && isCustomDateSelected && (
        <form className="pm-sidebar__custom-range" onSubmit={handleCustomRangeApply}>
          <div className="pm-sidebar__custom-inputs">
            <div className="pm-sidebar__custom-field">
              <label htmlFor="custom-from-year">From</label>
              <input
                id="custom-from-year"
                type="text"
                maxLength={4}
                placeholder="YYYY"
                value={fromYear}
                onChange={(e) => setFromYear(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <span className="pm-sidebar__custom-separator">–</span>
            <div className="pm-sidebar__custom-field">
              <label htmlFor="custom-to-year">To</label>
              <input
                id="custom-to-year"
                type="text"
                maxLength={4}
                placeholder="YYYY"
                value={toYear}
                onChange={(e) => setToYear(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="pm-sidebar__custom-actions">
            <button type="submit" className="pm-sidebar__custom-apply">
              <Calendar size={13} /> Apply
            </button>
            {customRange && (
              <button
                type="button"
                className="pm-sidebar__custom-reset"
                onClick={() => {
                  setFromYear('');
                  setToYear('');
                  setCustomRange?.(null);
                }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </form>
      )}

      {group.expandable && group.allOptions && (
        <button
          type="button"
          className="pm-sidebar__link pm-sidebar__see-all"
          onClick={onToggleExpand}
        >
          {expanded
            ? `Show fewer ${group.label.toLowerCase()} filters`
            : `See all ${group.label.toLowerCase()} filters (${group.allOptions.length})`}
        </button>
      )}
    </div>
  );
}

/* ---- Enhanced Year Timeline & Range Chart ---- */
interface YearTimelineChartProps {
  data?: { year: number; count: number }[];
  yearRange?: [number, number] | null;
  onRangeChange?: (range: [number, number] | null) => void;
}

function YearTimelineChart({ data, yearRange, onRangeChange }: YearTimelineChartProps) {
  if (!data || data.length === 0) {
    return <div className="pm-year-chart pm-year-chart--empty">No year distribution available</div>;
  }

  const minYear = data[0]?.year ?? 1990;
  const maxYear = data[data.length - 1]?.year ?? new Date().getFullYear();
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const currentMin = yearRange ? yearRange[0] : minYear;
  const currentMax = yearRange ? yearRange[1] : maxYear;

  const [fromVal, setFromVal] = useState(String(currentMin));
  const [toVal, setToVal] = useState(String(currentMax));

  useEffect(() => {
    setFromVal(String(yearRange ? yearRange[0] : minYear));
    setToVal(String(yearRange ? yearRange[1] : maxYear));
  }, [yearRange, minYear, maxYear]);

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseInt(fromVal, 10);
    const t = parseInt(toVal, 10);
    if (!isNaN(f) && !isNaN(t)) {
      const low = Math.min(f, t);
      const high = Math.max(f, t);
      onRangeChange?.([low, high]);
    }
  };

  return (
    <div className="pm-year-chart">
      {/* Visual histogram bars */}
      <div className="pm-year-chart__bars" title="Publication year distribution">
        {data.map((d) => {
          const inRange = (!yearRange || (d.year >= yearRange[0] && d.year <= yearRange[1]));
          const heightPct = Math.max(8, (d.count / maxCount) * 100);

          return (
            <button
              key={d.year}
              type="button"
              className={`pm-year-chart__bar ${inRange ? 'pm-year-chart__bar--active' : 'pm-year-chart__bar--dim'}`}
              style={{ height: `${heightPct}%` }}
              title={`${d.year}: ${d.count} article${d.count === 1 ? '' : 's'} (click to set year)`}
              onClick={() => onRangeChange?.([d.year, d.year])}
              aria-label={`${d.year}: ${d.count} results`}
            />
          );
        })}
      </div>

      <div className="pm-year-chart__labels">
        <span>{minYear}</span>
        {yearRange && <span className="pm-year-chart__current-range">{yearRange[0]} – {yearRange[1]}</span>}
        <span>{maxYear}</span>
      </div>

      {/* Year Range Filter Controls */}
      <form className="pm-year-chart__range-form" onSubmit={handleApplyRange}>
        <div className="pm-year-chart__inputs">
          <input
            type="number"
            min={minYear}
            max={maxYear}
            value={fromVal}
            onChange={(e) => setFromVal(e.target.value)}
            aria-label="Start year"
          />
          <span>to</span>
          <input
            type="number"
            min={minYear}
            max={maxYear}
            value={toVal}
            onChange={(e) => setToVal(e.target.value)}
            aria-label="End year"
          />
          <button type="submit" className="pm-year-chart__apply-btn">
            Filter
          </button>
        </div>
      </form>
    </div>
  );
}
