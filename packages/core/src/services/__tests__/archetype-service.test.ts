/**
 * Tests for ArchetypeService — CRUD with validation, delete-protection,
 * and domain association management.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ArchetypeService } from '../archetype-service'
import {
  createTestDb,
  seedArchetype,
  seedDomain,
  seedArchetypeDomain,
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
} from '../../db/__tests__/helpers'

describe('ArchetypeService', () => {
  let db: Database
  let service: ArchetypeService

  beforeEach(() => {
    db = createTestDb()
    service = new ArchetypeService(db)
  })
  afterEach(() => db.close())

  // -- create ---------------------------------------------------------------

  test('create with valid name succeeds', () => {
    const result = service.create({ name: 'devrel' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('devrel')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with description succeeds', () => {
    const result = service.create({ name: 'cloud-native', description: 'Cloud-native engineering' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.description).toBe('Cloud-native engineering')
  })

  test('create with empty name returns VALIDATION_ERROR', () => {
    const result = service.create({ name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('empty')
  })

  test('create with invalid name format (uppercase) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'CloudNative' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('lowercase')
  })

  test('create with invalid name format (spaces) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'cloud native' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid name format (underscores) returns VALIDATION_ERROR', () => {
    const result = service.create({ name: 'cloud_native' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with hyphens succeeds', () => {
    const result = service.create({ name: 'cloud-native' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('cloud-native')
  })

  test('create with duplicate name returns CONFLICT', () => {
    service.create({ name: 'dup-arch' })
    const result = service.create({ name: 'dup-arch' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('already exists')
  })

  // -- get ------------------------------------------------------------------

  test('get existing archetype returns ok', () => {
    const created = service.create({ name: 'get-test' })
    if (!created.ok) return
    const result = service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('get-test')
  })

  test('get nonexistent archetype returns NOT_FOUND', () => {
    const result = service.get('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- getWithDomains -------------------------------------------------------

  test('getWithDomains returns archetype with domains', () => {
    const archId = seedArchetype(db, { name: 'gwd-test' })
    const domId = seedDomain(db, { name: 'gwd_domain' })
    seedArchetypeDomain(db, archId, domId)

    const result = service.getWithDomains(archId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.domains).toHaveLength(1)
    expect(result.data.domains[0].name).toBe('gwd_domain')
  })

  test('getWithDomains nonexistent returns NOT_FOUND', () => {
    const result = service.getWithDomains('nonexistent')
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
  })

  // -- update ---------------------------------------------------------------

  test('update name succeeds', () => {
    const created = service.create({ name: 'old-update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'new-update' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('new-update')
  })

  test('update with empty name returns VALIDATION_ERROR', () => {
    const created = service.create({ name: 'empty-update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update with invalid format returns VALIDATION_ERROR', () => {
    const created = service.create({ name: 'fmt-update' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'Bad Name' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update nonexistent returns NOT_FOUND', () => {
    const result = service.update('nonexistent', { name: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('update to duplicate name returns CONFLICT', () => {
    service.create({ name: 'update-dup-a' })
    const created = service.create({ name: 'update-dup-b' })
    if (!created.ok) return
    const result = service.update(created.data.id, { name: 'update-dup-a' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // -- delete ---------------------------------------------------------------

  test('delete unreferenced archetype succeeds', () => {
    const created = service.create({ name: 'delete-ok' })
    if (!created.ok) return
    const result = service.delete(created.data.id)
    expect(result.ok).toBe(true)
  })

  test('delete nonexistent returns NOT_FOUND', () => {
    const result = service.delete('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('delete archetype referenced by resume returns CONFLICT', () => {
    const archId = seedArchetype(db, { name: 'resume-ref' })
    seedResume(db, { archetype: 'resume-ref' })

    const result = service.delete(archId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('resume')
  })

  test('delete archetype referenced by perspectives returns CONFLICT', () => {
    const archId = seedArchetype(db, { name: 'persp-ref' })
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId, { archetype: 'persp-ref' })

    const result = service.delete(archId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toContain('perspective')
  })

  // -- domain associations --------------------------------------------------

  test('addDomain associates a domain with an archetype', () => {
    const archId = seedArchetype(db, { name: 'add-dom-arch' })
    const domId = seedDomain(db, { name: 'add_dom' })

    const result = service.addDomain(archId, domId)
    expect(result.ok).toBe(true)

    const domainsResult = service.listDomains(archId)
    expect(domainsResult.ok).toBe(true)
    if (!domainsResult.ok) return
    expect(domainsResult.data).toHaveLength(1)
    expect(domainsResult.data[0].name).toBe('add_dom')
  })

  test('addDomain with nonexistent archetype returns NOT_FOUND', () => {
    const domId = seedDomain(db, { name: 'orphan_dom' })
    const result = service.addDomain('nonexistent', domId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toContain('Archetype')
  })

  test('addDomain with nonexistent domain returns NOT_FOUND', () => {
    const archId = seedArchetype(db, { name: 'orphan-arch' })
    const result = service.addDomain(archId, 'nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toContain('Domain')
  })

  test('addDomain duplicate returns CONFLICT', () => {
    const archId = seedArchetype(db, { name: 'dup-dom-arch' })
    const domId = seedDomain(db, { name: 'dup_dom' })

    service.addDomain(archId, domId)
    const result = service.addDomain(archId, domId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  test('removeDomain removes association', () => {
    const archId = seedArchetype(db, { name: 'rm-dom-arch' })
    const domId = seedDomain(db, { name: 'rm_dom' })
    service.addDomain(archId, domId)

    const result = service.removeDomain(archId, domId)
    expect(result.ok).toBe(true)

    const domainsResult = service.listDomains(archId)
    if (!domainsResult.ok) return
    expect(domainsResult.data).toHaveLength(0)
  })

  test('removeDomain nonexistent returns NOT_FOUND', () => {
    const archId = seedArchetype(db, { name: 'no-rm-arch' })
    const domId = seedDomain(db, { name: 'no_rm_dom' })

    const result = service.removeDomain(archId, domId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('listDomains for nonexistent archetype returns NOT_FOUND', () => {
    const result = service.listDomains('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})
