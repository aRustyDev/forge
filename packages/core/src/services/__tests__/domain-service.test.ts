/**
 * Tests for DomainService — CRUD with validation and delete-protection.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { DomainService } from '../domain-service'
import { createTestDb, seedDomain, seedArchetype, seedArchetypeDomain, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'

describe('DomainService', () => {
  let db: Database
  let service: DomainService

  beforeEach(() => {
    db = createTestDb()
    service = new DomainService(db)
  })
  afterEach(() => db.close())

  // -- create ---------------------------------------------------------------

  test('create with valid name succeeds', () => {
    const result = service.create({ name: 'cloud_ops' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('cloud_ops')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with description succeeds', () => {
    const result = service.create({ name: 'data_eng', description: 'Data engineering' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.description).toBe('Data engineering')
  })

  test('create with empty name returns VALIDATION_ERROR', () => {
    const result = service.create({ name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('empty')
  })

  test('create with whitespace-only name returns VALIDATION_ERROR', () => {
    const result = service.create({ name: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid name format (uppercase) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'CloudOps' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('lowercase')
  })

  test('create with invalid name format (spaces) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'cloud ops' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid name format (hyphens) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'cloud-ops' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with duplicate name returns CONFLICT', () => {
    service.create({ name: 'dup_domain' })
    const result = service.create({ name: 'dup_domain' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('already exists')
  })

  // -- get ------------------------------------------------------------------

  test('get existing domain returns ok', () => {
    const created = service.create({ name: 'get_test' })
    if (!created.ok) return
    const result = service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('get_test')
  })

  test('get nonexistent domain returns NOT_FOUND', () => {
    const result = service.get('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- list -----------------------------------------------------------------

  test('list returns paginated result', () => {
    const result = service.list(0, 10)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.pagination).toBeDefined()
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.limit).toBe(10)
  })

  // -- update ---------------------------------------------------------------

  test('update name succeeds', () => {
    const created = service.create({ name: 'old_update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'new_update' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('new_update')
  })

  test('update with empty name returns VALIDATION_ERROR', () => {
    const created = service.create({ name: 'empty_update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update with invalid name format returns VALIDATION_ERROR', () => {
    const created = service.create({ name: 'fmt_update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'Bad-Name' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update nonexistent domain returns NOT_FOUND', () => {
    const result = service.update('nonexistent', { name: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('update to duplicate name returns CONFLICT', () => {
    service.create({ name: 'update_dup_a' })
    const created = service.create({ name: 'update_dup_b' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'update_dup_a' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // -- delete ---------------------------------------------------------------

  test('delete unreferenced domain succeeds', () => {
    const created = service.create({ name: 'delete_ok' })
    if (!created.ok) return
    const result = service.delete(created.data.id)
    expect(result.ok).toBe(true)
  })

  test('delete nonexistent domain returns NOT_FOUND', () => {
    const result = service.delete('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('delete domain referenced by perspectives returns CONFLICT', () => {
    const domainId = seedDomain(db, { name: 'persp_ref' })
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId, { domain: 'persp_ref' })

    const result = service.delete(domainId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('perspective')
  })

  test('delete domain referenced by archetype_domains returns CONFLICT', () => {
    const domainId = seedDomain(db, { name: 'arch_ref' })
    const archId = seedArchetype(db, { name: 'blocker-arch' })
    seedArchetypeDomain(db, archId, domainId)

    const result = service.delete(domainId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('archetype')
  })
})
