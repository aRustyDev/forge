import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { SourceService } from '../source-service'
import { createTestDb, seedSource, seedBullet } from '../../db/__tests__/helpers'

describe('SourceService', () => {
  let db: Database
  let service: SourceService

  beforeEach(() => {
    db = createTestDb()
    service = new SourceService(db)
  })

  afterEach(() => db.close())

  // ── createSource ──────────────────────────────────────────────────

  test('createSource with valid input succeeds', () => {
    const result = service.createSource({
      title: 'Senior Engineer at Acme',
      description: 'Led cloud migration project.',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe('Senior Engineer at Acme')
    expect(result.data.status).toBe('draft')
    expect(result.data.source_type).toBe('general')
    expect(result.data.extension).toBeNull()
  })

  test('createSource with source_type=role creates extension', () => {
    const result = service.createSource({
      title: 'Senior Engineer',
      description: 'Led cloud migration.',
      source_type: 'role',
      is_current: 1,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.source_type).toBe('role')
    expect(result.data.extension).not.toBeNull()
  })

  test('createSource rejects empty title', () => {
    const result = service.createSource({
      title: '',
      description: 'Some description.',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Title')
  })

  test('createSource rejects empty description', () => {
    const result = service.createSource({
      title: 'Valid Title',
      description: '',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Description')
  })

  // ── getSource ─────────────────────────────────────────────────────

  test('getSource returns existing source', () => {
    const created = service.createSource({
      title: 'Test',
      description: 'Desc',
    })
    if (!created.ok) return
    const result = service.getSource(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(created.data.id)
  })

  test('getSource returns NOT_FOUND for missing ID', () => {
    const result = service.getSource('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── listSources ───────────────────────────────────────────────────

  test('listSources returns all sources', () => {
    service.createSource({ title: 'A', description: 'Desc A' })
    service.createSource({ title: 'B', description: 'Desc B' })

    const result = service.listSources()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })

  test('listSources filters by source_type', () => {
    service.createSource({ title: 'A', description: 'Desc', source_type: 'role' })
    service.createSource({ title: 'B', description: 'Desc', source_type: 'education' })

    const result = service.listSources({ source_type: 'role' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
    expect(result.data[0].source_type).toBe('role')
  })

  test('listSources filters by status', () => {
    service.createSource({ title: 'A', description: 'Desc' })
    // By default, status = 'draft'
    const result = service.listSources({ status: 'approved' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(0)
  })

  test('listSources supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      service.createSource({ title: `Source ${i}`, description: 'Desc' })
    }

    const result = service.listSources({}, 0, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(5)
    expect(result.pagination.limit).toBe(2)
  })

  // ── updateSource ──────────────────────────────────────────────────

  test('updateSource with valid input succeeds', () => {
    const created = service.createSource({ title: 'Old', description: 'Old Desc' })
    if (!created.ok) return

    const result = service.updateSource(created.data.id, { title: 'New Title' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe('New Title')
  })

  test('updateSource rejects empty title', () => {
    const created = service.createSource({ title: 'Valid', description: 'Desc' })
    if (!created.ok) return

    const result = service.updateSource(created.data.id, { title: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('updateSource returns NOT_FOUND for missing ID', () => {
    const result = service.updateSource('nonexistent', { title: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── deleteSource ──────────────────────────────────────────────────

  test('deleteSource removes source', () => {
    const created = service.createSource({ title: 'Del', description: 'Desc' })
    if (!created.ok) return

    const result = service.deleteSource(created.data.id)
    expect(result.ok).toBe(true)

    const check = service.getSource(created.data.id)
    expect(check.ok).toBe(false)
  })

  test('deleteSource returns NOT_FOUND for missing ID', () => {
    const result = service.deleteSource('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('deleteSource succeeds even when source has bullet associations (CASCADE removes junction rows)', () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }])

    const result = service.deleteSource(srcId)
    // With the new schema, bullet_sources uses ON DELETE CASCADE for source_id,
    // so deleting a source removes the junction rows but leaves bullets intact.
    expect(result.ok).toBe(true)
  })
})
