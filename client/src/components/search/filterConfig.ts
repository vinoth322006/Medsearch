/**
 * PubMed Filter Configuration — Single Source of Truth
 * Every filter option rendered in the sidebar is defined here.
 * To add/remove a filter, just edit this array — zero JSX changes needed.
 */

export type FilterType = 'radio' | 'checkbox' | 'chart';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  /** Unique key for state management */
  key: string;
  /** Display label (rendered uppercase in sidebar) */
  label: string;
  /** Type of control: radio (single), checkbox (multi), chart (year histogram) */
  type: FilterType;
  /** Options to render */
  options?: FilterOption[];
  /** Show "See all ... filters" expand link */
  expandable?: boolean;
  /** Show info tooltip icon next to label */
  infoTooltip?: boolean;
  /** If true, group starts collapsed under "Additional filters" */
  additional?: boolean;
  /** All options (visible when "See all" is clicked) */
  allOptions?: FilterOption[];
}

export const FILTER_CONFIG: FilterGroup[] = [
  {
    key: 'resultsByYear',
    label: 'Results by year',
    type: 'chart',
  },
  {
    key: 'publicationDate',
    label: 'Publication date',
    type: 'radio',
    options: [
      { value: '1y', label: '1 year' },
      { value: '5y', label: '5 years' },
      { value: '10y', label: '10 years' },
      { value: 'custom', label: 'Custom Range' },
    ],
  },
  {
    key: 'textAvailability',
    label: 'Text availability',
    type: 'checkbox',
    options: [
      { value: 'abstract', label: 'Abstract' },
      { value: 'freeFullText', label: 'Free full text' },
      { value: 'fullText', label: 'Full text' },
    ],
  },
  {
    key: 'articleAttribute',
    label: 'Article attribute',
    type: 'checkbox',
    options: [
      { value: 'associatedData', label: 'Associated data' },
    ],
  },
  {
    key: 'articleType',
    label: 'Article type',
    type: 'checkbox',
    options: [
      { value: 'booksDocuments', label: 'Books and Documents' },
      { value: 'clinicalTrial', label: 'Clinical Trial' },
      { value: 'metaAnalysis', label: 'Meta-Analysis' },
      { value: 'randomizedControlledTrial', label: 'Randomized Controlled Trial' },
      { value: 'review', label: 'Review' },
      { value: 'systematicReview', label: 'Systematic Review' },
    ],
    expandable: true,
    allOptions: [
      { value: 'booksDocuments', label: 'Books and Documents' },
      { value: 'classicalArticle', label: 'Classical Article' },
      { value: 'clinicalStudy', label: 'Clinical Study' },
      { value: 'clinicalTrial', label: 'Clinical Trial' },
      { value: 'clinicalTrialPhase1', label: 'Clinical Trial, Phase I' },
      { value: 'clinicalTrialPhase2', label: 'Clinical Trial, Phase II' },
      { value: 'clinicalTrialPhase3', label: 'Clinical Trial, Phase III' },
      { value: 'clinicalTrialPhase4', label: 'Clinical Trial, Phase IV' },
      { value: 'comparativeStudy', label: 'Comparative Study' },
      { value: 'controlledClinicalTrial', label: 'Controlled Clinical Trial' },
      { value: 'editorialComment', label: 'Comment / Editorial' },
      { value: 'guideline', label: 'Guideline' },
      { value: 'letter', label: 'Letter' },
      { value: 'metaAnalysis', label: 'Meta-Analysis' },
      { value: 'multicenterStudy', label: 'Multicenter Study' },
      { value: 'observationalStudy', label: 'Observational Study' },
      { value: 'practiceGuideline', label: 'Practice Guideline' },
      { value: 'randomizedControlledTrial', label: 'Randomized Controlled Trial' },
      { value: 'review', label: 'Review' },
      { value: 'systematicReview', label: 'Systematic Review' },
      { value: 'twinStudy', label: 'Twin Study' },
      { value: 'validationStudy', label: 'Validation Study' },
    ],
  },
  // ---- Additional filters (collapsed by default) ----
  {
    key: 'language',
    label: 'Article language',
    type: 'checkbox',
    infoTooltip: true,
    additional: true,
    options: [
      { value: 'english', label: 'English' },
      { value: 'spanish', label: 'Spanish' },
    ],
    expandable: true,
    allOptions: [
      { value: 'english', label: 'English' },
      { value: 'chinese', label: 'Chinese' },
      { value: 'french', label: 'French' },
      { value: 'german', label: 'German' },
      { value: 'italian', label: 'Italian' },
      { value: 'japanese', label: 'Japanese' },
      { value: 'portuguese', label: 'Portuguese' },
      { value: 'russian', label: 'Russian' },
      { value: 'spanish', label: 'Spanish' },
      { value: 'turkish', label: 'Turkish' },
    ],
  },
  {
    key: 'species',
    label: 'Species',
    type: 'checkbox',
    infoTooltip: true,
    additional: true,
    options: [
      { value: 'humans', label: 'Humans' },
      { value: 'otherAnimals', label: 'Other Animals' },
    ],
  },
  {
    key: 'sex',
    label: 'Sex',
    type: 'checkbox',
    infoTooltip: true,
    additional: true,
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
    ],
  },
  {
    key: 'age',
    label: 'Age',
    type: 'checkbox',
    infoTooltip: true,
    additional: true,
    options: [
      { value: 'child', label: 'Child: birth-18 years' },
      { value: 'adult', label: 'Adult: 19+ years' },
      { value: 'aged', label: 'Aged: 65+ years' },
    ],
    expandable: true,
    allOptions: [
      { value: 'newborn', label: 'Newborn: birth-1 month' },
      { value: 'infant', label: 'Infant: birth-23 months' },
      { value: 'preschoolChild', label: 'Preschool Child: 2-5 years' },
      { value: 'child', label: 'Child: 6-12 years' },
      { value: 'adolescent', label: 'Adolescent: 13-18 years' },
      { value: 'adult', label: 'Adult: 19+ years' },
      { value: 'youngAdult', label: 'Young Adult: 19-24 years' },
      { value: 'middleAged', label: 'Middle Aged: 45-64 years' },
      { value: 'aged', label: 'Aged: 65+ years' },
      { value: 'aged80plus', label: 'Aged: 80+ years' },
    ],
  },
];

/**
 * Sort options — drives the Sort By dropdown
 */
export interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'bestMatch', label: 'Best match' },
  { value: 'mostRecent', label: 'Most recent' },
  { value: 'pubDateAsc', label: 'Publication date' },
  { value: 'firstAuthor', label: 'First author' },
  { value: 'lastAuthor', label: 'Last author' },
  { value: 'journal', label: 'Journal' },
  { value: 'title', label: 'Title' },
];

/**
 * Display format options — drives the Display Options panel
 */
export interface DisplayFormatOption {
  value: string;
  label: string;
}

export const DISPLAY_FORMATS: DisplayFormatOption[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'summaryText', label: 'Summary (text)' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'pmid', label: 'PMID' },
];

export const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];
