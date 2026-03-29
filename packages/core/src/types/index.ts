/**
 * Shared type definitions for the Forge resume builder.
 *
 * All entity interfaces, input types, status unions, result types, and
 * rich response types used across @forge/core and @forge/sdk.
 */

// ── Status Unions ─────────────────────────────────────────────────────

/** Valid statuses for a Source record. */
export type SourceStatus = 'draft' | 'approved' | 'deriving'

/** Valid statuses for a Bullet record. */
export type BulletStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

/** Valid statuses for a Perspective record. */
export type PerspectiveStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

/** Valid statuses for a Resume record. */
export type ResumeStatus = 'draft' | 'final'

/** Valid updated_by values. */
export type UpdatedBy = 'human' | 'ai'

/** Valid framing values for a Perspective. */
export type Framing = 'accomplishment' | 'responsibility' | 'context'

/** Valid section values for resume_perspectives. */
export type ResumeSection = 'summary' | 'work_history' | 'projects' | 'education' | 'skills' | 'awards'

/** Valid entity types for prompt logs. */
export type PromptLogEntityType = 'bullet' | 'perspective'

// ── Core Entities ─────────────────────────────────────────────────────

/** An employer organization. */
export interface Employer {
  id: string
  name: string
  created_at: string
}

/** A project, optionally linked to an employer. */
export interface Project {
  id: string
  name: string
  employer_id: string | null
  description: string | null
  created_at: string
}

/** A source experience entry — the root of the derivation chain. */
export interface Source {
  id: string
  title: string
  description: string
  employer_id: string | null
  project_id: string | null
  start_date: string | null
  end_date: string | null
  status: SourceStatus
  updated_by: UpdatedBy
  last_derived_at: string | null
  created_at: string
  updated_at: string
}

/** A bullet point derived from a source. */
export interface Bullet {
  id: string
  source_id: string
  content: string
  source_content_snapshot: string
  technologies: string[]
  metrics: string | null
  status: BulletStatus
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

/** A perspective reframing of a bullet for a specific archetype/domain. */
export interface Perspective {
  id: string
  bullet_id: string
  content: string
  bullet_content_snapshot: string
  target_archetype: string | null
  domain: string | null
  framing: Framing
  status: PerspectiveStatus
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

/** A curated resume assembled from perspectives. */
export interface Resume {
  id: string
  name: string
  target_role: string
  target_employer: string
  archetype: string
  status: ResumeStatus
  created_at: string
  updated_at: string
}

/** A join-table entry linking a perspective to a resume section. */
export interface ResumePerspective {
  resume_id: string
  perspective_id: string
  section: ResumeSection
  position: number
}

/** A named skill with optional category. */
export interface Skill {
  id: string
  name: string
  category: string | null
}

/** An append-only log entry for AI prompt/response pairs. */
export interface PromptLog {
  id: string
  entity_type: PromptLogEntityType
  entity_id: string
  prompt_template: string
  prompt_input: string
  raw_response: string
  created_at: string
}

// ── Input Types ───────────────────────────────────────────────────────

/** Input for creating a new Source. */
export interface CreateSource {
  title: string
  description: string
  employer_id?: string
  project_id?: string
  start_date?: string
  end_date?: string
}

/** Input for partially updating a Source. */
export interface UpdateSource {
  title?: string
  description?: string
  employer_id?: string | null
  project_id?: string | null
  start_date?: string | null
  end_date?: string | null
}

/** Input for deriving a perspective from a bullet. */
export interface DerivePerspectiveInput {
  archetype: string
  domain: string
  framing: Framing
}

/** Input for creating a new Resume. */
export interface CreateResume {
  name: string
  target_role: string
  target_employer: string
  archetype: string
}

/** Input for partially updating a Resume. */
export interface UpdateResume {
  name?: string
  target_role?: string
  target_employer?: string
  archetype?: string
  status?: ResumeStatus
}

/** Input for adding a perspective to a resume. */
export interface AddResumePerspective {
  perspective_id: string
  section: string
  position: number
}

/** Input for reordering all perspectives in a resume. */
export interface ReorderPerspectives {
  perspectives: Array<{
    perspective_id: string
    section: string
    position: number
  }>
}

/** Input for rejecting a bullet or perspective. */
export interface RejectInput {
  rejection_reason: string
}

// ── Result Types ──────────────────────────────────────────────────────

/** A structured error returned by Forge operations. */
export interface ForgeError {
  code: string
  message: string
  details?: unknown
}

/** Discriminated union for operation results. */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ForgeError }

/** Pagination metadata. */
export interface Pagination {
  total: number
  offset: number
  limit: number
}

/** Discriminated union for paginated results. */
export type PaginatedResult<T> =
  | { ok: true; data: T[]; pagination: Pagination }
  | { ok: false; error: ForgeError }

/** Pagination parameters for list endpoints. */
export interface PaginationParams {
  offset?: number
  limit?: number
}

// ── Rich Response Types ───────────────────────────────────────────────

/** A source with its bullet count. */
export interface SourceWithBullets extends Source {
  bullet_count: number
}

/** A bullet with its parent source and perspective count. */
export interface BulletWithRelations extends Bullet {
  source: Source
  perspective_count: number
}

/** A perspective with its full derivation chain. */
export interface PerspectiveWithChain extends Perspective {
  bullet: Bullet
  source: Source
}

/** A resume with perspectives grouped by section. */
export interface ResumeWithPerspectives extends Resume {
  sections: Record<string, Array<Perspective & { position: number }>>
}

// ── Review Queue ──────────────────────────────────────────────────────

/** An item in the bullet review queue. */
export interface BulletReviewItem extends Bullet {
  source_title: string
}

/** An item in the perspective review queue. */
export interface PerspectiveReviewItem extends Perspective {
  bullet_content: string
  source_title: string
}

/** The combined review queue. */
export interface ReviewQueue {
  bullets: { count: number; items: BulletReviewItem[] }
  perspectives: { count: number; items: PerspectiveReviewItem[] }
}
