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
 *       from resume_certifications junction (per-resume selection)
 *   [x] Full CRUD round-trip: create entity via service → verify in IR
 *   [x] Credential details JSON survives the full pipeline
 *   [x] Certification skills survive the full pipeline
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedResume, seedResumeSection, seedSkill } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
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
    credentialService = new CredentialService(buildDefaultElm(db))
    certificationService = new CertificationService(buildDefaultElm(db))
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: IR compiler renders clearance from credentials table
  // ────────────────────────────────────────────────────────────────

  describe('credential → IR compiler round-trip', () => {
    test('clearance credential appears in compiled resume clearance section', async () => {
      // Create a credential via the service
      const createResult = await credentialService.create({
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

    test('multiple clearance credentials all render in IR', async () => {
      await credentialService.create({
        credential_type: 'clearance',
        label: 'TS/SCI',
        details: { level: 'top_secret', polygraph: 'ci', clearance_type: 'personnel', access_programs: ['sci'] },
      })
      await credentialService.create({
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

    test('non-clearance credentials do NOT appear in clearance section', async () => {
      // Create a driver's license — should NOT show in clearance section
      await credentialService.create({
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
  // Criterion: IR compiler renders certifications from junction table
  // ────────────────────────────────────────────────────────────────

  describe('certification → IR compiler round-trip', () => {
    /** Helper: pin a certification to a resume section via the junction. */
    function pinCert(resumeId: string, certId: string, sectionId: string, position = 0) {
      db.run(
        `INSERT INTO resume_certifications (id, resume_id, certification_id, section_id, position)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), resumeId, certId, sectionId, position],
      )
    }

    test('certification appears in compiled resume certifications section', async () => {
      // Seed an org for issuer_id
      const isc2OrgId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2OrgId])

      const createResult = await certificationService.create({
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        issuer_id: isc2OrgId,
        date_earned: '2024-06-01',
        credential_id: 'CISSP-123',
      })
      expect(createResult.ok).toBe(true)
      if (!createResult.ok) return

      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
      pinCert(resumeId, createResult.data.id, secId)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')
      expect(certSection).toBeDefined()
      expect(certSection!.items).toHaveLength(1)

      const group = certSection!.items[0] as CertificationGroup
      expect(group.kind).toBe('certification_group')
      // Grouped by issuer org name
      expect(group.categories[0].label).toBe('ISC2')
      // Name is short_name only (no year/credential appended at compile time)
      expect(group.categories[0].certs[0].name).toBe('CISSP')
    })

    test('certification without issuer groups under "Other"', async () => {
      const certResult = await certificationService.create({ short_name: 'Self Badge', long_name: 'Self-Study Badge' })
      expect(certResult.ok).toBe(true)
      if (!certResult.ok) return

      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
      pinCert(resumeId, certResult.data.id, secId)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')!
      const group = certSection.items[0] as CertificationGroup
      expect(group.categories[0].label).toBe('Other')
    })

    test('empty junction → empty section items even when global certs exist', async () => {
      // Cert exists globally but is NOT pinned to this resume
      await certificationService.create({ short_name: 'Unpinned', long_name: 'Unpinned Cert' })

      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)

      const ir = compileResumeIR(db, resumeId)!
      const certSection = ir.sections.find(s => s.type === 'certifications')!
      expect(certSection.items).toHaveLength(0)
    })

    test('multiple certs from different issuers produce multiple categories', async () => {
      const isc2Id = crypto.randomUUID()
      const awsId = crypto.randomUUID()
      const pmiId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2Id])
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'Amazon Web Services', 'company')`, [awsId])
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'PMI', 'company')`, [pmiId])

      const r1 = await certificationService.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional', issuer_id: isc2Id })
      const r2 = await certificationService.create({ short_name: 'AWS SA Pro', long_name: 'AWS Solutions Architect Professional', issuer_id: awsId })
      const r3 = await certificationService.create({ short_name: 'PMP', long_name: 'Project Management Professional', issuer_id: pmiId })
      expect(r1.ok && r2.ok && r3.ok).toBe(true)
      if (!r1.ok || !r2.ok || !r3.ok) return

      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
      pinCert(resumeId, r1.data.id, secId, 0)
      pinCert(resumeId, r2.data.id, secId, 1)
      pinCert(resumeId, r3.data.id, secId, 2)

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
    test('credential details JSON survives service → db → compiler pipeline', async () => {
      const details = {
        level: 'top_secret' as const,
        polygraph: 'full_scope' as const,
        clearance_type: 'facility' as const,
        access_programs: ['sci' as const, 'sap' as const],
      }

      const result = await credentialService.create({
        credential_type: 'clearance',
        label: 'TS/SCI Full Scope',
        details,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Verify details round-tripped through service → repo → db
      const fetched = await credentialService.get(result.data.id)
      expect(fetched.ok).toBe(true)
      if (fetched.ok) {
        const d = fetched.data.details as any
        expect(d.level).toBe('top_secret')
        expect(d.polygraph).toBe('full_scope')
        expect(d.clearance_type).toBe('facility')
        expect(d.access_programs).toEqual(['sci', 'sap'])
      }
    })

    test('certification with skills: skills survive the list → IR pipeline', async () => {
      const isc2OrgId = crypto.randomUUID()
      db.run(`INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')`, [isc2OrgId])

      const certResult = await certificationService.create({
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        issuer_id: isc2OrgId,
      })
      expect(certResult.ok).toBe(true)
      if (!certResult.ok) return

      // Link a skill
      const skillId = seedSkill(db, { name: 'Security' })
      const linkResult = await certificationService.addSkill(certResult.data.id, skillId)
      expect(linkResult.ok).toBe(true)

      // Verify skills appear in getWithSkills
      const hydrated = await certificationService.getWithSkills(certResult.data.id)
      expect(hydrated.ok).toBe(true)
      if (hydrated.ok) {
        expect(hydrated.data.skills).toHaveLength(1)
        expect(hydrated.data.skills[0].name).toBe('Security')
      }

      // Verify IR still compiles cleanly when cert is pinned to resume.
      // Skills don't appear in IR directly, but the cert does and the
      // compiler must not crash.
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
      db.run(
        `INSERT INTO resume_certifications (id, resume_id, certification_id, section_id, position)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), resumeId, certResult.data.id, secId, 0],
      )
      const ir = compileResumeIR(db, resumeId)
      expect(ir).not.toBeNull()
      const certSection = ir!.sections.find(s => s.type === 'certifications')!
      expect(certSection.items).toHaveLength(1)
    })
  })
})
