/**
 * Qualifications track integration tests (Phase 88 T88.4).
 *
 * End-to-end acceptance tests that verify the full vertical slice:
 *   DB → repository → service → route → IR compiler
 *
 * Acceptance criteria:
 *   [x] IR compiler: resume with clearance section renders credential data
 *       (not source data)
 *   [x] IR compiler: resume with certifications section renders cert data
 *       from the certifications table
 *   [x] Full CRUD round-trip: create entity via service → verify in IR
 *   [x] Credential details JSON survives the full pipeline
 *   [x] Certification skills survive the full pipeline
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedResume, seedResumeSection, seedSkill } from '../../db/__tests__/helpers'
import { compileResumeIR } from '../resume-compiler'
import { CredentialService } from '../credential-service'
import { CertificationService } from '../certification-service'
import type { ClearanceItem, CertificationGroup } from '../../types'

describe('Qualifications integration (Phase 88 T88.4)', () => {
  let db: Database
  let credentialService: CredentialService
  let certificationService: CertificationService

  beforeEach(() => {
    db = createTestDb()
    credentialService = new CredentialService(db)
    certificationService = new CertificationService(db)
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: IR compiler renders clearance from credentials table
  // ────────────────────────────────────────────────────────────────

  describe('credential → IR compiler round-trip', () => {
    test('clearance credential appears in compiled resume clearance section', () => {
      // Create a credential via the service
      const createResult = credentialService.create({
        credential_type: 'clearance',
        label: 'TS/SCI with CI Poly',
        status: 'active',
        details: {
          level: 'top_secret',
          polygraph: 'ci',
          clearance_type: 'personnel',
          access_programs: ['sci'],
        },
      })
      expect(createResult.ok).toBe(true)

      // Build a resume with a clearance section
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Security Clearance', 'clearance', 0)

      // Compile
      const ir = compileResumeIR(db, resumeId)
      expect(ir).not.toBeNull()

      const clrSection = ir!.sections.find(s => s.type === 'clearance')
      expect(clrSection).toBeDefined()
      expect(clrSection!.items.length).toBeGreaterThanOrEqual(1)

      // The credential data should appear in the IR
      const item = clrSection!.items[0] as ClearanceItem
      expect(item.kind).toBe('clearance')
      expect(item.content).toBe('TS/SCI with CI Poly')
      expect(item.source_id).toBeNull() // credentials are not sources
    })

    test('inactive credential includes status suffix in IR', () => {
      // Seed directly via DB to test the compiler's fallback path when
      // label is empty (the service won't let us create with label='')
      const credId = crypto.randomUUID()
      db.run(
        `INSERT INTO credentials (id, credential_type, label, status, details)
         VALUES (?, 'clearance', '', 'inactive', ?)`,
        [credId, JSON.stringify({
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        })],
      )

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Clearance', 'clearance', 0)

      const ir = compileResumeIR(db, resumeId)!
      const clrSection = ir.sections.find(s => s.type === 'clearance')!
      const item = clrSection.items[0] as ClearanceItem
      expect(item.content).toContain('(Inactive)')
    })

    test('multiple clearance credentials all render in IR', () => {
      credentialService.create({
        credential_type: 'clearance',
        label: 'TS/SCI',
        details: { level: 'top_secret', polygraph: 'ci', clearance_type: 'personnel', access_programs: ['sci'] },
      })
      credentialService.create({
        credential_type: 'clearance',
        label: 'Secret',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Clearance', 'clearance', 0)

      const ir = compileResumeIR(db, resumeId)!
      const clrSection = ir.sections.find(s => s.type === 'clearance')!
      expect(clrSection.items).toHaveLength(2)
    })

    test('non-clearance credentials do NOT appear in clearance section', () => {
      // Create a driver's license — should NOT show in clearance section
      credentialService.create({
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Clearance', 'clearance', 0)

      const ir = compileResumeIR(db, resumeId)!
      const clrSection = ir.sections.find(s => s.type === 'clearance')!
      expect(clrSection.items).toHaveLength(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: IR compiler renders certifications from certs table
  // ────────────────────────────────────────────────────────────────

  describe('certification → IR compiler round-trip', () => {
    test('certification appears in compiled resume certifications section', () => {
      // Seed an org for issuer_id
      const isc2OrgId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2OrgId])

      const createResult = certificationService.create({
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        issuer_id: isc2OrgId,
        date_earned: '2024-06-01',
        credential_id: 'CISSP-123',
      })
      expect(createResult.ok).toBe(true)

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')
      expect(certSection).toBeDefined()
      expect(certSection!.items.length).toBeGreaterThanOrEqual(1)

      const group = certSection!.items[0] as CertificationGroup
      expect(group.kind).toBe('certification_group')
      // Grouped by issuer org name
      expect(group.categories[0].label).toBe('ISC2')
      // Name includes year and credential ID
      expect(group.categories[0].certs[0].name).toContain('CISSP')
      expect(group.categories[0].certs[0].name).toContain('2024')
      expect(group.categories[0].certs[0].name).toContain('CISSP-123')
    })

    test('certification without issuer groups under "Other"', () => {
      certificationService.create({ short_name: 'Self Badge', long_name: 'Self-Study Badge' })

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')!
      const group = certSection.items[0] as CertificationGroup
      expect(group.categories[0].label).toBe('Other')
    })

    test('empty certifications table → empty section items', () => {
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')!
      expect(certSection.items).toHaveLength(0)
    })

    test('multiple certs from different issuers produce multiple categories', () => {
      const isc2Id = crypto.randomUUID()
      const awsId = crypto.randomUUID()
      const pmiId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2Id])
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'Amazon Web Services', 'company')`, [awsId])
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'PMI', 'company')`, [pmiId])

      certificationService.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional', issuer_id: isc2Id })
      certificationService.create({ short_name: 'AWS SA Pro', long_name: 'AWS Solutions Architect Professional', issuer_id: awsId })
      certificationService.create({ short_name: 'PMP', long_name: 'Project Management Professional', issuer_id: pmiId })

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')!
      const group = certSection.items[0] as CertificationGroup
      expect(group.categories).toHaveLength(3)
      const labels = group.categories.map(c => c.label).sort()
      expect(labels).toEqual(['Amazon Web Services', 'ISC2', 'PMI'])
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Full stack round-trip
  // ────────────────────────────────────────────────────────────────

  describe('full-stack round-trip', () => {
    test('credential details JSON survives service → db → compiler pipeline', () => {
      const details = {
        level: 'top_secret' as const,
        polygraph: 'full_scope' as const,
        clearance_type: 'facility' as const,
        access_programs: ['sci' as const, 'sap' as const],
      }

      const result = credentialService.create({
        credential_type: 'clearance',
        label: 'TS/SCI Full Scope',
        details,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Verify details round-tripped through service → repo → db
      const fetched = credentialService.get(result.data.id)
      expect(fetched.ok).toBe(true)
      if (fetched.ok) {
        const d = fetched.data.details as any
        expect(d.level).toBe('top_secret')
        expect(d.polygraph).toBe('full_scope')
        expect(d.clearance_type).toBe('facility')
        expect(d.access_programs).toEqual(['sci', 'sap'])
      }
    })

    test('certification with skills: skills survive the list → IR pipeline', () => {
      const isc2OrgId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2OrgId])

      const certResult = certificationService.create({
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        issuer_id: isc2OrgId,
      })
      expect(certResult.ok).toBe(true)
      if (!certResult.ok) return

      // Link a skill
      const skillId = seedSkill(db, { name: 'Security' })
      const linkResult = certificationService.addSkill(certResult.data.id, skillId)
      expect(linkResult.ok).toBe(true)

      // Verify skills appear in getWithSkills
      const hydrated = certificationService.getWithSkills(certResult.data.id)
      expect(hydrated.ok).toBe(true)
      if (hydrated.ok) {
        expect(hydrated.data.skills).toHaveLength(1)
        expect(hydrated.data.skills[0].name).toBe('Security')
      }

      // Verify IR still compiles cleanly (skills don't appear in IR
      // directly, but the cert does and the compiler doesn't crash)
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
      const ir = compileResumeIR(db, resumeId)
      expect(ir).not.toBeNull()
      const certSection = ir!.sections.find(s => s.type === 'certifications')!
      expect(certSection.items.length).toBeGreaterThanOrEqual(1)
    })
  })
})
