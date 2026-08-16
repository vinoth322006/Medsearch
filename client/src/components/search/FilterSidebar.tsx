import { useState } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
import { FILTER_CONFIG, type FilterGroup } from './filterConfig';
import type { UseFiltersReturn } from '../../hooks/useFilters';

interface FilterSidebarProps {
  filtersHook: UseFiltersReturn;
  /** Year distribution data for the chart - array of { year, count } */
  yearData?: { year: number; count: number }[];
}

export function FilterSidebar({ filtersHook, yearData }: FilterSidebarProps) {
  const { toggleFilter, setRadioFilter, isSelected } = filtersHook;
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
      {/* Custom Filters placeholder */}
      <div className="pm-sidebar__section">
        <h3 className="pm-sidebar__heading">My Custom Filters</h3>
        <a href="#" className="pm-sidebar__link" onClick={(e) => e.preventDefault()}>Edit custom filters</a>
      </div>

      {/* Main filter groups */}
      {mainFilters.map((group) => (
        <FilterGroupRenderer
          key={group.key}
          group={group}
          isSelected={isSelected}
          toggleFilter={toggleFilter}
          setRadioFilter={setRadioFilter}
          expanded={expandedGroups.has(group.key)}
          onToggleExpand={() => toggleExpand(group.key)}
          yearData={group.type === 'chart' ? yearData : undefined}
        />
      ))}

      {/* Additional filters — collapsible section */}
      {additionalFilters.length > 0 && (
        <div className="pm-sidebar__additional">
          <button
            className="pm-sidebar__additional-toggle"
            onClick={() => setAdditionalOpen((v) => !v)}
            aria-expanded={additionalOpen}
          >
            <span>Additional filters</span>
            {additionalOpen ? <Minus size={16} /> : <Plus size={16} />}
          </button>
          {additionalOpen && additionalFilters.map((group) => (
            <FilterGroupRenderer
              key={group.key}
              group={group}
              isSelected={isSelected}
              toggleFilter={toggleFilter}
              setRadioFilter={setRadioFilter}
              expanded={expandedGroups.has(group.key)}
              onToggleExpand={() => toggleExpand(group.key)}
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
  expanded: boolean;
  onToggleExpand: () => void;
  yearData?: { year: number; count: number }[];
}

function FilterGroupRenderer({ group, isSelected, toggleFilter, setRadioFilter, expanded, onToggleExpand, yearData }: FilterGroupRendererProps) {
  if (group.type === 'chart') {
    return (
      <div className="pm-sidebar__section">
        <h3 className="pm-sidebar__heading">{group.label}</h3>
        <YearChart data={yearData} />
      </div>
    );
  }

  const options = expanded && group.allOptions ? group.allOptions : (group.options ?? []);

  return (
    <div className="pm-sidebar__section">
      <h3 className="pm-sidebar__heading">
        {group.label}
        {group.infoTooltip && (
          <span className="pm-sidebar__info" title={`Filter by ${group.label.toLowerCase()}`}>
            <Info size={14} />
          </span>
        )}
      </h3>
      <div className="pm-sidebar__options">
        {options.map((opt) => (
          <label key={opt.value} className="pm-sidebar__option">
            <input
              type={group.type === 'radio' ? 'radio' : 'checkbox'}
              name={group.key}
              checked={isSelected(group.key, opt.value)}
              onChange={() => {
                if (group.type === 'radio') {
                  setRadioFilter(group.key, isSelected(group.key, opt.value) ? null : opt.value);
                } else {
                  toggleFilter(group.key, opt.value);
                }
              }}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {group.expandable && group.allOptions && (
        <button className="pm-sidebar__link pm-sidebar__see-all" onClick={onToggleExpand}>
          {expanded ? `Show fewer ${group.label.toLowerCase()} filters` : `See all ${group.label.toLowerCase()} filters`}
        </button>
      )}
    </div>
  );
}

/* ---- Year distribution mini chart ---- */
function YearChart({ data }: { data?: { year: number; count: number }[] }) {
  if (!data || data.length === 0) {
    return <div className="pm-year-chart pm-year-chart--empty">No year data available</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const minYear = data[0]?.year ?? 0;
  const maxYear = data[data.length - 1]?.year ?? 0;

  return (
    <div className="pm-year-chart">
      <div className="pm-year-chart__bars">
        {data.map((d) => (
          <div
            key={d.year}
            className="pm-year-chart__bar"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
            title={`${d.year}: ${d.count} results`}
          />
        ))}
      </div>
      <div className="pm-year-chart__labels">
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}
