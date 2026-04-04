/**
 * Application constants — status arrays and shared enums.
 *
 * Re-exports from domain-specific constant modules and adds
 * cross-cutting constants like unified kanban statuses.
 */

export { FRAMINGS, THIN_COVERAGE_THRESHOLD, RESUME_SECTIONS } from './archetypes'

/** Unified kanban column statuses (5-status model). */
export const UNIFIED_KANBAN_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const

/** Valid bullet statuses. */
export const BULLET_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const

/** Valid source statuses (includes transient 'deriving' lock). */
export const SOURCE_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived', 'deriving'] as const

/** Valid resume statuses. */
export const RESUME_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const

/** Valid perspective statuses. */
export const PERSPECTIVE_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const

// ── JD Pipeline ─────────────────────────────────────────────────────

/** Column definition for JD pipeline kanban board. */
export interface ColumnDef {
  /** Unique key for this column (used as drop target identifier). */
  key: string
  /** Display label shown in column header. */
  label: string
  /** Status values that map to this column. */
  statuses: string[]
  /** Accent color (CSS value) for column header border. */
  accent: string
  /**
   * Default status to set when dropping a card into this column.
   * Only needed when a column maps to multiple statuses (e.g., Closed).
   * Falls back to statuses[0] if omitted.
   */
  dropStatus?: string
}

/**
 * All valid JD pipeline statuses.
 * Distinct from the unified 5-status model (draft/in_review/approved/rejected/archived)
 * because JDs track an external hiring lifecycle with application-specific stages.
 */
export const JD_PIPELINE_STATUSES = [
  'discovered', 'analyzing', 'applying', 'applied',
  'interviewing', 'offered', 'rejected', 'withdrawn', 'closed',
] as const

/** Pipeline columns for the JD kanban board (7 columns mapping 9 statuses). */
export const JD_PIPELINE_COLUMNS: ColumnDef[] = [
  { key: 'discovered', label: 'Discovered', statuses: ['discovered'], accent: '#a5b4fc' },
  { key: 'analyzing', label: 'Analyzing', statuses: ['analyzing'], accent: '#60a5fa' },
  { key: 'applying', label: 'Applying', statuses: ['applying'], accent: '#fbbf24' },
  { key: 'applied', label: 'Applied', statuses: ['applied'], accent: '#818cf8' },
  { key: 'interviewing', label: 'Interviewing', statuses: ['interviewing'], accent: '#a78bfa' },
  { key: 'offered', label: 'Offered', statuses: ['offered'], accent: '#22c55e' },
  {
    key: 'closed',
    label: 'Closed',
    statuses: ['rejected', 'withdrawn', 'closed'],
    dropStatus: 'closed',
    accent: '#d1d5db',
  },
]
