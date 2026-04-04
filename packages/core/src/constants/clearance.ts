/**
 * Security clearance constants, hierarchy, and label maps.
 *
 * Enum arrays mirror the CHECK constraints in migration 018.
 * The hierarchy utility enables JD matching: a Top Secret holder
 * qualifies for any Secret-level requirement.
 */

import type {
  ClearanceLevel,
  ClearancePolygraph,
  ClearanceStatus,
  ClearanceType,
  ClearanceAccessProgram,
} from '../types'

/**
 * Ordered clearance levels from lowest to highest access.
 * 'public' is excluded — it represents no clearance.
 * 'q' and 'top_secret' are equal rank (reciprocal).
 */
export const CLEARANCE_LEVEL_HIERARCHY: readonly ClearanceLevel[] = [
  'l',
  'confidential',
  'secret',
  'top_secret',
  'q',
] as const

/**
 * Returns the numeric rank of a clearance level (higher = more access).
 * 'public' returns 0. Unknown levels return -1.
 * 'q' and 'top_secret' both return rank 4 (reciprocal equivalence).
 */
export function clearanceLevelRank(level: ClearanceLevel): number {
  if (level === 'public') return 0
  if (level === 'q') return 4  // same rank as top_secret (reciprocal)
  const idx = CLEARANCE_LEVEL_HIERARCHY.indexOf(level)
  return idx === -1 ? -1 : idx + 1
}

/**
 * Returns true if `holderLevel` satisfies a JD requirement of `requiredLevel`.
 * A holder qualifies if their rank >= the required rank.
 * 'public' holders satisfy nothing. 'public' requirements are satisfied by anyone.
 */
export function clearanceMeetsRequirement(
  holderLevel: ClearanceLevel,
  requiredLevel: ClearanceLevel,
): boolean {
  if (requiredLevel === 'public') return true
  if (holderLevel === 'public') return false
  return clearanceLevelRank(holderLevel) >= clearanceLevelRank(requiredLevel)
}

/** All valid clearance levels (ordered: lowest to highest). */
export const CLEARANCE_LEVELS: readonly ClearanceLevel[] = [
  'public', 'l', 'confidential', 'secret', 'top_secret', 'q',
] as const

/** All valid polygraph types. */
export const CLEARANCE_POLYGRAPHS: readonly ClearancePolygraph[] = [
  'none', 'ci', 'full_scope',
] as const

/** All valid clearance statuses. */
export const CLEARANCE_STATUSES: readonly ClearanceStatus[] = [
  'active', 'inactive',
] as const

/** All valid clearance types. */
export const CLEARANCE_TYPES: readonly ClearanceType[] = [
  'personnel', 'facility',
] as const

/** All valid access programs. */
export const CLEARANCE_ACCESS_PROGRAMS: readonly ClearanceAccessProgram[] = [
  'sci', 'sap', 'nato',
] as const

/** Human-readable labels for clearance levels. */
export const CLEARANCE_LEVEL_LABELS: Record<ClearanceLevel, string> = {
  public: 'Public Trust',
  confidential: 'Confidential',
  secret: 'Secret',
  top_secret: 'Top Secret (TS)',
  q: 'DOE Q',
  l: 'DOE L',
}

/** Human-readable labels for polygraph types. */
export const CLEARANCE_POLYGRAPH_LABELS: Record<ClearancePolygraph, string> = {
  none: 'None',
  ci: 'CI Polygraph',
  full_scope: 'Full Scope (Lifestyle)',
}

/** Human-readable labels for access programs. */
export const CLEARANCE_ACCESS_PROGRAM_LABELS: Record<ClearanceAccessProgram, string> = {
  sci: 'SCI',
  sap: 'SAP',
  nato: 'NATO',
}
