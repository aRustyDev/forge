import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { SourceService } from '../source-service'
import { createTestDb, seedSource, seedBullet } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('SourceService', () => {
  let db: Database
  let service: SourceService

  beforeEach(() => {
    db = createTestDb()
    service = new SourceService(buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── createSource ──────────────────────────────────────────────────

  test('createSource with valid input succeeds', async () => {
    const result = await service.createSource({
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

  test('createSource with source_type=role creates extension', async () => {
    const result = await service.createSource({
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

  test('createSource rejects empty title', async () => {
    const result = await service.createSource({
      title: '',
      description: 'Some description.',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Title')
  })

  test('createSource rejects empty description', async () => {
    const result = await service.createSource({
      title: 'Valid Title',
      description: '',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Description')
  })

  // ── getSource ─────────────────────────────────────────────────────

  test('getSource returns existing source', async () => {
    const created = await service.createSource({
      title: 'Test',
      description: 'Desc',
    })
    if (!created.ok) return
    const result = await service.getSource(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(created.data.id)
  })

  test('getSource returns NOT_FOUND for missing ID', async () => {
    const result = await service.getSource('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── listSources ───────────────────────────────────────────────────

  test('listSources returns all sources', async () => {
    await service.createSource({ title: 'A', description: 'Desc A' })
    await service.createSource({ title: 'B', description: 'Desc B' })

    const result = await service.listSources()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })

  test('listSources filters by source_type', async () => {
    await service.createSource({ title: 'A', description: 'Desc', source_type: 'role' })
    await service.createSource({ title: 'B', description: 'Desc', source_type: 'education' })

    const result = await service.listSources({ source_type: 'role' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
    expect(result.data[0].source_type).toBe('role')
  })

  test('listSources filters by status', async () => {
    await service.createSource({ title: 'A', description: 'Desc' })
    // By default, status = 'draft'
    const result = await service.listSources({ status: 'approved' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(0)
  })

  test('listSources supports pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await service.createSource({ title: `Source ${i}`, description: 'Desc' })
    }

    const result = await service.listSources({}, 0, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(5)
    expect(result.pagination.limit).toBe(2)
  })

  // ── updateSource ──────────────────────────────────────────────────

  test('updateSource with valid input succeeds', async () => {
    const created = await service.createSource({ title: 'Old', description: 'Old Desc' })
    if (!created.ok) return

    const result = await service.updateSource(created.data.id, { title: 'New Title' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe('New Title')
  })

  test('updateSource rejects empty title', async () => {
    const created = await service.createSource({ title: 'Valid', description: 'Desc' })
    if (!created.ok) return

    const result = await service.updateSource(created.data.id, { title: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('updateSource returns NOT_FOUND for missing ID', async () => {
    const result = await service.updateSource('nonexistent', { title: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── deleteSource ──────────────────────────────────────────────────

  test('deleteSource removes source', async () => {
    const created = await service.createSource({ title: 'Del', description: 'Desc' })
    if (!created.ok) return

    const result = await service.deleteSource(created.data.id)
    expect(result.ok).toBe(true)

    const check = await service.getSource(created.data.id)
    expect(check.ok).toBe(false)
  })

  test('deleteSource returns NOT_FOUND for missing ID', async () => {
    const result = await service.deleteSource('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('deleteSource succeeds even when source has bullet associations (CASCADE removes junction rows)', async () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }])

    const result = await service.deleteSource(srcId)
    // With the new schema, bullet_sources uses ON DELETE CASCADE for source_id,
    // so deleting a source removes the junction rows but leaves bullets intact.
    expect(result.ok).toBe(true)
  })
})
