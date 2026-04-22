/**
 * Tests for DomainService — CRUD with validation and delete-protection.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { DomainService } from '../domain-service'
import { createTestDb, seedDomain, seedArchetype, seedArchetypeDomain, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('DomainService', () => {
  let db: Database
  let service: DomainService

  beforeEach(() => {
    db = createTestDb()
    service = new DomainService(buildDefaultElm(db))
  })
  afterEach(() => db.close())

  // -- create ---------------------------------------------------------------

  test('create with valid name succeeds', async () => {
    const result = await service.create({ name: 'cloud_ops' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('cloud_ops')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with description succeeds', async () => {
    const result = await service.create({ name: 'data_eng', description: 'Data engineering' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.description).toBe('Data engineering')
  })

  test('create with empty name returns VALIDATION_ERROR', async () => {
    const result = await service.create({ name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('empty')
  })

  test('create with whitespace-only name returns VALIDATION_ERROR', async () => {
    const result = await service.create({ name: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid name format (uppercase) returns VALIDATION_ERROR', async () => {
    const result = await service.create({ name: 'CloudOps' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('lowercase')
  })

  test('create with invalid name format (spaces) returns VALIDATION_ERROR', async () => {
    const result = await service.create({ name: 'cloud ops' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid name format (hyphens) returns VALIDATION_ERROR', async () => {
    const result = await service.create({ name: 'cloud-ops' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with duplicate name returns CONFLICT', async () => {
    await service.create({ name: 'dup_domain' })
    const result = await service.create({ name: 'dup_domain' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('already exists')
  })

  // -- get ------------------------------------------------------------------

  test('get existing domain returns ok', async () => {
    const created = await service.create({ name: 'get_test' })
    if (!created.ok) return
    const result = await service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('get_test')
  })

  test('get nonexistent domain returns NOT_FOUND', async () => {
    const result = await service.get('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- list -----------------------------------------------------------------

  test('list returns paginated result', async () => {
    const result = await service.list(0, 10)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.pagination).toBeDefined()
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.limit).toBe(10)
  })

  // -- update ---------------------------------------------------------------

  test('update name succeeds', async () => {
    const created = await service.create({ name: 'old_update' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: 'new_update' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('new_update')
  })

  test('update with empty name returns VALIDATION_ERROR', async () => {
    const created = await service.create({ name: 'empty_update' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update with invalid name format returns VALIDATION_ERROR', async () => {
    const created = await service.create({ name: 'fmt_update' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: 'Bad-Name' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update nonexistent domain returns NOT_FOUND', async () => {
    const result = await service.update('nonexistent', { name: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('update to duplicate name returns CONFLICT', async () => {
    await service.create({ name: 'update_dup_a' })
    const created = await service.create({ name: 'update_dup_b' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: 'update_dup_a' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // -- delete ---------------------------------------------------------------

  test('delete unreferenced domain succeeds', async () => {
    const created = await service.create({ name: 'delete_ok' })
    if (!created.ok) return
    const result = await service.delete(created.data.id)
    expect(result.ok).toBe(true)
  })

  test('delete nonexistent domain returns NOT_FOUND', async () => {
    const result = await service.delete('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('delete domain referenced by perspectives returns CONFLICT', async () => {
    const domainId = seedDomain(db, { name: 'persp_ref' })
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId, { domain: 'persp_ref' })

    const result = await service.delete(domainId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('perspective')
  })

  test('delete domain referenced by archetype_domains returns CONFLICT', async () => {
    const domainId = seedDomain(db, { name: 'arch_ref' })
    const archId = seedArchetype(db, { name: 'blocker-arch' })
    seedArchetypeDomain(db, archId, domainId)

    const result = await service.delete(domainId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('archetype')
  })
})
