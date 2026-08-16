import { useState, useCallback, useMemo } from 'react';

export type FilterState = Record<string, Set<string>>;

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
}

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<FilterState>({});

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
  }, []);

  const isSelected = useCallback((groupKey: string, value: string) => {
    return filters[groupKey]?.has(value) ?? false;
  }, [filters]);

  const clearAll = useCallback(() => {
    setFilters({});
  }, []);

  const clearGroup = useCallback((groupKey: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
  }, []);

  const activeCount = useMemo(() => {
    let count = 0;
    for (const set of Object.values(filters)) {
      count += set.size;
    }
    return count;
  }, [filters]);

  return { filters, toggleFilter, setRadioFilter, isSelected, clearAll, clearGroup, activeCount };
}
