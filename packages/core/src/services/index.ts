/**
 * Service layer — public interface.
 *
 * createServices(db) is called once at server startup. Route handlers
 * receive the returned object via closure.
 *
 * Phase 1.8: All services receive a shared EntityLifecycleManager (ELM).
 * Only ResumeService and ExportService retain a `db` parameter for raw
 * SQL queries that will become named queries in Phase 2.
 */

import type { Database } from 'bun:sqlite'
import { buildDefaultElm } from '../storage/build-elm'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { EntityMapDeps } from '../storage/entity-map'
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
import { CredentialService } from './credential-service'
import { CertificationService } from './certification-service'
import { OrgLocationService } from './org-location-service'
import { EmbeddingService } from './embedding-service'
import { AddressService } from './address-service'
import { AnswerBankService } from './answer-bank-service'
import { ExtensionConfigService } from './extension-config-service'
import { ExtensionLogService } from './extension-log-service'

export interface Services {
  /**
   * Entity lifecycle manager — the storage integrity layer.
   * Exposed on the Services object so routes/tests can call through it
   * directly if needed; most consumers should go through a service.
   */
  elm: EntityLifecycleManager
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
  credentials: CredentialService
  certifications: CertificationService
  orgLocations: OrgLocationService
  addresses: AddressService
  answerBank: AnswerBankService
  extensionConfig: ExtensionConfigService
  extensionLogs: ExtensionLogService
  embedding?: EmbeddingService // Optional: async-initialized, injected post-createServices()
}

// Re-export for backwards compatibility with any callers that imported
// from `services/index.ts` before Phase 1.0.
export { buildDefaultElm } from '../storage/build-elm'

/**
 * Create all services with shared database connection and a shared
 * EntityLifecycleManager.
 *
 * DerivationService uses DB-level locking (pending_derivations table) — no
 * in-memory Set needed.
 */
export function createServices(
  db: Database,
  dbPath: string,
  entityMapDeps: EntityMapDeps = {},
): Services {
  const elm = buildDefaultElm(db, entityMapDeps)

  return {
    elm,
    sources: new SourceService(elm),
    bullets: new BulletService(elm),
    perspectives: new PerspectiveService(elm),
    derivation: new DerivationService(elm),
    resumes: new ResumeService(db, elm),
    audit: new AuditService(elm),
    review: new ReviewService(elm),
    organizations: new OrganizationService(elm),
    notes: new NoteService(elm),
    integrity: new IntegrityService(elm),
    domains: new DomainService(elm),
    archetypes: new ArchetypeService(elm),
    profile: new ProfileService(elm),
    jobDescriptions: new JobDescriptionService(elm),
    templates: new TemplateService(elm),
    export: new ExportService(db, dbPath, elm),
    summaries: new SummaryService(elm),
    contacts: new ContactService(elm),
    industries: new IndustryService(elm),
    roleTypes: new RoleTypeService(elm),
    skills: new SkillService(elm),
    credentials: new CredentialService(elm),
    certifications: new CertificationService(elm),
    orgLocations: new OrgLocationService(elm),
    addresses: new AddressService(elm),
    answerBank: new AnswerBankService(elm),
    extensionConfig: new ExtensionConfigService(db),
    extensionLogs: new ExtensionLogService(elm),
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
export { CredentialService } from './credential-service'
export { CertificationService } from './certification-service'
export { OrgLocationService } from './org-location-service'
export { EmbeddingService } from './embedding-service'
export { AnswerBankService } from './answer-bank-service'
export { ExtensionConfigService } from './extension-config-service'
export { ExtensionLogService } from './extension-log-service'
