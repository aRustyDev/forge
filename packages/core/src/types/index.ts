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

/** Valid section values for resume entries. */
export type ResumeSection =
  | 'summary'
  | 'experience'        // replaces work_history
  | 'work_history'      // kept for backward compatibility
  | 'projects'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'clearance'
  | 'presentations'
  | 'awards'
  | 'custom'

/** Valid status values for organization tracking. */
export type OrganizationStatus = 'backlog' | 'researching' | 'exciting' | 'interested' | 'acceptable' | 'excluded'

/** Valid entity types for prompt logs. */
export type PromptLogEntityType = 'bullet' | 'perspective'

/** Valid source type discriminator values. */
export type SourceType = 'role' | 'project' | 'education' | 'clearance' | 'general'

/** Valid clearance level values. */
export type ClearanceLevel = 'public' | 'confidential' | 'secret' | 'top_secret' | 'q' | 'l'

/** Valid clearance polygraph values. */
export type ClearancePolygraph = 'none' | 'ci' | 'full_scope'

/** Valid clearance status values. */
export type ClearanceStatus = 'active' | 'inactive'

/** Valid clearance type values. */
export type ClearanceType = 'personnel' | 'facility'

/** Valid clearance access program values. */
export type ClearanceAccessProgram = 'sci' | 'sap' | 'nato'

// ── Core Entities ─────────────────────────────────────────────────────

/** Campus modality — how instruction/work is delivered at this location. */
export type CampusModality = 'in_person' | 'remote' | 'hybrid'

/** A campus/location belonging to an organization. */
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
  is_headquarters: number
  created_at: string
}

/** An alias/shorthand name for an organization. */
export interface OrgAlias {
  id: string
  organization_id: string
  alias: string
}

/** Valid tags for an organization. */
export type OrgTag = 'company' | 'vendor' | 'platform' | 'university' | 'school'
  | 'nonprofit' | 'government' | 'military' | 'conference'
  | 'volunteer' | 'freelance' | 'other'

/** An organization (employer, school, etc.). */
export interface Organization {
  id: string
  name: string
  org_type: string
  tags: OrgTag[]
  industry: string | null
  size: string | null
  worked: number
  employment_type: string | null
  website: string | null
  linkedin_url: string | null
  glassdoor_url: string | null
  glassdoor_rating: number | null
  reputation_notes: string | null
  notes: string | null
  status: OrganizationStatus | null
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

// ── Contact Entity ─────────────────────────────────────────────────────

/** A contact person tracked in the job hunting process. */
export interface Contact {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  team: string | null
  dept: string | null
  notes: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

/** Contact with computed organization_name from JOIN. Used in API responses. */
export interface ContactWithOrg extends Contact {
  organization_name: string | null
}

/** Input for creating a new Contact. */
export interface CreateContact {
  name: string
  title?: string
  email?: string
  phone?: string
  linkedin?: string
  team?: string
  dept?: string
  notes?: string
  organization_id?: string
}

/** Input for partially updating a Contact. */
export interface UpdateContact {
  name?: string
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin?: string | null
  team?: string | null
  dept?: string | null
  notes?: string | null
  organization_id?: string | null
}

/** Valid relationship types for contact-organization links. */
export type ContactOrgRelationship = 'recruiter' | 'hr' | 'referral' | 'peer' | 'manager' | 'other'

/** Valid relationship types for contact-job description links. */
export type ContactJDRelationship = 'hiring_manager' | 'recruiter' | 'interviewer' | 'referral' | 'other'

/** Valid relationship types for contact-resume links. */
export type ContactResumeRelationship = 'reference' | 'recommender' | 'other'

/** A contact linked to an entity with a typed relationship. */
export interface ContactLink {
  contact_id: string
  contact_name: string
  contact_title: string | null
  contact_email: string | null
  relationship: string
}

/** Filter parameters for listing contacts. */
export interface ContactFilter {
  organization_id?: string
  search?: string
}

/** A source experience entry — the root of the derivation chain. */
export interface Source {
  id: string
  title: string
  description: string
  source_type: SourceType
  start_date: string | null
  end_date: string | null
  status: SourceStatus
  updated_by: UpdatedBy
  last_derived_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Role-specific details for a source with source_type='role'. */
export interface SourceRole {
  source_id: string
  organization_id: string | null
  start_date: string | null
  end_date: string | null
  is_current: number
  work_arrangement: string | null
  base_salary: number | null
  total_comp_notes: string | null
}

/** Project-specific details for a source with source_type='project'. */
export interface SourceProject {
  source_id: string
  organization_id: string | null
  is_personal: number
  url: string | null
  start_date: string | null
  end_date: string | null
}

// ── Education Sub-Type Unions ────────────────────────────────────────

export type DegreeLevelType = 'associate' | 'bachelors' | 'masters' | 'doctoral' | 'graduate_certificate'
export type CertificateSubtype = 'professional' | 'vendor' | 'completion'
export type EducationType = 'degree' | 'certificate' | 'course' | 'self_taught'

/** Education-specific details for a source with source_type='education'. */
export interface SourceEducation {
  source_id: string
  education_type: EducationType
  // Shared
  organization_id: string | null
  campus_id: string | null
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
  is_in_progress: number
  // Certificate-specific
  certificate_subtype: CertificateSubtype | null
  credential_id: string | null
  expiration_date: string | null
}

/** Clearance-specific details for a source with source_type='clearance'. */
export interface SourceClearance {
  source_id: string
  level: ClearanceLevel
  polygraph: ClearancePolygraph | null
  status: ClearanceStatus
  type: ClearanceType
  sponsor_organization_id: string | null
  continuous_investigation: number
  access_programs: ClearanceAccessProgram[]
  investigation_date: string | null
  adjudication_date: string | null
  reinvestigation_date: string | null
  read_on: string | null
  /** @deprecated Use sponsor_organization_id. Kept for legacy reads during transition. */
  sponsoring_agency?: string | null
}

/** A bullet point derived from a source. */
export interface Bullet {
  id: string
  content: string
  source_content_snapshot: string
  technologies: string[]
  metrics: string | null
  status: BulletStatus
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  domain: string | null
  created_at: string
}

/** Junction table linking bullets to sources. */
export interface BulletSource {
  bullet_id: string
  source_id: string
  is_primary: number
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
  notes: string | null
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
  is_builtin: number   // SQLite STRICT INTEGER: 0 | 1. Core keeps as number; SDK converts to boolean.
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

/** A resume entry linking a perspective to a resume section. */
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
  notes: string | null
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

/** A user-created note. */
export interface UserNote {
  id: string
  title: string | null
  content: string
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
  | 'contact'

/** A reference linking a note to an entity. */
export interface NoteReference {
  note_id: string
  entity_type: NoteReferenceEntityType
  entity_id: string
}

// ── Domain & Archetype Entities ───────────────────────────────────────

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

// ── Summary Entities ──────────────────────────────────────────────────

/** A reusable professional summary. */
export interface Summary {
  id: string
  title: string
  role: string | null
  tagline: string | null
  description: string | null
  is_template: number  // 0 or 1 (SQLite integer)
  /** Computed via subquery — number of resumes with summary_id = this.id. */
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
  is_template?: number
  notes?: string
}

/** Input for partially updating a Summary. */
export interface UpdateSummary {
  title?: string
  role?: string | null
  tagline?: string | null
  description?: string | null
  is_template?: number
  notes?: string | null
}

// ── User Profile ──────────────────────────────────────────────────────

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

// ── Input Types ───────────────────────────────────────────────────────

/** Input for creating a new Source (with optional extension fields). */
export interface CreateSource {
  title: string
  description: string
  source_type?: SourceType
  start_date?: string
  end_date?: string
  notes?: string
  // Role extension fields
  organization_id?: string
  is_current?: number
  work_arrangement?: string
  base_salary?: number
  total_comp_notes?: string
  // Project extension fields
  is_personal?: number
  url?: string
  // Education extension fields
  education_type?: EducationType
  education_organization_id?: string
  campus_id?: string
  field?: string
  is_in_progress?: number
  credential_id?: string
  expiration_date?: string
  degree_level?: DegreeLevelType
  degree_type?: string
  certificate_subtype?: CertificateSubtype
  gpa?: string
  location?: string
  edu_description?: string
  // Clearance extension fields
  level?: ClearanceLevel
  polygraph?: ClearancePolygraph
  clearance_status?: ClearanceStatus
  clearance_type?: ClearanceType
  sponsor_organization_id?: string
  continuous_investigation?: number
  access_programs?: ClearanceAccessProgram[]
  /** @deprecated Use sponsor_organization_id. */
  sponsoring_agency?: string
}

/** Input for partially updating a Source. */
export interface UpdateSource {
  title?: string
  description?: string
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
  // Role extension fields
  organization_id?: string | null
  is_current?: number
  work_arrangement?: string | null
  base_salary?: number | null
  total_comp_notes?: string | null
  // Project extension fields
  is_personal?: number
  url?: string | null
  // Education extension fields
  education_type?: EducationType
  education_organization_id?: string | null
  campus_id?: string | null
  field?: string | null
  is_in_progress?: number
  credential_id?: string | null
  expiration_date?: string | null
  degree_level?: DegreeLevelType | null
  degree_type?: string | null
  certificate_subtype?: CertificateSubtype | null
  gpa?: string | null
  location?: string | null
  edu_description?: string | null
  // Clearance extension fields
  level?: ClearanceLevel
  polygraph?: ClearancePolygraph | null
  clearance_status?: ClearanceStatus
  clearance_type?: ClearanceType
  sponsor_organization_id?: string | null
  continuous_investigation?: number
  access_programs?: ClearanceAccessProgram[]
  /** @deprecated Use sponsor_organization_id. */
  sponsoring_agency?: string | null
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
  summary_id?: string
}

/** Input for partially updating a Resume. */
export interface UpdateResume {
  name?: string
  target_role?: string
  target_employer?: string
  archetype?: string
  status?: ResumeStatus
  header?: string | null
  summary_id?: string | null
  markdown_override?: string | null
  latex_override?: string | null
}

/** Input for adding a perspective to a resume. */
export interface AddResumePerspective {
  perspective_id: string
  section: string
  position: number
}

/** Input for adding a resume entry. */
export interface AddResumeEntry {
  section_id: string
  perspective_id?: string
  position: number
  content?: string | null
  notes?: string | null
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

// ── Perspective Input Types ───────────────────────────────────────────

/** Input for creating a new Perspective (used by PerspectiveRepository). */
export interface CreatePerspectiveInput {
  bullet_id: string
  content: string
  bullet_content_snapshot: string
  target_archetype: string
  domain: string
  framing: Framing
  status?: PerspectiveStatus
  prompt_log_id?: string
}

/** Input for partially updating a Perspective. */
export interface UpdatePerspectiveInput {
  content?: string
  target_archetype?: string
  domain?: string
  framing?: Framing
}

/** Filter options for listing perspectives. */
export interface PerspectiveFilter {
  bullet_id?: string
  target_archetype?: string
  domain?: string
  framing?: Framing
  status?: PerspectiveStatus
  source_id?: string
}

// ── Audit Types ──────────────────────────────────────────────────────

/** Full derivation chain trace from perspective back to source. */
export interface ChainTrace {
  perspective: Perspective
  bullet: Bullet
  source: Source
}

/** Integrity check comparing content snapshots to current values. */
export interface IntegrityReport {
  perspective_id: string
  bullet_snapshot_matches: boolean
  source_snapshot_matches: boolean
  bullet_diff?: { snapshot: string; current: string }
  source_diff?: { snapshot: string; current: string }
}

// ── Gap Analysis Types ───────────────────────────────────────────────

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

// ── Rich Response Types ───────────────────────────────────────────────

/** A source with its polymorphic extension data. */
export interface SourceWithExtension extends Source {
  extension: SourceRole | SourceProject | SourceEducation | SourceClearance | null
}

/** A source with its associated bullets. */
export interface SourceWithBullets extends Source {
}

/** A bullet with its perspective count. */
export interface BulletWithRelations extends Bullet {
  perspective_count: number
}

/** A perspective with its full derivation chain. */
export interface PerspectiveWithChain extends Perspective {
  bullet: Bullet
  source: Source
}

/** A resume with entries grouped by section. */
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

// ── Resume IR (Intermediate Representation) ───────────────────────────

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

export interface LatexTemplate {
  preamble: string
  renderHeader: (header: ResumeHeader) => string
  renderSection: (section: IRSection) => string
  renderSectionFallback: (section: IRSection) => string
  footer: string
}

export type LintResult =
  | { ok: true }
  | { ok: false; errors: string[] }

// ── Export Types ────────────────────────────────────────────────────────

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
  summaries?: unknown[]       // typed as unknown[] until Spec 2 lands
  job_descriptions?: unknown[] // typed as unknown[] until Spec 4 lands
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
