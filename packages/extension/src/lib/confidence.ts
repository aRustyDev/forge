// packages/extension/src/lib/confidence.ts
//
// Confidence tier model for extracted job fields.
// Determines whether the capture overlay shows (for user review)
// or captures quietly with a toast notification.

import type { ConfidenceTier, FieldConfidence, ExtractedJob } from '../plugin/types'

/** Numeric ordering for confidence tiers (higher = more confident). */
export const CONFIDENCE_ORDER: Record<ConfidenceTier, number> = {
  high: 3,
  medium: 2,
  low: 1,
  absent: 0,
}

/** Default minimum confidence floors per field (user mode). */
export const DEFAULT_FLOORS: Record<string, ConfidenceTier> = {
  title: 'high',
  company: 'high',
  salary_min: 'medium',
  salary_max: 'medium',
  work_posture: 'medium',
  location: 'medium',
  company_url: 'high',
  url: 'high',
  apply_url: 'low',
  description: 'high',
  source_plugin: 'high',
  parsed_requirements: 'absent',
  parsed_responsibilities: 'absent',
  parsed_preferred: 'absent',
}

/** All tracked field names. */
const TRACKED_FIELDS = Object.keys(DEFAULT_FLOORS)

function allFieldsAt(tier: ConfidenceTier): Record<string, ConfidenceTier> {
  const floors: Record<string, ConfidenceTier> = {}
  for (const field of TRACKED_FIELDS) {
    floors[field] = tier
  }
  return floors
}

/** Preset confidence modes. */
export const CONFIDENCE_MODES: Record<string, Record<string, ConfidenceTier>> = {
  user: DEFAULT_FLOORS,
  debug: allFieldsAt('high'),
  dev: allFieldsAt('absent'),
}

/** Field presence checks — returns true if the field has a value. */
export const FIELD_CHECKS: Array<{ field: string; check: (e: ExtractedJob) => boolean }> = [
  { field: 'title', check: (e) => e.title != null && e.title !== '' },
  { field: 'company', check: (e) => e.company != null && e.company !== '' },
  { field: 'salary_min', check: (e) => e.salary_min != null },
  { field: 'salary_max', check: (e) => e.salary_max != null },
  { field: 'work_posture', check: (e) => e.work_posture != null && e.work_posture !== '' },
  { field: 'location', check: (e) => e.location != null && e.location !== '' },
  { field: 'company_url', check: (e) => e.company_url != null && e.company_url !== '' },
  { field: 'url', check: (e) => e.url != null && e.url !== '' },
  { field: 'apply_url', check: (e) => e.apply_url != null && e.apply_url !== '' },
  { field: 'description', check: (e) => e.description != null && e.description !== '' },
  { field: 'source_plugin', check: (e) => e.source_plugin != null && e.source_plugin !== '' },
  { field: 'parsed_requirements', check: (e) => {
    if (!e.parsed_sections) return false
    try {
      const sections = JSON.parse(e.parsed_sections)
      return sections.some((s: { category: string }) => s.category === 'requirements')
    } catch { return false }
  }},
  { field: 'parsed_responsibilities', check: (e) => {
    if (!e.parsed_sections) return false
    try {
      const sections = JSON.parse(e.parsed_sections)
      return sections.some((s: { category: string }) => s.category === 'responsibilities')
    } catch { return false }
  }},
  { field: 'parsed_preferred', check: (e) => {
    if (!e.parsed_sections) return false
    try {
      const sections = JSON.parse(e.parsed_sections)
      return sections.some((s: { category: string }) => s.category === 'preferred')
    } catch { return false }
  }},
]

/**
 * Assign confidence tiers to each tracked field.
 * Uses explicit overrides when provided, otherwise infers from presence.
 */
export function assignConfidence(
  extracted: ExtractedJob,
  overrides: Record<string, { tier: ConfidenceTier; source: string }> = {},
): FieldConfidence[] {
  return FIELD_CHECKS.map(({ field, check }) => {
    if (overrides[field]) {
      return { field, tier: overrides[field].tier, source: overrides[field].source }
    }
    const present = check(extracted)
    return {
      field,
      tier: present ? 'high' as ConfidenceTier : 'absent' as ConfidenceTier,
      source: present ? 'selector' : 'missing',
    }
  })
}

/**
 * Determine if the overlay should show for user review.
 * Returns true if forceManual is set, or if any field's confidence
 * is below its floor threshold.
 */
export function shouldShowOverlay(
  confidence: FieldConfidence[],
  floors: Record<string, ConfidenceTier>,
  forceManual: boolean = false,
): boolean {
  if (forceManual) return true
  for (const fc of confidence) {
    const floor = floors[fc.field]
    if (floor == null) continue
    if (CONFIDENCE_ORDER[fc.tier] < CONFIDENCE_ORDER[floor]) {
      return true
    }
  }
  return false
}

/**
 * Load confidence floors from extension storage.
 * Reads the `forge_confidence_mode` key and returns the corresponding preset.
 * Defaults to 'user' mode.
 */
export async function loadConfidenceFloors(): Promise<Record<string, ConfidenceTier>> {
  try {
    const result = await chrome.storage.local.get('forge_confidence_mode')
    const mode = result.forge_confidence_mode as string | undefined
    if (mode && mode in CONFIDENCE_MODES) {
      return CONFIDENCE_MODES[mode]
    }
  } catch {
    // Storage unavailable (e.g., in tests) — fall back to user mode
  }
  return CONFIDENCE_MODES['user']
}
