import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSummary, seedResume } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { SummaryService } from '../summary-service'

describe('SummaryService', () => {
  let db: Database
  let service: SummaryService

  beforeEach(() => {
    db = createTestDb()
    service = new SummaryService(buildDefaultElm(db))
  })

  afterEach(() => {
    db.close()
  })

  // ── create ────────────────────────────────────────────────────────

  test('create validates title is not empty', async () => {
    const result = await service.create({ title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create validates title is not whitespace-only', async () => {
    const result = await service.create({ title: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create validates is_template must be 0 or 1', async () => {
    const result = await service.create({ title: 'Test', is_template: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('create succeeds with valid input', async () => {
    const result = await service.create({ title: 'Valid Summary' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Valid Summary')
    }
  })

  // ── get ───────────────────────────────────────────────────────────

  test('get returns NOT_FOUND for missing id', async () => {
    const result = await service.get('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('get returns summary', async () => {
    const id = seedSummary(db)
    const result = await service.get(id)
    expect(result.ok).toBe(true)
  })

  // ── list ──────────────────────────────────────────────────────────

  test('list returns paginated result', async () => {
    seedSummary(db)
    const result = await service.list()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    }
  })

  // ── update ────────────────────────────────────────────────────────

  test('update validates empty title', async () => {
    const id = seedSummary(db)
    const result = await service.update(id, { title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update returns NOT_FOUND for missing id', async () => {
    const result = await service.update('00000000-0000-0000-0000-000000000000', { title: 'New' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  // ── delete ────────────────────────────────────────────────────────

  test('delete returns NOT_FOUND for missing id', async () => {
    const result = await service.delete('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('delete succeeds for existing summary', async () => {
    const id = seedSummary(db)
    const result = await service.delete(id)
    expect(result.ok).toBe(true)
  })

  // ── clone ─────────────────────────────────────────────────────────

  test('clone returns SUMMARY_NOT_FOUND for missing source', async () => {
    const result = await service.clone('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('SUMMARY_NOT_FOUND')
    }
  })

  test('clone succeeds and returns new summary', async () => {
    const id = seedSummary(db, { title: 'Cloneable' })
    const result = await service.clone(id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Copy of Cloneable')
      expect(result.data.id).not.toBe(id)
    }
  })

  // ── toggleTemplate ─────────────────────────────────────────────────

  test('toggleTemplate returns updated summary', async () => {
    const id = seedSummary(db, { isTemplate: 0 })
    const result = await service.toggleTemplate(id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.is_template).toBe(1)
    }
  })

  test('toggleTemplate returns NOT_FOUND for nonexistent id', async () => {
    const result = await service.toggleTemplate('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  // ── getLinkedResumes ───────────────────────────────────────────────

  test('getLinkedResumes returns NOT_FOUND for nonexistent summary', async () => {
    const result = await service.getLinkedResumes('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('getLinkedResumes returns paginated results', async () => {
    const sId = seedSummary(db)
    const rId = seedResume(db, { name: 'Linked Resume' })
    db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])

    const result = await service.getLinkedResumes(sId)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Linked Resume')
      expect(result.pagination.total).toBe(1)
    }
  })
})
