export { ForgeClient } from './client'
export type { ForgeClientOptions } from './client'

// Debug store + utilities
export { DebugStore, isDevMode } from './debug'
export type { SDKLogEntry, DebugOptions } from './debug'

// Result & error types
export type {
  ForgeError,
  Pagination,
  PaginatedResult,
  PaginationParams,
  Result,
} from './types'

// Core entity types
export type {
  Source,
  Bullet,
  Perspective,
  Resume,
  Organization,
  ResumeEntry,
  ResumeSectionEntity,
  ResumeSkill,
  ResumeTemplate,
  TemplateSectionDef,
  Skill,
  UserNote,
  UserProfile,
  Summary,
} from './types'

// Source type discriminator
export type { SourceType } from './types'

// Extension types
export type {
  SourceRole,
  SourceProject,
  SourceEducation,
  SourceClearance,
} from './types'

// Education sub-type unions
export type { DegreeLevelType, CertificateSubtype, EducationType } from './types'

// Clearance unions
export type {
  ClearanceLevel,
  ClearancePolygraph,
  ClearanceStatus,
  ClearanceType,
  ClearanceAccessProgram,
} from './types'

// Clearance constants
export {
  CLEARANCE_LEVELS,
  CLEARANCE_POLYGRAPHS,
  CLEARANCE_STATUSES,
  CLEARANCE_TYPES,
  CLEARANCE_ACCESS_PROGRAMS,
  CLEARANCE_LEVEL_LABELS,
  CLEARANCE_POLYGRAPH_LABELS,
  CLEARANCE_ACCESS_PROGRAM_LABELS,
} from './types'

// Organization tags, campuses, aliases
export type { OrgTag, OrgCampus, OrgAlias, CampusModality } from './types'

// Rich response types
export type {
  SourceWithBullets,
  BulletWithRelations,
  PerspectiveWithChain,
  ResumeWithEntries,
} from './types'

// Review queue types
export type {
  BulletReviewItem,
  PerspectiveReviewItem,
  ReviewQueue,
} from './types'

// Gap analysis types
export type {
  GapAnalysis,
  Gap,
  MissingDomainGap,
  ThinCoverageGap,
  UnusedBulletGap,
  CoverageSummary,
} from './types'

// Drift / integrity types
export type {
  DriftReport,
  DriftedBullet,
  DriftedPerspective,
  DriftedResumeEntry,
} from './types'

// Note types
export type {
  NoteReference,
  CreateNote,
  UpdateNote,
} from './types'

// Profile types
export type {
  UpdateProfile,
} from './types'

// Bullet source junction
export type { BulletSource } from './types'

// Domain/Archetype entity types
export type {
  Domain,
  Archetype,
  ArchetypeDomain,
} from './types'

// Domain/Archetype input + rich response types
export type {
  CreateDomain,
  UpdateDomain,
  CreateArchetype,
  UpdateArchetype,
  ArchetypeWithDomains,
} from './types'

// Resume IR types
export type {
  ResumeDocument,
  ResumeHeader,
  IRSection,
  IRSectionType,
  IRSectionItem,
  SummaryItem,
  ExperienceGroup,
  ExperienceSubheading,
  ExperienceBullet,
  SkillGroup,
  EducationItem,
  ProjectItem,
  CertificationGroup,
  ClearanceItem,
  PresentationItem,
  LatexTemplate,
  LintResult,
} from './types'

// Input types
export type {
  CreateSource,
  UpdateSource,
  UpdateBullet,
  UpdatePerspective,
  RejectInput,
  DerivePerspectiveInput,
  CreateResume,
  UpdateResume,
  AddResumeEntry,
  UpdateResumeEntry,
  CreateOrganization,
  UpdateOrganization,
  CreateResumeTemplate,
  UpdateResumeTemplate,
} from './types'

// Job description types
export type {
  JobDescription,
  JobDescriptionWithOrg,
  JobDescriptionStatus,
  JobDescriptionFilter,
  CreateJobDescription,
  UpdateJobDescription,
} from './types'

// Note reference entity type (shared)
export type {
  NoteReferenceEntityType,
} from './types'

// Filter types
export type {
  SourceFilter,
  BulletFilter,
  PerspectiveFilter,
  OrganizationFilter,
} from './types'

// Summary types
export type {
  CreateSummary,
  UpdateSummary,
  SummaryFilter,
} from './types'

// Export types
export type { DataExportBundle } from './types'

// Resource classes (for advanced use / testing)
export { SourcesResource } from './resources/sources'
export { BulletsResource } from './resources/bullets'
export { PerspectivesResource } from './resources/perspectives'
export { ResumesResource } from './resources/resumes'
export { ReviewResource } from './resources/review'
export { OrganizationsResource } from './resources/organizations'
export { NotesResource } from './resources/notes'
export { IntegrityResource } from './resources/integrity'
export { DomainsResource } from './resources/domains'
export { ArchetypesResource } from './resources/archetypes'
export { SkillsResource } from './resources/skills'
export { ProfileResource } from './resources/profile'
export { JobDescriptionsResource } from './resources/job-descriptions'
export { TemplatesResource } from './resources/templates'
export { SummariesResource } from './resources/summaries'
export { ExportResource } from './resources/export'
