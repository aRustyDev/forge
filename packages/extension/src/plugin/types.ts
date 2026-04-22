// packages/extension/src/plugin/types.ts

/** Canonical field kinds for autofill (autofill kinds used in later phases, included now for stability) */
export type FieldKind =
  | 'name.full' | 'name.first' | 'name.last'
  | 'email' | 'phone' | 'phone.type'
  | 'address.city' | 'address.state' | 'address.country'
  | 'profile.linkedin' | 'profile.github' | 'profile.website'
  | 'work_auth.us' | 'work_auth.sponsorship'
  | 'eeo.gender' | 'eeo.race' | 'eeo.veteran' | 'eeo.disability'
  | 'unknown'

export interface ExtractedJob {
  title: string | null
  company: string | null
  location: string | null
  salary_range: string | null
  description: string | null       // maps to raw_text on Forge JD
  url: string
  extracted_at: string             // ISO timestamp
  source_plugin: string            // plugin name for traceability
  raw_fields?: Record<string, unknown>
  apply_url?: string | null          // External apply link (decoded from LinkedIn redirect)
  company_url?: string | null        // Company profile URL (e.g. linkedin.com/company/anthropic)
  // Parser-derived fields (M5a)
  salary_min?: number | null
  salary_max?: number | null
  salary_period?: string | null
  work_posture?: string | null
  parsed_locations?: string[]
  parsed_sections?: string           // JSON-serialized ClassifiedSection[]
}

export interface ExtractedOrg {
  name: string | null
  website: string | null
  location: string | null
  source_plugin: string
}

export type FieldType = 'text' | 'select' | 'custom-dropdown' | 'radio' | 'checkbox'

export interface DetectedField {
  element: Element
  label_text: string | null
  field_kind: FieldKind
  field_type: FieldType
  required: boolean
}

export interface JobBoardPlugin {
  /** Unique plugin identifier, used for logging and config */
  name: string

  /** Hostname patterns this plugin claims. Matched against window.location.hostname. */
  matches: string[]

  /** Capabilities are optional — plugin implements only what it supports */
  capabilities: {
    extractJD?: (doc: Document, url: string) => ExtractedJob | null
    extractCompany?: (doc: Document, url: string) => ExtractedOrg | null
    normalizeUrl?: (url: string) => string
    detectFormFields?: (doc: Document) => DetectedField[]
    fillField?: (field: DetectedField, value: string) => Promise<boolean>
  }
}

/** Confidence tiers for extracted field values. */
export type ConfidenceTier = 'high' | 'medium' | 'low' | 'absent'

/** Confidence metadata for a single extracted field. */
export interface FieldConfidence {
  field: string
  tier: ConfidenceTier
  source: string   // 'chip', 'selector', 'parser-body', 'missing'
}

/** An extraction enriched with confidence scores. */
export interface EnrichedExtraction {
  extracted: ExtractedJob
  confidence: FieldConfidence[]
}
