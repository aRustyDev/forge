import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { createTestDb, seedResumeTemplate } from '../../__tests__/helpers'
import * as TemplateRepo from '../template-repository'
import type { Database } from 'bun:sqlite'

describe('TemplateRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => db.close())

  describe('list', () => {
    test('returns seeded built-in templates', () => {
      const templates = TemplateRepo.list(db)
      // Migration 008 seeds 3 built-in templates
      expect(templates.length).toBeGreaterThanOrEqual(3)
      expect(templates[0].is_builtin).toBe(1)
    })

    test('returns built-in templates first', () => {
      seedResumeTemplate(db, { name: 'AAA User Template' })
      const templates = TemplateRepo.list(db)
      // Built-in templates come first regardless of name
      const firstUserIdx = templates.findIndex(t => t.is_builtin === 0)
      const lastBuiltinIdx = templates.findLastIndex(t => t.is_builtin === 1)
      if (firstUserIdx !== -1 && lastBuiltinIdx !== -1) {
        expect(lastBuiltinIdx).toBeLessThan(firstUserIdx)
      }
    })
  })

  describe('get', () => {
    test('returns template by id', () => {
      const id = seedResumeTemplate(db, { name: 'My Template' })
      const template = TemplateRepo.get(db, id)
      expect(template).not.toBeNull()
      expect(template!.name).toBe('My Template')
      expect(template!.sections).toBeInstanceOf(Array)
    })

    test('returns null for nonexistent id', () => {
      expect(TemplateRepo.get(db, 'nonexistent')).toBeNull()
    })

    test('deserializes sections from JSON', () => {
      const sections = [
        { title: 'Experience', entry_type: 'experience', position: 0 },
        { title: 'Skills', entry_type: 'skills', position: 1 },
      ]
      const id = seedResumeTemplate(db, { sections })
      const template = TemplateRepo.get(db, id)
      expect(template!.sections).toEqual(sections)
    })
  })

  describe('create', () => {
    test('creates a user template with is_builtin = 0', () => {
      const template = TemplateRepo.create(db, {
        name: 'Custom',
        sections: [{ title: 'Summary', entry_type: 'freeform', position: 0 }],
      })
      expect(template.is_builtin).toBe(0)
      expect(template.name).toBe('Custom')
      expect(template.sections).toHaveLength(1)
    })

    test('stores description', () => {
      const template = TemplateRepo.create(db, {
        name: 'With Desc',
        description: 'A custom template',
        sections: [{ title: 'Exp', entry_type: 'experience', position: 0 }],
      })
      expect(template.description).toBe('A custom template')
    })

    test('generates valid UUID', () => {
      const template = TemplateRepo.create(db, {
        name: 'UUID Test',
        sections: [{ title: 'Exp', entry_type: 'experience', position: 0 }],
      })
      expect(template.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
  })

  describe('update', () => {
    test('updates name', () => {
      const id = seedResumeTemplate(db, { name: 'Old Name' })
      const updated = TemplateRepo.update(db, id, { name: 'New Name' })
      expect(updated!.name).toBe('New Name')
    })

    test('updates sections', () => {
      const id = seedResumeTemplate(db)
      const newSections = [{ title: 'Only Summary', entry_type: 'freeform', position: 0 }]
      const updated = TemplateRepo.update(db, id, { sections: newSections })
      expect(updated!.sections).toEqual(newSections)
    })

    test('returns existing template when no fields provided', () => {
      const id = seedResumeTemplate(db, { name: 'NoOp' })
      const updated = TemplateRepo.update(db, id, {})
      expect(updated!.name).toBe('NoOp')
    })

    test('returns null for nonexistent id', () => {
      expect(TemplateRepo.update(db, 'nonexistent', { name: 'X' })).toBeNull()
    })

    test('updates description to null', () => {
      const id = seedResumeTemplate(db, { description: 'old desc' })
      const updated = TemplateRepo.update(db, id, { description: null })
      expect(updated!.description).toBeNull()
    })
  })

  describe('remove', () => {
    test('deletes template and returns true', () => {
      const id = seedResumeTemplate(db)
      expect(TemplateRepo.remove(db, id)).toBe(true)
      expect(TemplateRepo.get(db, id)).toBeNull()
    })

    test('returns false for nonexistent id', () => {
      expect(TemplateRepo.remove(db, 'nonexistent')).toBe(false)
    })
  })
})
