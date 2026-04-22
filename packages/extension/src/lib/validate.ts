import type { ExtractedJob } from '../plugin/types'

export type ValidationResult =
  | { valid: true }
  | { valid: false; missing: string[] }

/** Check that required fields (title, description) are present. */
export function validateExtraction(extracted: ExtractedJob): ValidationResult {
  const missing: string[] = []
  if (!extracted.title?.trim()) missing.push('title')
  if (!extracted.description?.trim()) missing.push('description')
  return missing.length === 0 ? { valid: true } : { valid: false, missing }
}
