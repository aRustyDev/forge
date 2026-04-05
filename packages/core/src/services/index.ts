/**
 * Service layer — public interface.
 *
 * createServices(db) is called once at server startup. Route handlers
 * receive the returned object via closure.
 */

import type { Database } from 'bun:sqlite'
import { SourceService } from './source-service'
import { BulletService } from './bullet-service'
import { PerspectiveService } from './perspective-service'
import { DerivationService } from './derivation-service'
import { ResumeService } from './resume-service'
import { AuditService } from './audit-service'
import { ReviewService } from './review-service'
import { OrganizationService } from './organization-service'
import { NoteService } from './note-service'
import { IntegrityService } from './integrity-service'
import { DomainService } from './domain-service'
import { ArchetypeService } from './archetype-service'
import { ProfileService } from './profile-service'
import { JobDescriptionService } from './job-description-service'
import { TemplateService } from './template-service'
import { ExportService } from './export-service'
import { SummaryService } from './summary-service'
import { ContactService } from './contact-service'
import { IndustryService } from './industry-service'
import { RoleTypeService } from './role-type-service'
import { SkillService } from './skill-service'
import { EmbeddingService } from './embedding-service'

export interface Services {
  sources: SourceService
  bullets: BulletService
  perspectives: PerspectiveService
  derivation: DerivationService
  resumes: ResumeService
  audit: AuditService
  review: ReviewService
  organizations: OrganizationService
  notes: NoteService
  integrity: IntegrityService
  domains: DomainService
  archetypes: ArchetypeService
  profile: ProfileService
  jobDescriptions: JobDescriptionService
  templates: TemplateService
  export: ExportService
  summaries: SummaryService
  contacts: ContactService
  industries: IndustryService
  roleTypes: RoleTypeService
  skills: SkillService
  embedding?: EmbeddingService  // Optional: async-initialized, injected post-createServices()
}

/**
 * Create all services with shared database connection.
 * The in-memory derivation lock Set is a singleton for bullet derivation.
 */
export function createServices(db: Database, dbPath: string): Services {
  const derivingBullets = new Set<string>()

  return {
    sources: new SourceService(db),
    bullets: new BulletService(db),
    perspectives: new PerspectiveService(db),
    derivation: new DerivationService(db, derivingBullets),
    resumes: new ResumeService(db),
    audit: new AuditService(db),
    review: new ReviewService(db),
    organizations: new OrganizationService(db),
    notes: new NoteService(db),
    integrity: new IntegrityService(db),
    domains: new DomainService(db),
    archetypes: new ArchetypeService(db),
    profile: new ProfileService(db),
    jobDescriptions: new JobDescriptionService(db),
    templates: new TemplateService(db),
    export: new ExportService(db, dbPath),
    summaries: new SummaryService(db),
    contacts: new ContactService(db),
    industries: new IndustryService(db),
    roleTypes: new RoleTypeService(db),
    skills: new SkillService(db),
  }
}

// Re-export service classes
export { SourceService } from './source-service'
export { BulletService } from './bullet-service'
export { PerspectiveService } from './perspective-service'
export { DerivationService } from './derivation-service'
export { ResumeService } from './resume-service'
export { AuditService } from './audit-service'
export { ReviewService } from './review-service'
export { OrganizationService } from './organization-service'
export { NoteService } from './note-service'
export { IntegrityService } from './integrity-service'
export { DomainService } from './domain-service'
export { ArchetypeService } from './archetype-service'
export { ProfileService } from './profile-service'
export { JobDescriptionService } from './job-description-service'
export { TemplateService } from './template-service'
export { ExportService } from './export-service'
export { SummaryService } from './summary-service'
export { ContactService } from './contact-service'
export { IndustryService } from './industry-service'
export { RoleTypeService } from './role-type-service'
export { SkillService } from './skill-service'
export { EmbeddingService } from './embedding-service'
