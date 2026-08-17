import type { SearchResultItem } from '../../api';
import type { FilterState, DateRange } from '../../hooks/useFilters';
import { FILTER_CONFIG, type FilterGroup } from './filterConfig';

// Map our config-internal articleType values to PubMed pubtype display names.
const PUBTYPE_ALIASES: Record<string, string[]> = {
  booksDocuments: ['Books and Documents', 'Book', 'Document'],
  clinicalTrial: ['Clinical Trial', 'Clinical Trial Protocol', 'Clinical Study'],
  clinicalTrialPhase1: ['Clinical Trial, Phase I', 'Phase 1'],
  clinicalTrialPhase2: ['Clinical Trial, Phase II', 'Phase 2'],
  clinicalTrialPhase3: ['Clinical Trial, Phase III', 'Phase 3'],
  clinicalTrialPhase4: ['Clinical Trial, Phase IV', 'Phase 4'],
  classicalArticle: ['Classical Article'],
  clinicalStudy: ['Clinical Study', 'Observational Study'],
  comparativeStudy: ['Comparative Study'],
  controlledClinicalTrial: ['Controlled Clinical Trial'],
  editorialComment: ['Comment', 'Editorial', 'Letter'],
  guideline: ['Guideline', 'Practice Guideline'],
  letter: ['Letter'],
  metaAnalysis: ['Meta-Analysis', 'Systematic Review'],
  multicenterStudy: ['Multicenter Study'],
  observationalStudy: ['Observational Study', 'Cohort Study'],
  practiceGuideline: ['Practice Guideline', 'Guideline'],
  randomizedControlledTrial: ['Randomized Controlled Trial', 'RCT'],
  review: ['Review', 'Systematic Review'],
  systematicReview: ['Systematic Review', 'Meta-Analysis'],
  twinStudy: ['Twin Study'],
  validationStudy: ['Validation Study'],
};

// Map language filter values to PubMed lang codes.
const LANG_CODES: Record<string, string> = {
  english: 'eng',
  spanish: 'spa',
  chinese: 'chi',
  french: 'fre',
  german: 'ger',
  italian: 'ita',
  japanese: 'jpn',
  portuguese: 'por',
  russian: 'rus',
  turkish: 'tur',
};

export function hasAbstract(r: SearchResultItem): boolean {
  return Boolean(r.text && r.text.trim().length > 30);
}

export function hasFreeFullText(r: SearchResultItem): boolean {
  return Boolean(r.pmcid);
}

export function hasFullText(r: SearchResultItem): boolean {
  // Free PMC or PubMed article with PMID link
  return Boolean(r.pmcid || r.pmid);
}

export function extractYear(r: SearchResultItem): number | null {
  const d = r.meta?.pubDate;
  if (!d) return null;
  const m = d.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// Check if an article matches a single filter category
export function matchesArticleType(r: SearchResultItem, types: Set<string>): boolean {
  if (types.size === 0) return true;
  const pubTypes = (r.meta?.pubType ?? []).map((t) => t.toLowerCase());
  const titleAndText = `${r.meta?.title ?? ''} ${r.text ?? ''}`.toLowerCase();

  for (const v of types) {
    const aliases = (PUBTYPE_ALIASES[v] ?? [v]).map((a) => a.toLowerCase());
    // 1) Match against meta.pubType
    if (aliases.some((a) => pubTypes.some((pt) => pt.includes(a) || a.includes(pt)))) {
      return true;
    }
    // 2) Keyword fallback in title or text
    if (v === 'review' && (pubTypes.includes('review') || titleAndText.includes('review') || titleAndText.includes('overview'))) return true;
    if (v === 'systematicReview' && (titleAndText.includes('systematic review') || titleAndText.includes('meta-analysis'))) return true;
    if (v === 'metaAnalysis' && titleAndText.includes('meta-analysis')) return true;
    if (v === 'clinicalTrial' && (titleAndText.includes('clinical trial') || titleAndText.includes('randomized trial'))) return true;
    if (v === 'randomizedControlledTrial' && (titleAndText.includes('randomized') || titleAndText.includes('rct'))) return true;
    if (v === 'booksDocuments' && (titleAndText.includes('chapter') || titleAndText.includes('book'))) return true;
  }
  return false;
}

export function matchesSpecies(r: SearchResultItem, species: Set<string>): boolean {
  if (species.size === 0) return true;
  const text = `${r.meta?.title ?? ''} ${r.text ?? ''}`.toLowerCase();
  
  if (species.has('humans')) {
    if (/\b(human|humans|patient|patients|men|women|child|children|participant|participants|clinical|subject|subjects|case report|cohort)\b/.test(text)) {
      return true;
    }
  }
  if (species.has('otherAnimals')) {
    if (/\b(mouse|mice|rat|rats|murine|rodent|rodents|animal|animals|canine|porcine|bovine|dog|dogs|monkey|monkeys|primate|primates|zebrafish|drosophila|in vivo)\b/.test(text)) {
      return true;
    }
  }
  return false;
}

export function matchesSex(r: SearchResultItem, sex: Set<string>): boolean {
  if (sex.size === 0) return true;
  const text = `${r.meta?.title ?? ''} ${r.text ?? ''}`.toLowerCase();

  if (sex.has('female')) {
    if (/\b(female|females|woman|women|girl|girls|maternal|pregnancy|pregnant|ovary|ovarian|breast|uterine|cervical)\b/.test(text)) {
      return true;
    }
  }
  if (sex.has('male')) {
    if (/\b(male|males|man|men|boy|boys|paternal|prostate|prostatic|testis|testicular|sperm|semen|y-chromosome)\b/.test(text)) {
      return true;
    }
  }
  return false;
}

export function matchesAge(r: SearchResultItem, age: Set<string>): boolean {
  if (age.size === 0) return true;
  const text = `${r.meta?.title ?? ''} ${r.text ?? ''}`.toLowerCase();

  for (const a of age) {
    if (a === 'child' || a === 'infant' || a === 'newborn' || a === 'preschoolChild' || a === 'adolescent') {
      if (/\b(child|children|pediatric|paediatric|infant|infants|newborn|neonatal|adolescent|adolescents|youth|juvenile|birth|boy|girl)\b/.test(text)) return true;
    }
    if (a === 'adult' || a === 'youngAdult' || a === 'middleAged') {
      if (/\b(adult|adults|middle-aged|men|women|patients|postmenopausal|working-age)\b/.test(text)) return true;
    }
    if (a === 'aged' || a === 'aged80plus') {
      if (/\b(aged|elderly|geriatric|older adults|senior|seniors|65 years|octogenarian|centenarian|aging|ageing)\b/.test(text)) return true;
    }
  }
  return false;
}

export function applyFilters(
  results: SearchResultItem[],
  filters: FilterState,
  customRange?: DateRange | null,
  yearRange?: [number, number] | null,
): SearchResultItem[] {
  const active = Object.keys(filters).filter((k) => (filters[k]?.size ?? 0) > 0);
  if (active.length === 0 && !customRange && !yearRange) return results;

  return results.filter((r) => {
    const year = extractYear(r);

    // 1) Year Range from Chart Handles (e.g. 2015 to 2024)
    if (yearRange) {
      if (year == null) return false;
      const [minY, maxY] = yearRange;
      if (year < minY || year > maxY) return false;
    }

    // 2) Publication Date (radio preset or custom range)
    if (filters.publicationDate?.size) {
      const val = [...filters.publicationDate][0];
      if (val === 'custom' && customRange) {
        if (year == null) return false;
        const fromY = customRange.from ? parseInt(customRange.from.match(/(\d{4})/)?.[1] ?? '0', 10) : 0;
        const toY = customRange.to ? parseInt(customRange.to.match(/(\d{4})/)?.[1] ?? '9999', 10) : 9999;
        if (fromY > 0 && year < fromY) return false;
        if (toY > 0 && year > toY) return false;
      } else if (val !== 'custom') {
        if (year == null) return false;
        const now = new Date().getFullYear();
        if (val === '1y' && year < now - 1) return false;
        if (val === '5y' && year < now - 5) return false;
        if (val === '10y' && year < now - 10) return false;
      }
    }

    // 3) Text Availability (PubMed requires AND logic for text availability)
    if (filters.textAvailability?.size) {
      const wanted = filters.textAvailability;
      if (wanted.has('abstract') && !hasAbstract(r)) return false;
      if (wanted.has('freeFullText') && !hasFreeFullText(r)) return false;
      if (wanted.has('fullText') && !hasFullText(r)) return false;
    }

    // 4) Article Type (OR logic across selected types)
    if (filters.articleType?.size) {
      if (!matchesArticleType(r, filters.articleType)) return false;
    }

    // 5) Language
    if (filters.language?.size) {
      const lang = r.meta?.lang ?? 'eng';
      let ok = false;
      for (const v of filters.language) {
        const code = LANG_CODES[v];
        if (code && lang === code) { ok = true; break; }
      }
      if (!ok) return false;
    }

    // 6) Species
    if (filters.species?.size) {
      if (!matchesSpecies(r, filters.species)) return false;
    }

    // 7) Sex
    if (filters.sex?.size) {
      if (!matchesSex(r, filters.sex)) return false;
    }

    // 8) Age
    if (filters.age?.size) {
      if (!matchesAge(r, filters.age)) return false;
    }

    return true;
  });
}

// Calculate counts of matching results for each individual filter option
export function calculateFilterCounts(results: SearchResultItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const now = new Date().getFullYear();

  for (const r of results) {
    const year = extractYear(r);
    
    // Publication Date presets
    if (year != null) {
      if (year >= now - 1) counts['publicationDate:1y'] = (counts['publicationDate:1y'] ?? 0) + 1;
      if (year >= now - 5) counts['publicationDate:5y'] = (counts['publicationDate:5y'] ?? 0) + 1;
      if (year >= now - 10) counts['publicationDate:10y'] = (counts['publicationDate:10y'] ?? 0) + 1;
    }

    // Text Availability
    if (hasAbstract(r)) counts['textAvailability:abstract'] = (counts['textAvailability:abstract'] ?? 0) + 1;
    if (hasFreeFullText(r)) counts['textAvailability:freeFullText'] = (counts['textAvailability:freeFullText'] ?? 0) + 1;
    if (hasFullText(r)) counts['textAvailability:fullText'] = (counts['textAvailability:fullText'] ?? 0) + 1;

    // Language
    const lang = r.meta?.lang ?? 'eng';
    for (const [v, code] of Object.entries(LANG_CODES)) {
      if (lang === code) counts[`language:${v}`] = (counts[`language:${v}`] ?? 0) + 1;
    }

    // Article Types
    const allArticleTypes = [
      'booksDocuments', 'clinicalTrial', 'metaAnalysis', 'randomizedControlledTrial',
      'review', 'systematicReview', 'classicalArticle', 'clinicalStudy', 'editorialComment', 'guideline', 'letter', 'observationalStudy'
    ];
    for (const t of allArticleTypes) {
      if (matchesArticleType(r, new Set([t]))) {
        counts[`articleType:${t}`] = (counts[`articleType:${t}`] ?? 0) + 1;
      }
    }

    // Species
    if (matchesSpecies(r, new Set(['humans']))) counts['species:humans'] = (counts['species:humans'] ?? 0) + 1;
    if (matchesSpecies(r, new Set(['otherAnimals']))) counts['species:otherAnimals'] = (counts['species:otherAnimals'] ?? 0) + 1;

    // Sex
    if (matchesSex(r, new Set(['female']))) counts['sex:female'] = (counts['sex:female'] ?? 0) + 1;
    if (matchesSex(r, new Set(['male']))) counts['sex:male'] = (counts['sex:male'] ?? 0) + 1;

    // Age
    if (matchesAge(r, new Set(['child']))) counts['age:child'] = (counts['age:child'] ?? 0) + 1;
    if (matchesAge(r, new Set(['adult']))) counts['age:adult'] = (counts['age:adult'] ?? 0) + 1;
    if (matchesAge(r, new Set(['aged']))) counts['age:aged'] = (counts['age:aged'] ?? 0) + 1;
  }

  return counts;
}

// Group key → display label lookup (for chip rendering).
export const FILTER_GROUP_LABELS: Record<string, string> = {
  publicationDate: 'Publication date',
  yearRange: 'Year range',
  textAvailability: 'Text availability',
  articleType: 'Article type',
  language: 'Language',
  species: 'Species',
  sex: 'Sex',
  age: 'Age',
};

// value → human label lookup across all groups. Built from filterConfig at import.
const VALUE_LABELS: Record<string, string> = {};
for (const g of FILTER_CONFIG as FilterGroup[]) {
  for (const opt of [...(g.options ?? []), ...(g.allOptions ?? [])]) {
    VALUE_LABELS[`${g.key}:${opt.value}`] = opt.label;
  }
}

export function labelFor(key: string, value: string, customRange?: DateRange | null): string {
  if (key === 'publicationDate' && value === 'custom' && customRange) {
    return `${customRange.from || '…'} – ${customRange.to || '…'}`;
  }
  if (key === 'yearRange') return value;
  return VALUE_LABELS[`${key}:${value}`] ?? value;
}
