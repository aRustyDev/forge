// packages/extension/src/lib/enrich-extraction.ts
//
// Runs the M3 parser on an extracted JD to populate structured fields.
// Used by content scripts before sending extraction to background.
// Pure function — safe to import in content script IIFE bundles
// (Vite inlines the parser's pure functions).

import { parseJobDescription } from '@forge/core/src/parser'
import type { ExtractedJob, EnrichedExtraction, ConfidenceTier } from '../plugin/types'
import { assignConfidence } from './confidence'

export function enrichWithParser(extracted: ExtractedJob): EnrichedExtraction {
  // Build confidence overrides based on extraction source
  const overrides: Record<string, { tier: ConfidenceTier; source: string }> = {}

  // Fields already present from DOM extraction are high-confidence selectors
  if (extracted.title) overrides.title = { tier: 'high', source: 'selector' }
  if (extracted.company) overrides.company = { tier: 'high', source: 'selector' }
  if (extracted.url) overrides.url = { tier: 'high', source: 'selector' }
  if (extracted.description) overrides.description = { tier: 'high', source: 'selector' }
  if (extracted.source_plugin) overrides.source_plugin = { tier: 'high', source: 'selector' }
  if (extracted.company_url) overrides.company_url = { tier: 'high', source: 'selector' }

  // apply_url from DOM is medium — sometimes unreliable
  if (extracted.apply_url) overrides.apply_url = { tier: 'medium', source: 'selector' }

  // salary_range from chip extraction → salary fields get high/chip
  if (extracted.salary_range) {
    overrides.salary_min = { tier: 'high', source: 'chip' }
    overrides.salary_max = { tier: 'high', source: 'chip' }
  }

  // location from chip → high/chip
  if (extracted.location) overrides.location = { tier: 'high', source: 'chip' }

  if (!extracted.description) {
    const confidence = assignConfidence(extracted, overrides)
    return { extracted, confidence }
  }

  const parsed = parseJobDescription(extracted.description)

  const enriched: ExtractedJob = {
    ...extracted,
    salary_min: parsed.salary?.min != null ? Math.round(parsed.salary.min) : null,
    salary_max: parsed.salary?.max != null ? Math.round(parsed.salary.max) : null,
    salary_period: parsed.salary?.period ?? null,
    work_posture: parsed.workPosture,
    parsed_locations: parsed.locations,
    parsed_sections: JSON.stringify(parsed.sections),
  }

  // Parser-derived fields that weren't already from chips get medium/parser-body
  if (!extracted.salary_range) {
    if (enriched.salary_min != null) overrides.salary_min = { tier: 'medium', source: 'parser-body' }
    if (enriched.salary_max != null) overrides.salary_max = { tier: 'medium', source: 'parser-body' }
  }

  if (enriched.work_posture) {
    overrides.work_posture = { tier: 'medium', source: 'parser-body' }
  }

  // Location from parser when no chip location
  if (!extracted.location && enriched.parsed_locations && enriched.parsed_locations.length > 0) {
    overrides.location = { tier: 'medium', source: 'parser-body' }
  }

  const confidence = assignConfidence(enriched, overrides)
  return { extracted: enriched, confidence }
}
