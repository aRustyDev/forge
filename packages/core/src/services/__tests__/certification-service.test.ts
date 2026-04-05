/**
 * CertificationService tests (Phase 85 T85.5).
 *
 * Acceptance criteria from the phase plan:
 *   [x] Education source type validated (rejects non-education sources)
 *   [x] Skill FK validated
 *   [x] Name required validation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSource, seedSkill, testUuid } from '../../db/__tests__/helpers'
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
  // Criterion: Name required validation
  // ────────────────────────────────────────────────────────────────

  describe('name validation', () => {
    test('accepts non-empty name', () => {
      const result = service.create({ name: 'CISSP' })
      expect(result.ok).toBe(true)
    })

    test('rejects empty name', () => {
      const result = service.create({ name: '' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('name')
      }
    })

    test('rejects whitespace-only name', () => {
      const result = service.create({ name: '   ' })
      expect(result.ok).toBe(false)
    })

    test('trims name on create', () => {
      const result = service.create({ name: '  PMP  ' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.name).toBe('PMP')
    })

    test('update rejects empty name', () => {
      const created = service.create({ name: 'CISSP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = service.update(created.data.id, { name: '' })
      expect(result.ok).toBe(false)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Education source type validated (rejects non-education)
  // ────────────────────────────────────────────────────────────────

  describe('education_source_id validation', () => {
    test('accepts education-type source', () => {
      const sourceId = seedSource(db, { title: 'CISSP Course', sourceType: 'education' })
      const result = service.create({
        name: 'CISSP',
        education_source_id: sourceId,
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.education_source_id).toBe(sourceId)
    })

    test('rejects role-type source', () => {
      const sourceId = seedSource(db, { title: 'Engineer Role', sourceType: 'role' })
      const result = service.create({
        name: 'CISSP',
        education_source_id: sourceId,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('education')
      }
    })

    test('rejects project-type source', () => {
      const sourceId = seedSource(db, { title: 'Side Project', sourceType: 'project' })
      const result = service.create({
        name: 'CISSP',
        education_source_id: sourceId,
      })
      expect(result.ok).toBe(false)
    })

    test('rejects general-type source', () => {
      const sourceId = seedSource(db, { title: 'Misc', sourceType: 'general' })
      const result = service.create({
        name: 'CISSP',
        education_source_id: sourceId,
      })
      expect(result.ok).toBe(false)
    })

    test('rejects unknown source id with NOT_FOUND', () => {
      const result = service.create({
        name: 'CISSP',
        education_source_id: testUuid(),
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toContain('Source')
      }
    })

    test('accepts missing education_source_id (optional)', () => {
      const result = service.create({ name: 'Unlinked cert' })
      expect(result.ok).toBe(true)
    })

    test('update validates education_source_id when changed', () => {
      const created = service.create({ name: 'CISSP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const roleId = seedSource(db, { title: 'Role', sourceType: 'role' })
      const result = service.update(created.data.id, {
        education_source_id: roleId,
      })
      expect(result.ok).toBe(false)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Skill FK validated on addSkill
  // ────────────────────────────────────────────────────────────────

  describe('addSkill validation', () => {
    test('accepts valid certification + skill pair', () => {
      const created = service.create({ name: 'CISSP' })
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
      const created = service.create({ name: 'CISSP' })
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
      const created = service.create({ name: 'CISSP' })
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
      const created = service.create({ name: 'CISSP' })
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
      const created = service.create({ name: 'PMP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const skillId = seedSkill(db, { name: 'PM' })
      const result = service.removeSkill(created.data.id, skillId)
      expect(result.ok).toBe(true)
    })
  })

  describe('getSkills()', () => {
    test('returns linked skills', () => {
      const created = service.create({ name: 'CISSP' })
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
      const created = service.create({ name: 'CISSP' })
      if (!created.ok) return

      const result = service.get(created.data.id)
      expect(result.ok).toBe(true)
    })

    test('get returns NOT_FOUND for unknown id', () => {
      const result = service.get(testUuid())
      expect(result.ok).toBe(false)
    })

    test('getWithSkills returns hydrated cert', () => {
      const created = service.create({ name: 'CISSP' })
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
      service.create({ name: 'CISSP' })
      service.create({ name: 'PMP' })
      service.create({ name: 'AWS SA Pro' })

      const result = service.list()
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toHaveLength(3)
    })

    test('listWithSkills hydrates skills arrays', () => {
      const cissp = service.create({ name: 'CISSP' })
      const pmp = service.create({ name: 'PMP' })
      expect(cissp.ok && pmp.ok).toBe(true)
      if (!(cissp.ok && pmp.ok)) return

      const sec = seedSkill(db, { name: 'Security' })
      const pm = seedSkill(db, { name: 'PM' })
      service.addSkill(cissp.data.id, sec)
      service.addSkill(pmp.data.id, pm)

      const result = service.listWithSkills()
      expect(result.ok).toBe(true)
      if (result.ok) {
        const byName = Object.fromEntries(result.data.map((c) => [c.name, c]))
        expect(byName['CISSP'].skills[0].name).toBe('Security')
        expect(byName['PMP'].skills[0].name).toBe('PM')
      }
    })
  })

  describe('update()', () => {
    test('updates issuer', () => {
      const created = service.create({ name: 'CISSP' })
      if (!created.ok) return

      const result = service.update(created.data.id, { issuer: 'ISC2' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.issuer).toBe('ISC2')
    })

    test('returns NOT_FOUND for unknown id', () => {
      const result = service.update(testUuid(), { name: 'Nope' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })

    test('trims name on update', () => {
      const created = service.create({ name: 'Old' })
      if (!created.ok) return

      const result = service.update(created.data.id, { name: '  New  ' })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.name).toBe('New')
    })
  })

  describe('delete()', () => {
    test('deletes existing', () => {
      const created = service.create({ name: 'Temp' })
      if (!created.ok) return

      expect(service.delete(created.data.id).ok).toBe(true)
      expect(service.get(created.data.id).ok).toBe(false)
    })

    test('returns NOT_FOUND for unknown id', () => {
      const result = service.delete(testUuid())
      expect(result.ok).toBe(false)
    })

    test('cascade removes skill links on delete', () => {
      const created = service.create({ name: 'Temp' })
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
