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
