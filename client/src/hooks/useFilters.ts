import { useState, useCallback, useMemo } from 'react';

export type FilterState = Record<string, Set<string>>;

export interface DateRange {
  from: string; // YYYY or YYYY/MM/DD
  to: string;
}

export interface UseFiltersReturn {
  /** Current filter state: { groupKey: Set<selectedValues> } */
  filters: FilterState;
  /** Toggle a checkbox filter value on/off */
  toggleFilter: (groupKey: string, value: string) => void;
  /** Set a radio filter to a single value (or clear it) */
  setRadioFilter: (groupKey: string, value: string | null) => void;
  /** Check if a specific value is selected in a group */
  isSelected: (groupKey: string, value: string) => boolean;
  /** Clear all filters */
  clearAll: () => void;
  /** Clear a specific group */
  clearGroup: (groupKey: string) => void;
  /** Total number of active filter selections across all groups */
  activeCount: number;
  /** Custom date range for publication date */
  customRange: DateRange | null;
  /** Set a custom date range (or clear it) */
  setCustomRange: (range: DateRange | null) => void;
  /** Year range set via chart handles */
  yearRange: [number, number] | null;
  /** Set year range from chart */
  setYearRange: (range: [number, number] | null) => void;
}

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<FilterState>({});
  const [customRange, setCustomRangeState] = useState<DateRange | null>(null);
  const [yearRange, setYearRangeState] = useState<[number, number] | null>(null);

  const toggleFilter = useCallback((groupKey: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(prev[groupKey] ?? []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      if (set.size === 0) {
        delete next[groupKey];
      } else {
        next[groupKey] = set;
      }
      return next;
    });
  }, []);

  const setRadioFilter = useCallback((groupKey: string, value: string | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[groupKey];
      } else {
        next[groupKey] = new Set([value]);
      }
      return next;
    });
    // If setting publication date radio to a preset, clear custom range
    if (groupKey === 'publicationDate' && value !== 'custom') {
      setCustomRangeState(null);
    }
  }, []);

  const setCustomRange = useCallback((range: DateRange | null) => {
    setCustomRangeState(range);
    if (range) {
      // Set the publication date filter to 'custom' marker
      setFilters((prev) => ({ ...prev, publicationDate: new Set(['custom']) }));
    } else {
      setFilters((prev) => {
        const next = { ...prev };
        delete next.publicationDate;
        return next;
      });
    }
  }, []);

  const setYearRange = useCallback((range: [number, number] | null) => {
    setYearRangeState(range);
    if (range) {
      setFilters((prev) => ({ ...prev, yearRange: new Set([`${range[0]}-${range[1]}`]) }));
    } else {
      setFilters((prev) => {
        const next = { ...prev };
        delete next.yearRange;
        return next;
      });
    }
  }, []);

  const isSelected = useCallback((groupKey: string, value: string) => {
    return filters[groupKey]?.has(value) ?? false;
  }, [filters]);

  const clearAll = useCallback(() => {
    setFilters({});
    setCustomRangeState(null);
    setYearRangeState(null);
  }, []);

  const clearGroup = useCallback((groupKey: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
    if (groupKey === 'publicationDate') setCustomRangeState(null);
    if (groupKey === 'yearRange') setYearRangeState(null);
  }, []);

  const activeCount = useMemo(() => {
    let count = 0;
    for (const [key, set] of Object.entries(filters)) {
      // Don't double-count yearRange since it's shown as a range, not individual items
      if (key === 'yearRange') { count += 1; continue; }
      count += set.size;
    }
    return count;
  }, [filters]);

  return { filters, toggleFilter, setRadioFilter, isSelected, clearAll, clearGroup, activeCount, customRange, setCustomRange, yearRange, setYearRange };
}
