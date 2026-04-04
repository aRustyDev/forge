/**
 * Application constants for resume framings, sections,
 * and gap analysis configuration.
 *
 * Archetypes and domains are now DB-backed entities (see Phase 16/17).
 * Only static constants remain here.
 */

/**
 * All supported narrative framings.
 *
 * Narrative framing describes the rhetorical structure of a perspective
 * bullet: whether it emphasizes results, ownership scope, or operating
 * environment.
 */
export const FRAMINGS = [
  'accomplishment',
  'responsibility',
  'context',
] as const;

/**
 * Minimum number of perspectives in a domain before it is considered
 * adequately covered. Fewer than this triggers a "thin coverage" gap.
 */
export const THIN_COVERAGE_THRESHOLD = 2;

/**
 * Valid resume section identifiers.
 *
 * Controls which sections appear in an assembled resume and in what
 * order they can be arranged.
 */
export const RESUME_SECTIONS = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'certifications',
  'clearance',
  'presentations',
  'awards',
  'custom',
] as const;
