/**
 * CertificationService tests (Phase 85 T85.5, updated for migration 041).
 *
 * Acceptance criteria from the phase plan:
 *   [x] Skill FK validated
 *   [x] short_name + long_name required validation
 *   [x] education_source_id validation removed (column dropped)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSkill, testUuid } from '../../db/__tests__/helpers'
import { CertificationService } from '../certification-service'

describe('CertificationService', () => {
  let db: Database
  let service: CertificationService

  beforeEach(() => {
    db = createTestDb()
    service = new CertificationService(db)
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: short_name + long_name required validation
  // ────────────────────────────────────────────────────────────────

  describe('short_name / long_name validation', () => {
    test('accepts non-empty short_name + long_name', () => {
      const result = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(result.ok).toBe(true)
    })

    test('rejects empty short_name', () => {
      const result = service.create({ short_name: '', long_name: 'Something' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('short_name')
      }
    })

    test('rejects whitespace-only short_name', () => {
      const result = service.create({ short_name: '   ', long_name: 'Something' })
      expect(result.ok).toBe(false)
    })

    test('rejects empty long_name', () => {
      const result = service.create({ short_name: 'CISSP', long_name: '' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('long_name')
      }
    })

    test('rejects whitespace-only long_name', () => {
      const result = service.create({ short_name: 'CISSP', long_name: '   ' })
      expect(result.ok).toBe(false)
    })

    test('trims short_name on create', () => {
      const result = service.create({ short_name: '  PMP  ', long_name: 'Project Management Professional' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.short_name).toBe('PMP')
    })

    test('trims long_name on create', () => {
      const result = service.create({ short_name: 'PMP', long_name: '  Project Management Professional  ' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.long_name).toBe('Project Management Professional')
    })

    test('update rejects empty short_name', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = service.update(created.data.id, { short_name: '' })
      expect(result.ok).toBe(false)
    })

    test('update rejects empty long_name', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = service.update(created.data.id, { long_name: '' })
      expect(result.ok).toBe(false)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Skill FK validated on addSkill
  // ────────────────────────────────────────────────────────────────

  describe('addSkill validation', () => {
    test('accepts valid certification + skill pair', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'Security' })
      const result = service.addSkill(created.data.id, skillId)
      expect(result.ok).toBe(true)
    })

    test('rejects unknown certification id', () => {
      const skillId = seedSkill(db, { name: 'Security' })
      const result = service.addSkill(testUuid(), skillId)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toContain('Certification')
      }
    })

    test('rejects unknown skill id', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = service.addSkill(created.data.id, testUuid())
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toContain('Skill')
      }
    })

    test('idempotent — second addSkill for same pair is ok', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'Security' })
      expect(service.addSkill(created.data.id, skillId).ok).toBe(true)
      expect(service.addSkill(created.data.id, skillId).ok).toBe(true)

      const skills = service.getSkills(created.data.id)
      expect(skills.ok).toBe(true)
      if (skills.ok) expect(skills.data).toHaveLength(1)
    })
  })

  describe('removeSkill', () => {
    test('removes a linked skill', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'Security' })
      service.addSkill(created.data.id, skillId)

      const result = service.removeSkill(created.data.id, skillId)
      expect(result.ok).toBe(true)

      const skills = service.getSkills(created.data.id)
      if (skills.ok) expect(skills.data).toHaveLength(0)
    })

    test('rejects unknown certification id', () => {
      const skillId = seedSkill(db, { name: 'Security' })
      const result = service.removeSkill(testUuid(), skillId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })

    test('idempotent — removing nonexistent link is ok', () => {
      const created = service.create({ short_name: 'PMP', long_name: 'Project Management Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'PM' })
      const result = service.removeSkill(created.data.id, skillId)
      expect(result.ok).toBe(true)
    })
  })

  describe('getSkills()', () => {
    test('returns linked skills', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const s1 = seedSkill(db, { name: 'Security' })
      const s2 = seedSkill(db, { name: 'Risk' })
      service.addSkill(created.data.id, s1)
      service.addSkill(created.data.id, s2)

      const result = service.getSkills(created.data.id)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(2)
        expect(result.data.map((s) => s.name).sort()).toEqual(['Risk', 'Security'])
      }
    })

    test('rejects unknown certification id', () => {
      const result = service.getSkills(testUuid())
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Service methods: get/getWithSkills/list/listWithSkills/update/delete
  // ────────────────────────────────────────────────────────────────

  describe('get() and getWithSkills()', () => {
    test('get returns ok for existing cert', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      if (!created.ok) return

      const result = service.get(created.data.id)
      expect(result.ok).toBe(true)
    })

    test('get returns NOT_FOUND for unknown id', () => {
      const result = service.get(testUuid())
      expect(result.ok).toBe(false)
    })

    test('getWithSkills returns hydrated cert', () => {
      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'Security' })
      service.addSkill(created.data.id, skillId)

      const result = service.getWithSkills(created.data.id)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.skills).toHaveLength(1)
        expect(result.data.skills[0].id).toBe(skillId)
      }
    })

    test('getWithSkills returns NOT_FOUND for unknown', () => {
      const result = service.getWithSkills(testUuid())
      expect(result.ok).toBe(false)
    })
  })

  describe('list() and listWithSkills()', () => {
    test('list returns all certs', () => {
      service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      service.create({ short_name: 'PMP', long_name: 'Project Management Professional' })
      service.create({ short_name: 'AWS SA Pro', long_name: 'AWS Solutions Architect Professional' })

      const result = service.list()
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toHaveLength(3)
    })

    test('listWithSkills hydrates skills arrays', () => {
      const cissp = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      const pmp = service.create({ short_name: 'PMP', long_name: 'Project Management Professional' })
      expect(cissp.ok && pmp.ok).toBe(true)
      if (!(cissp.ok && pmp.ok)) return

      const sec = seedSkill(db, { name: 'Security' })
      const pm = seedSkill(db, { name: 'PM' })
      service.addSkill(cissp.data.id, sec)
      service.addSkill(pmp.data.id, pm)

      const result = service.listWithSkills()
      expect(result.ok).toBe(true)
      if (result.ok) {
        const byName = Object.fromEntries(result.data.map((c) => [c.short_name, c]))
        expect(byName['CISSP'].skills[0].name).toBe('Security')
        expect(byName['PMP'].skills[0].name).toBe('PM')
      }
    })
  })

  describe('update()', () => {
    test('updates issuer_id', () => {
      const orgId = crypto.randomUUID()
      db.run('INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)', [orgId, 'ISC2', 'company'])

      const created = service.create({ short_name: 'CISSP', long_name: 'Certified Information Systems Security Professional' })
      if (!created.ok) return

      const result = service.update(created.data.id, { issuer_id: orgId })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.issuer_id).toBe(orgId)
    })

    test('returns NOT_FOUND for unknown id', () => {
      const result = service.update(testUuid(), { short_name: 'Nope' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })

    test('trims short_name on update', () => {
      const created = service.create({ short_name: 'Old', long_name: 'Old Long' })
      if (!created.ok) return

      const result = service.update(created.data.id, { short_name: '  New  ' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.short_name).toBe('New')
    })

    test('trims long_name on update', () => {
      const created = service.create({ short_name: 'X', long_name: 'Old Long' })
      if (!created.ok) return

      const result = service.update(created.data.id, { long_name: '  New Long  ' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.long_name).toBe('New Long')
    })
  })

  describe('delete()', () => {
    test('deletes existing', () => {
      const created = service.create({ short_name: 'Temp', long_name: 'Temporary' })
      if (!created.ok) return

      expect(service.delete(created.data.id).ok).toBe(true)
      expect(service.get(created.data.id).ok).toBe(false)
    })

    test('returns NOT_FOUND for unknown id', () => {
      const result = service.delete(testUuid())
      expect(result.ok).toBe(false)
    })

    test('cascade removes skill links on delete', () => {
      const created = service.create({ short_name: 'Temp', long_name: 'Temporary' })
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'Sec' })
      service.addSkill(created.data.id, skillId)

      service.delete(created.data.id)

      const count = db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE certification_id = ?')
        .get(created.data.id) as { c: number }
      expect(count.c).toBe(0)
    })
  })
})
