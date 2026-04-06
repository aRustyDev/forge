/**
 * CertificationRepository tests (Phase 85 T85.3, updated for migration 041).
 *
 * Acceptance criteria from the phase plan:
 *   [x] All 10 methods implemented and tested
 *   [x] Skill junction operations are idempotent
 *   [x] WithSkills variants return populated skills array
 *   [x] New schema fields: short_name, long_name, cert_id, issuer_id,
 *       credly_url, in_progress
 *
 * Methods covered: create, findById, findAll, update, del,
 * addSkill, removeSkill, getSkills, findByIdWithSkills, findAllWithSkills.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSkill, testUuid } from '../../__tests__/helpers'
import * as CertificationRepo from '../certification-repository'

describe('CertificationRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: All 10 methods implemented and tested
  // ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    test('inserts a certification with generated UUID + minimal fields', () => {
      const cert = CertificationRepo.create(db, { short_name: 'PMP', long_name: 'Project Management Professional' })
      expect(cert.id).toHaveLength(36)
      expect(cert.short_name).toBe('PMP')
      expect(cert.long_name).toBe('Project Management Professional')
      expect(cert.cert_id).toBeNull()
      expect(cert.issuer_id).toBeNull()
      expect(cert.date_earned).toBeNull()
      expect(cert.expiry_date).toBeNull()
      expect(cert.credential_id).toBeNull()
      expect(cert.credential_url).toBeNull()
      expect(cert.credly_url).toBeNull()
      expect(cert.in_progress).toBe(false)
      expect(cert.created_at).toBeTruthy()
    })

    test('accepts all optional fields', () => {
      // Seed an org for issuer_id FK
      const orgId = crypto.randomUUID()
      db.run(
        `INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)`,
        [orgId, 'ISC2', 'company'],
      )

      const cert = CertificationRepo.create(db, {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        cert_id: 'CISSP-2023',
        issuer_id: orgId,
        date_earned: '2023-06-01',
        expiry_date: '2026-06-01',
        credential_id: 'CISSP-123456',
        credential_url: 'https://isc2.org/verify/123456',
        credly_url: 'https://credly.com/badges/abc',
        in_progress: false,
      })
      expect(cert.short_name).toBe('CISSP')
      expect(cert.long_name).toBe('Certified Information Systems Security Professional')
      expect(cert.cert_id).toBe('CISSP-2023')
      expect(cert.issuer_id).toBe(orgId)
      expect(cert.date_earned).toBe('2023-06-01')
      expect(cert.expiry_date).toBe('2026-06-01')
      expect(cert.credential_id).toBe('CISSP-123456')
      expect(cert.credential_url).toBe('https://isc2.org/verify/123456')
      expect(cert.credly_url).toBe('https://credly.com/badges/abc')
      expect(cert.in_progress).toBe(false)
    })

    test('in_progress flag converts to boolean', () => {
      const cert = CertificationRepo.create(db, {
        short_name: 'AWS SAP',
        long_name: 'AWS Solutions Architect Professional',
        in_progress: true,
      })
      expect(cert.in_progress).toBe(true)
    })
  })

  describe('findById()', () => {
    test('returns the certification', () => {
      const created = CertificationRepo.create(db, { short_name: 'AWS SA Pro', long_name: 'AWS Solutions Architect Professional' })
      const found = CertificationRepo.findById(db, created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.short_name).toBe('AWS SA Pro')
    })

    test('returns null for unknown id', () => {
      expect(CertificationRepo.findById(db, testUuid())).toBeNull()
    })
  })

  describe('findAll()', () => {
    test('returns empty array when none exist', () => {
      expect(CertificationRepo.findAll(db)).toEqual([])
    })

    test('returns all certifications ordered by short_name', () => {
      CertificationRepo.create(db, { short_name: 'Zeta', long_name: 'Zeta Cert' })
      CertificationRepo.create(db, { short_name: 'Alpha', long_name: 'Alpha Cert' })
      CertificationRepo.create(db, { short_name: 'Mu', long_name: 'Mu Cert' })

      const all = CertificationRepo.findAll(db)
      expect(all.map((c) => c.short_name)).toEqual(['Alpha', 'Mu', 'Zeta'])
    })
  })

  describe('update()', () => {
    test('updates short_name', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Old', long_name: 'Old Long' })
      const updated = CertificationRepo.update(db, cert.id, { short_name: 'New' })
      expect(updated!.short_name).toBe('New')
    })

    test('updates long_name', () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'Old Long' })
      const updated = CertificationRepo.update(db, cert.id, { long_name: 'New Long Name' })
      expect(updated!.long_name).toBe('New Long Name')
    })

    test('updates issuer_id (including clearing to null)', () => {
      const orgId = crypto.randomUUID()
      db.run('INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)', [orgId, 'Acme', 'company'])

      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long', issuer_id: orgId })
      const cleared = CertificationRepo.update(db, cert.id, { issuer_id: null })
      expect(cleared!.issuer_id).toBeNull()
    })

    test('updates dates', () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long' })
      const updated = CertificationRepo.update(db, cert.id, {
        date_earned: '2024-01-15',
        expiry_date: '2027-01-15',
      })
      expect(updated!.date_earned).toBe('2024-01-15')
      expect(updated!.expiry_date).toBe('2027-01-15')
    })

    test('updates credential_id and credential_url', () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long' })
      const updated = CertificationRepo.update(db, cert.id, {
        credential_id: 'ABC-999',
        credential_url: 'https://verify.example/ABC-999',
      })
      expect(updated!.credential_id).toBe('ABC-999')
      expect(updated!.credential_url).toBe('https://verify.example/ABC-999')
    })

    test('updates cert_id and credly_url', () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long' })
      const updated = CertificationRepo.update(db, cert.id, {
        cert_id: 'SAA-C03',
        credly_url: 'https://credly.com/badges/xyz',
      })
      expect(updated!.cert_id).toBe('SAA-C03')
      expect(updated!.credly_url).toBe('https://credly.com/badges/xyz')
    })

    test('updates in_progress flag', () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long' })
      const updated = CertificationRepo.update(db, cert.id, { in_progress: true })
      expect(updated!.in_progress).toBe(true)

      const toggled = CertificationRepo.update(db, cert.id, { in_progress: false })
      expect(toggled!.in_progress).toBe(false)
    })

    test('returns null for nonexistent id', () => {
      expect(CertificationRepo.update(db, testUuid(), { short_name: 'nope' })).toBeNull()
    })

    test('refreshes updated_at', async () => {
      const cert = CertificationRepo.create(db, { short_name: 'X', long_name: 'X Long' })
      await new Promise((r) => setTimeout(r, 1100))
      const updated = CertificationRepo.update(db, cert.id, { short_name: 'X updated' })
      expect(updated!.updated_at > cert.updated_at).toBe(true)
    })
  })

  describe('del()', () => {
    test('deletes existing certification and returns true', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Temp', long_name: 'Temporary' })
      expect(CertificationRepo.del(db, cert.id)).toBe(true)
      expect(CertificationRepo.findById(db, cert.id)).toBeNull()
    })

    test('returns false for nonexistent id', () => {
      expect(CertificationRepo.del(db, testUuid())).toBe(false)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Skill junction operations are idempotent
  // ────────────────────────────────────────────────────────────────

  describe('addSkill()', () => {
    test('links a skill to a certification', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const skillId = seedSkill(db, { name: 'Security' })

      CertificationRepo.addSkill(db, cert.id, skillId)
      const skills = CertificationRepo.getSkills(db, cert.id)
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe(skillId)
    })

    test('idempotent — re-linking the same pair is a no-op', () => {
      const cert = CertificationRepo.create(db, { short_name: 'PMP', long_name: 'Project Management Professional' })
      const skillId = seedSkill(db, { name: 'PM' })

      CertificationRepo.addSkill(db, cert.id, skillId)
      CertificationRepo.addSkill(db, cert.id, skillId)
      CertificationRepo.addSkill(db, cert.id, skillId)

      expect(CertificationRepo.getSkills(db, cert.id)).toHaveLength(1)
    })

    test('multiple distinct skills accumulate', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const s1 = seedSkill(db, { name: 'Security' })
      const s2 = seedSkill(db, { name: 'Risk' })
      const s3 = seedSkill(db, { name: 'Compliance' })

      CertificationRepo.addSkill(db, cert.id, s1)
      CertificationRepo.addSkill(db, cert.id, s2)
      CertificationRepo.addSkill(db, cert.id, s3)

      expect(CertificationRepo.getSkills(db, cert.id)).toHaveLength(3)
    })
  })

  describe('removeSkill()', () => {
    test('unlinks a skill', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const skillId = seedSkill(db, { name: 'Security' })

      CertificationRepo.addSkill(db, cert.id, skillId)
      expect(CertificationRepo.getSkills(db, cert.id)).toHaveLength(1)

      CertificationRepo.removeSkill(db, cert.id, skillId)
      expect(CertificationRepo.getSkills(db, cert.id)).toHaveLength(0)
    })

    test('idempotent — removing a nonexistent link is a no-op', () => {
      const cert = CertificationRepo.create(db, { short_name: 'PMP', long_name: 'Project Management Professional' })
      const skillId = seedSkill(db, { name: 'PM' })

      expect(() => {
        CertificationRepo.removeSkill(db, cert.id, skillId)
      }).not.toThrow()
    })

    test('removing one skill leaves others intact', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const s1 = seedSkill(db, { name: 'Security' })
      const s2 = seedSkill(db, { name: 'Risk' })

      CertificationRepo.addSkill(db, cert.id, s1)
      CertificationRepo.addSkill(db, cert.id, s2)
      CertificationRepo.removeSkill(db, cert.id, s1)

      const remaining = CertificationRepo.getSkills(db, cert.id)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(s2)
    })
  })

  describe('getSkills()', () => {
    test('returns empty array when no skills linked', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Fresh', long_name: 'Fresh Cert' })
      expect(CertificationRepo.getSkills(db, cert.id)).toEqual([])
    })

    test('returns skills ordered by name', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const z = seedSkill(db, { name: 'Zeta skill' })
      const a = seedSkill(db, { name: 'Alpha skill' })
      const m = seedSkill(db, { name: 'Mu skill' })

      CertificationRepo.addSkill(db, cert.id, z)
      CertificationRepo.addSkill(db, cert.id, a)
      CertificationRepo.addSkill(db, cert.id, m)

      const skills = CertificationRepo.getSkills(db, cert.id)
      expect(skills.map((s) => s.name)).toEqual(['Alpha skill', 'Mu skill', 'Zeta skill'])
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: WithSkills variants return populated skills array
  // ────────────────────────────────────────────────────────────────

  describe('findByIdWithSkills()', () => {
    test('returns certification + populated skills', () => {
      const cert = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const s1 = seedSkill(db, { name: 'Security' })
      const s2 = seedSkill(db, { name: 'Risk' })
      CertificationRepo.addSkill(db, cert.id, s1)
      CertificationRepo.addSkill(db, cert.id, s2)

      const hydrated = CertificationRepo.findByIdWithSkills(db, cert.id)
      expect(hydrated).not.toBeNull()
      expect(hydrated!.id).toBe(cert.id)
      expect(hydrated!.skills).toHaveLength(2)
      expect(hydrated!.skills.map((s) => s.name).sort()).toEqual(['Risk', 'Security'])
    })

    test('returns certification with empty skills array when none linked', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Solo', long_name: 'Solo Cert' })
      const hydrated = CertificationRepo.findByIdWithSkills(db, cert.id)
      expect(hydrated!.skills).toEqual([])
    })

    test('returns null for unknown id', () => {
      expect(CertificationRepo.findByIdWithSkills(db, testUuid())).toBeNull()
    })
  })

  describe('findAllWithSkills()', () => {
    test('returns all certifications with skills populated', () => {
      const cissp = CertificationRepo.create(db, { short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const pmp = CertificationRepo.create(db, { short_name: 'PMP', long_name: 'Project Management Professional' })
      const aws = CertificationRepo.create(db, { short_name: 'AWS SA Pro', long_name: 'AWS Solutions Architect Professional' })

      const sec = seedSkill(db, { name: 'Security' })
      const pm = seedSkill(db, { name: 'Project Management' })
      const cloud = seedSkill(db, { name: 'AWS Cloud' })

      CertificationRepo.addSkill(db, cissp.id, sec)
      CertificationRepo.addSkill(db, pmp.id, pm)
      CertificationRepo.addSkill(db, aws.id, cloud)

      const all = CertificationRepo.findAllWithSkills(db)
      expect(all).toHaveLength(3)

      // Ordered by short_name
      expect(all.map((c) => c.short_name)).toEqual(['AWS SA Pro', 'CISSP', 'PMP'])

      const byName = Object.fromEntries(all.map((c) => [c.short_name, c]))
      expect(byName['CISSP'].skills[0].name).toBe('Security')
      expect(byName['PMP'].skills[0].name).toBe('Project Management')
      expect(byName['AWS SA Pro'].skills[0].name).toBe('AWS Cloud')
    })

    test('returns certifications with no skills as empty arrays', () => {
      CertificationRepo.create(db, { short_name: 'Solo1', long_name: 'Solo One' })
      CertificationRepo.create(db, { short_name: 'Solo2', long_name: 'Solo Two' })

      const all = CertificationRepo.findAllWithSkills(db)
      expect(all).toHaveLength(2)
      for (const cert of all) expect(cert.skills).toEqual([])
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: FK integrity + cascade behavior
  // ────────────────────────────────────────────────────────────────

  describe('FK integrity', () => {
    test('deleting a certification cascades and removes skill links', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Temp', long_name: 'Temporary' })
      const skillId = seedSkill(db, { name: 'Temp skill' })
      CertificationRepo.addSkill(db, cert.id, skillId)

      CertificationRepo.del(db, cert.id)

      const count = db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE certification_id = ?')
        .get(cert.id) as { c: number }
      expect(count.c).toBe(0)
    })

    test('deleting a skill cascades and removes certification links', () => {
      const cert = CertificationRepo.create(db, { short_name: 'Temp', long_name: 'Temporary' })
      const skillId = seedSkill(db, { name: 'Temp skill' })
      CertificationRepo.addSkill(db, cert.id, skillId)

      db.run('DELETE FROM skills WHERE id = ?', [skillId])

      expect(CertificationRepo.getSkills(db, cert.id)).toEqual([])
    })

    test('deleting the linked issuer org sets issuer_id to NULL', () => {
      const orgId = crypto.randomUUID()
      db.run('INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)', [orgId, 'ISC2', 'company'])

      const cert = CertificationRepo.create(db, {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
        issuer_id: orgId,
      })

      db.run('DELETE FROM organizations WHERE id = ?', [orgId])

      const updated = CertificationRepo.findById(db, cert.id)
      expect(updated!.issuer_id).toBeNull()
    })
  })
})
