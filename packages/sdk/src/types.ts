/**
 * @forge/sdk — shared types
 *
 * These are standalone definitions (no imports from @forge/core) so the SDK
 * can be consumed in both Bun (CLI) and browser (WebUI) contexts without
 * pulling in server-side dependencies.
 */

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ForgeError }

export interface ForgeError {
  code: string
  message: string
  details?: unknown
}

export interface Pagination {
  total: number
  offset: number
  limit: number
}

export type PaginatedResult<T> =
  | { ok: true; data: T[]; pagination: Pagination }
  | { ok: false; error: ForgeError }

export interface PaginationParams {
  offset?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Source type discriminator
// ---------------------------------------------------------------------------

export type SourceType = 'role' | 'project' | 'education' | 'clearance' | 'general'

// ---------------------------------------------------------------------------
// Source extension types
// ---------------------------------------------------------------------------

export interface SourceRole {
  organization_id: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  work_arrangement: string | null
  base_salary: number | null
  total_comp_notes: string | null
}

export interface SourceProject {
  organization_id: string | null
  is_personal: boolean
  url: string | null
  start_date: string | null
  end_date: string | null
}

// ── Education Sub-Type Unions ────────────────────────────────────────

export type DegreeLevelType = 'associate' | 'bachelors' | 'masters' | 'doctoral' | 'graduate_certificate'
export type CertificateSubtype = 'professional' | 'vendor' | 'completion'
export type EducationType = 'degree' | 'certificate' | 'course' | 'self_taught'

export type CampusModality = 'in_person' | 'remote' | 'hybrid'

export interface OrgCampus {
  id: string
  organization_id: string
  name: string
  modality: CampusModality
  address: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: string | null
  is_headquarters: boolean
  created_at: string
}

export interface SourceEducation {
  education_type: EducationType
  // Shared
  organization_id: string | null
  campus_id: string | null
  /** @deprecated Use organization_id. Kept for legacy reads. */
  institution: string | null
  edu_description: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  url: string | null
  // Degree-specific
  degree_level: DegreeLevelType | null
  degree_type: string | null
  field: string | null
  gpa: string | null
  is_in_progress: boolean
  // Certificate-specific
  certificate_subtype: CertificateSubtype | null
  credential_id: string | null
  expiration_date: string | null
  /** @deprecated Use organization_id. Kept for legacy reads. */
  issuing_body: string | null
}

export interface SourceClearance {
  level: string
  polygraph: string | null
  status: string | null
  sponsoring_agency: string | null
  investigation_date: string | null
  adjudication_date: string | null
  reinvestigation_date: string | null
  read_on: string | null
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface Source {
  id: string
  title: string
  description: string
  source_type: SourceType
  notes: string | null
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'approved' | 'deriving'
  updated_by: 'human' | 'ai'
  last_derived_at: string | null
  created_at: string
  updated_at: string
  // Extension data — present when source_type matches
  role?: SourceRole
  project?: SourceProject
  education?: SourceEducation
  clearance?: SourceClearance
}

export interface Bullet {
  id: string
  content: string
  source_content_snapshot: string
  technologies: string[]
  metrics: string | null
  domain: string | null
  notes: string | null
  status: 'draft' | 'pending_review' | 'approved' | 'rejected'
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  sources: Array<{ id: string; title: string; is_primary: boolean }>
}

export interface Perspective {
  id: string
  bullet_id: string
  content: string
  bullet_content_snapshot: string
  target_archetype: string | null
  domain: string | null
  framing: 'accomplishment' | 'responsibility' | 'context'
  status: 'draft' | 'pending_review' | 'approved' | 'rejected'
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
}

export interface Resume {
  id: string
  name: string
  target_role: string
  target_employer: string
  archetype: string
  status: 'draft' | 'final'
  notes: string | null
  header: string | null
  summary_id: string | null
  markdown_override: string | null
  markdown_override_updated_at: string | null
  latex_override: string | null
  latex_override_updated_at: string | null
  created_at: string
  updated_at: string
}

export type OrgTag = 'company' | 'vendor' | 'platform' | 'university' | 'school'
  | 'nonprofit' | 'government' | 'military' | 'conference'
  | 'volunteer' | 'freelance' | 'other'

export interface Organization {
  id: string
  name: string
  org_type: 'company' | 'nonprofit' | 'government' | 'military' | 'education' | 'volunteer' | 'freelance' | 'other'
  tags: OrgTag[]
  industry: string | null
  size: string | null
  worked: boolean
  employment_type: 'civilian' | 'contractor' | 'military_active' | 'military_reserve' | 'volunteer' | 'intern' | null
  location: string | null
  headquarters: string | null
  website: string | null
  linkedin_url: string | null
  glassdoor_url: string | null
  glassdoor_rating: number | null
  reputation_notes: string | null
  notes: string | null
  /** Pipeline status for org vetting. Backlog->Researching->Targeting (exciting/interested/acceptable)->Excluded. Null means not in the pipeline. */
  status: 'backlog' | 'researching' | 'exciting' | 'interested' | 'acceptable' | 'excluded' | null
  created_at: string
  updated_at: string
}

/** Valid statuses for a JobDescription record. */
export type JobDescriptionStatus =
  | 'interested'
  | 'analyzing'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'withdrawn'
  | 'closed'

/** A stored job description for a target opportunity (base row). */
export interface JobDescription {
  id: string
  organization_id: string | null
  title: string
  url: string | null
  raw_text: string
  status: JobDescriptionStatus
  salary_range: string | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** JobDescription with computed organization_name from JOIN. Used in API responses. */
export interface JobDescriptionWithOrg extends JobDescription {
  organization_name: string | null
}

/** Input for creating a new JobDescription. */
export interface CreateJobDescription {
  title: string
  organization_id?: string
  url?: string
  raw_text: string
  status?: JobDescriptionStatus
  salary_range?: string
  location?: string
  notes?: string
}

/** Input for partially updating a JobDescription. */
export interface UpdateJobDescription {
  title?: string
  organization_id?: string | null
  url?: string | null
  raw_text?: string
  status?: JobDescriptionStatus
  salary_range?: string | null
  location?: string | null
  notes?: string | null
}

/** Filter options for listing job descriptions. */
export interface JobDescriptionFilter {
  status?: JobDescriptionStatus
  organization_id?: string
}

/** A resume section entity — first-class section with user-defined title and enforced entry type. */
export interface ResumeSectionEntity {
  id: string
  resume_id: string
  title: string
  entry_type: string
  position: number
  created_at: string
  updated_at: string
}

/** A skill pinned to a resume section (skills-type sections). */
export interface ResumeSkill {
  id: string
  section_id: string
  skill_id: string
  position: number
  created_at: string
}

/** A resume template -- defines reusable section layouts without content. */
export interface ResumeTemplate {
  id: string
  name: string
  description: string | null
  sections: TemplateSectionDef[]
  is_builtin: boolean   // SDK converts 0|1 to boolean for developer ergonomics
  created_at: string
  updated_at: string
}

/** A section definition within a template. */
export interface TemplateSectionDef {
  title: string
  entry_type: string
  position: number
}

/** Input for creating a resume template. */
export interface CreateResumeTemplate {
  name: string
  description?: string
  sections: TemplateSectionDef[]
}

/** Input for updating a resume template. */
export interface UpdateResumeTemplate {
  name?: string
  description?: string | null
  sections?: TemplateSectionDef[]
}

export interface ResumeEntry {
  id: string
  resume_id: string
  section_id: string
  perspective_id: string | null
  content: string | null
  perspective_content_snapshot: string | null
  position: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Skill {
  id: string
  name: string
  category: string | null
  notes: string | null
}

export interface UserNote {
  id: string
  title: string | null
  content: string
  references: NoteReference[]
  created_at: string
  updated_at: string
}

/** Valid entity types for note_references. Must match the CHECK constraint in the database. */
export type NoteReferenceEntityType =
  | 'source'
  | 'bullet'
  | 'perspective'
  | 'resume_entry'
  | 'resume'
  | 'skill'
  | 'organization'
  | 'job_description'

export interface NoteReference {
  entity_type: NoteReferenceEntityType
  entity_id: string
}

export interface BulletSource {
  bullet_id: string
  source_id: string
  is_primary: boolean
}

// ---------------------------------------------------------------------------
// Domain & Archetype entities
// ---------------------------------------------------------------------------

/** An editable experience domain. */
export interface Domain {
  id: string
  name: string
  description: string | null
  created_at: string
}

/** An editable resume archetype. */
export interface Archetype {
  id: string
  name: string
  description: string | null
  created_at: string
}

/** Junction linking an archetype to an expected domain. */
export interface ArchetypeDomain {
  archetype_id: string
  domain_id: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Domain & Archetype input types
// ---------------------------------------------------------------------------

export interface CreateDomain {
  name: string
  description?: string
}

export interface UpdateDomain {
  name?: string
  description?: string | null
}

export interface CreateArchetype {
  name: string
  description?: string
}

export interface UpdateArchetype {
  name?: string
  description?: string | null
}

export interface ArchetypeWithDomains extends Archetype {
  domains: Domain[]
}

// ---------------------------------------------------------------------------
// Summary entities
// ---------------------------------------------------------------------------

/** A reusable professional summary. */
export interface Summary {
  id: string
  title: string
  role: string | null
  tagline: string | null
  description: string | null
  /** SQLite stores as 0|1 integer. JavaScript treats 0 as falsy and 1 as truthy,
   *  so `if (summary.is_template)` works. Strict `=== true` will fail. */
  is_template: boolean
  /** Computed via subquery -- number of resumes with summary_id = this.id. */
  linked_resume_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** Input for creating a new Summary. */
export interface CreateSummary {
  title: string
  role?: string
  tagline?: string
  description?: string
  is_template?: boolean
  notes?: string
}

/** Input for partially updating a Summary. */
export interface UpdateSummary {
  title?: string
  role?: string | null
  tagline?: string | null
  description?: string | null
  is_template?: boolean
  notes?: string | null
}

/** Filter for listing summaries. */
export interface SummaryFilter {
  is_template?: boolean
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

/** Global user profile — single source of truth for contact information. */
export interface UserProfile {
  id: string
  name: string
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
  github: string | null
  website: string | null
  clearance: string | null
  created_at: string
  updated_at: string
}

/** Input for partially updating the user profile. */
export type UpdateProfile = Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>

// ---------------------------------------------------------------------------
// Rich response types (with nested data)
// ---------------------------------------------------------------------------

export interface SourceWithBullets extends Source {
  bullet_count: number
}

export interface BulletWithRelations extends Bullet {
  perspective_count: number
}

export interface PerspectiveWithChain extends Perspective {
  bullet: Bullet
  source: Source
}

export interface ResumeWithEntries extends Resume {
  sections: Array<{
    id: string
    title: string
    entry_type: string
    position: number
    entries: Array<ResumeEntry & { perspective_content: string | null }>
  }>
}

/** @deprecated Use ResumeWithEntries instead. */
export type ResumeWithPerspectives = ResumeWithEntries

// ---------------------------------------------------------------------------
// Resume IR (Intermediate Representation)
// ---------------------------------------------------------------------------

export interface ResumeDocument {
  resume_id: string
  header: ResumeHeader
  sections: IRSection[]
}

export interface ResumeHeader {
  name: string
  tagline: string | null
  location: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
  website: string | null
  clearance: string | null
}

export interface IRSection {
  id: string
  type: IRSectionType
  title: string
  display_order: number
  items: IRSectionItem[]
}

export type IRSectionType =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'clearance'
  | 'presentations'
  | 'awards'
  | 'freeform'
  | 'custom'

export type IRSectionItem =
  | SummaryItem
  | ExperienceGroup
  | SkillGroup
  | EducationItem
  | ProjectItem
  | CertificationGroup
  | ClearanceItem
  | PresentationItem

export interface SummaryItem {
  kind: 'summary'
  content: string
  entry_id: string | null
}

export interface ExperienceGroup {
  kind: 'experience_group'
  id: string
  organization: string
  subheadings: ExperienceSubheading[]
}

export interface ExperienceSubheading {
  id: string
  title: string
  date_range: string
  source_id: string | null
  bullets: ExperienceBullet[]
}

export interface ExperienceBullet {
  content: string
  entry_id: string | null
  source_chain?: {
    source_id: string
    source_title: string
    bullet_id: string
    bullet_preview: string
    perspective_id: string
    perspective_preview: string
  }
  is_cloned: boolean
}

export interface SkillGroup {
  kind: 'skill_group'
  categories: Array<{
    label: string
    skills: string[]
  }>
}

export interface EducationItem {
  kind: 'education'
  institution: string
  degree: string
  date: string
  entry_id: string | null
  source_id: string | null
  // New optional fields from education sub-types
  education_type?: string
  degree_level?: string | null
  degree_type?: string | null
  field?: string | null
  gpa?: string | null
  location?: string | null
  credential_id?: string | null
  issuing_body?: string | null
  certificate_subtype?: string | null
  edu_description?: string | null
  // Campus fields from org_campuses JOIN
  campus_name?: string | null
  campus_city?: string | null
  campus_state?: string | null
}

export interface ProjectItem {
  kind: 'project'
  name: string
  date: string | null
  entry_id: string | null
  source_id: string | null
  bullets: ExperienceBullet[]
}

export interface CertificationGroup {
  kind: 'certification_group'
  categories: Array<{
    label: string
    certs: Array<{
      name: string
      entry_id: string | null
      source_id: string | null
    }>
  }>
}

export interface ClearanceItem {
  kind: 'clearance'
  content: string
  entry_id: string | null
  source_id: string | null
}

export interface PresentationItem {
  kind: 'presentation'
  title: string
  venue: string
  date: string | null
  entry_id: string | null
  source_id: string | null
  bullets: ExperienceBullet[]
}

// ---------------------------------------------------------------------------
// LaTeX Template
// ---------------------------------------------------------------------------

export interface LatexTemplate {
  preamble: string
  renderHeader: (header: ResumeHeader) => string
  renderSection: (section: IRSection) => string
  renderSectionFallback: (section: IRSection) => string
  footer: string
}

// ---------------------------------------------------------------------------
// Lint Result
// ---------------------------------------------------------------------------

export type LintResult =
  | { ok: true }
  | { ok: false; errors: string[] }

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export interface BulletReviewItem extends Bullet {
  source_title: string
}

export interface PerspectiveReviewItem extends Perspective {
  bullet_content: string
  source_title: string
}

export interface ReviewQueue {
  bullets: { count: number; items: BulletReviewItem[] }
  perspectives: { count: number; items: PerspectiveReviewItem[] }
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

export interface GapAnalysis {
  resume_id: string
  archetype: string
  target_role: string
  target_employer: string
  gaps: Gap[]
  coverage_summary: CoverageSummary
}

export type Gap = MissingDomainGap | ThinCoverageGap | UnusedBulletGap

export interface MissingDomainGap {
  type: 'missing_domain_coverage'
  domain: string
  description: string
  available_bullets: Array<{ id: string; content: string; source_title: string }>
  recommendation: string
}

export interface ThinCoverageGap {
  type: 'thin_coverage'
  domain: string
  current_count: number
  description: string
  recommendation: string
}

export interface UnusedBulletGap {
  type: 'unused_bullet'
  bullet_id: string
  bullet_content: string
  source_title: string
  description: string
  recommendation: string
}

export interface CoverageSummary {
  perspectives_included: number
  total_approved_perspectives_for_archetype: number
  domains_represented: string[]
  domains_missing: string[]
}

// ---------------------------------------------------------------------------
// Drift / integrity types
// ---------------------------------------------------------------------------

export interface DriftReport {
  bullets: DriftedBullet[]
  perspectives: DriftedPerspective[]
  resume_entries: DriftedResumeEntry[]
}

export interface DriftedBullet {
  id: string
  content: string
  source_content_snapshot: string
  current_source_description: string
  source_id: string
  source_title: string
}

export interface DriftedPerspective {
  id: string
  content: string
  bullet_content_snapshot: string
  current_bullet_content: string
  bullet_id: string
}

export interface DriftedResumeEntry {
  id: string
  perspective_content_snapshot: string | null
  current_perspective_content: string
  perspective_id: string
  resume_id: string
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSource {
  title: string
  description: string
  source_type?: SourceType
  notes?: string
  start_date?: string
  end_date?: string
  role?: Partial<SourceRole>
  project?: Partial<SourceProject>
  education?: Partial<SourceEducation>
  clearance?: Partial<SourceClearance>
}

export interface UpdateSource {
  title?: string
  description?: string
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
  role?: Partial<SourceRole>
  project?: Partial<SourceProject>
  education?: Partial<SourceEducation>
  clearance?: Partial<SourceClearance>
}

export interface UpdateBullet {
  content?: string
  technologies?: string[]
  metrics?: string | null
  domain?: string | null
  notes?: string | null
}

export interface UpdatePerspective {
  content?: string
  target_archetype?: string | null
  domain?: string | null
  framing?: 'accomplishment' | 'responsibility' | 'context'
  notes?: string | null
}

export interface RejectInput {
  rejection_reason: string
}

export interface DerivePerspectiveInput {
  archetype: string
  domain: string
  framing: 'accomplishment' | 'responsibility' | 'context'
}

export interface CreateResume {
  name: string
  target_role: string
  target_employer: string
  archetype: string
  summary_id?: string
}

export interface UpdateResume {
  name?: string
  target_role?: string
  target_employer?: string
  archetype?: string
  status?: 'draft' | 'final'
  notes?: string | null
  header?: string | null
  summary_id?: string | null
  markdown_override?: string | null
  latex_override?: string | null
}

export interface AddResumeEntry {
  section_id: string
  perspective_id?: string
  position: number
  content?: string | null
  notes?: string | null
}

export interface UpdateResumeEntry {
  content?: string | null
  section_id?: string
  position?: number
  notes?: string | null
}

export interface CreateOrganization {
  name: string
  org_type?: string
  industry?: string
  size?: string
  worked?: boolean
  employment_type?: string
  location?: string
  headquarters?: string
  website?: string
  linkedin_url?: string
  glassdoor_url?: string
  glassdoor_rating?: number
  reputation_notes?: string
  notes?: string
  status?: 'backlog' | 'researching' | 'exciting' | 'interested' | 'acceptable' | 'excluded' | null
}

export interface UpdateOrganization {
  name?: string
  org_type?: string
  industry?: string
  size?: string
  worked?: boolean
  employment_type?: string | null
  location?: string | null
  headquarters?: string | null
  website?: string | null
  linkedin_url?: string | null
  glassdoor_url?: string | null
  glassdoor_rating?: number | null
  reputation_notes?: string | null
  notes?: string | null
  status?: 'backlog' | 'researching' | 'exciting' | 'interested' | 'acceptable' | 'excluded' | null
}

export interface CreateNote {
  title?: string
  content: string
}

export interface UpdateNote {
  title?: string | null
  content?: string
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface SourceFilter {
  status?: string
  source_type?: string
}

export interface BulletFilter {
  source_id?: string
  status?: string
  technology?: string
}

export interface PerspectiveFilter {
  bullet_id?: string
  archetype?: string
  domain?: string
  framing?: string
  status?: string
  source_id?: string
}

export interface OrganizationFilter {
  org_type?: string
  tag?: string
  worked?: string
  status?: string
}

// ---------------------------------------------------------------------------
// Export Types
// ---------------------------------------------------------------------------

export interface DataExportBundle {
  forge_export: {
    version: string
    exported_at: string
    entities: string[]
  }
  sources?: Source[]
  bullets?: Bullet[]
  perspectives?: Perspective[]
  skills?: Skill[]
  organizations?: Organization[]
  summaries?: unknown[]
  job_descriptions?: unknown[]
}

// ---------------------------------------------------------------------------
// Request function types (used by resource classes)
// ---------------------------------------------------------------------------

export type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown,
) => Promise<Result<T>>

export type RequestListFn = <T>(
  method: string,
  path: string,
  params?: Record<string, string>,
) => Promise<PaginatedResult<T>>
