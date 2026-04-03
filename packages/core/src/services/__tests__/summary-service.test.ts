import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSummary, seedResume } from '../../db/__tests__/helpers'
import { SummaryService } from '../summary-service'

describe('SummaryService', () => {
  let db: Database
  let service: SummaryService

  beforeEach(() => {
    db = createTestDb()
    service = new SummaryService(db)
  })

  afterEach(() => {
    db.close()
  })

  // ── create ────────────────────────────────────────────────────────

  test('create validates title is not empty', () => {
    const result = service.create({ title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create validates title is not whitespace-only', () => {
    const result = service.create({ title: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create validates is_template must be 0 or 1', () => {
    const result = service.create({ title: 'Test', is_template: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create succeeds with valid input', () => {
    const result = service.create({ title: 'Valid Summary' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Valid Summary')
    }
  })

  // ── get ───────────────────────────────────────────────────────────

  test('get returns NOT_FOUND for missing id', () => {
    const result = service.get('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('get returns summary', () => {
    const id = seedSummary(db)
    const result = service.get(id)
    expect(result.ok).toBe(true)
  })

  // ── list ──────────────────────────────────────────────────────────

  test('list returns paginated result', () => {
    seedSummary(db)
    const result = service.list()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    }
  })

  // ── update ────────────────────────────────────────────────────────

  test('update validates empty title', () => {
    const id = seedSummary(db)
    const result = service.update(id, { title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update returns NOT_FOUND for missing id', () => {
    const result = service.update('00000000-0000-0000-0000-000000000000', { title: 'New' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  // ── delete ────────────────────────────────────────────────────────

  test('delete returns NOT_FOUND for missing id', () => {
    const result = service.delete('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('delete succeeds for existing summary', () => {
    const id = seedSummary(db)
    const result = service.delete(id)
    expect(result.ok).toBe(true)
  })

  // ── clone ─────────────────────────────────────────────────────────

  test('clone returns SUMMARY_NOT_FOUND for missing source', () => {
    const result = service.clone('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('SUMMARY_NOT_FOUND')
    }
  })

  test('clone succeeds and returns new summary', () => {
    const id = seedSummary(db, { title: 'Cloneable' })
    const result = service.clone(id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Copy of Cloneable')
      expect(result.data.id).not.toBe(id)
    }
  })

  // ── toggleTemplate ─────────────────────────────────────────────────

  test('toggleTemplate returns updated summary', () => {
    const id = seedSummary(db, { isTemplate: 0 })
    const result = service.toggleTemplate(id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.is_template).toBe(1)
    }
  })

  test('toggleTemplate returns NOT_FOUND for nonexistent id', () => {
    const result = service.toggleTemplate('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  // ── getLinkedResumes ───────────────────────────────────────────────

  test('getLinkedResumes returns NOT_FOUND for nonexistent summary', () => {
    const result = service.getLinkedResumes('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('getLinkedResumes returns paginated results', () => {
    const sId = seedSummary(db)
    const rId = seedResume(db, { name: 'Linked Resume' })
    db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])

    const result = service.getLinkedResumes(sId)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Linked Resume')
      expect(result.pagination.total).toBe(1)
    }
  })
})
