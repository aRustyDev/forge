/**
 * Tests for DomainRepository — CRUD operations for the domains table.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedDomain, seedArchetype, seedArchetypeDomain, seedBullet, seedSource, seedPerspective } from '../../__tests__/helpers'
import * as DomainRepo from '../domain-repository'

let db: Database

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('DomainRepository', () => {
  test('create returns a domain with generated id', () => {
    const domain = DomainRepo.create(db, { name: 'test_domain' })

    expect(domain.id).toHaveLength(36)
    expect(domain.name).toBe('test_domain')
    expect(domain.description).toBeNull()
    expect(domain.created_at).toBeTruthy()
  })

  test('create with description', () => {
    const domain = DomainRepo.create(db, {
      name: 'cloud_engineering',
      description: 'Cloud infrastructure and platform engineering',
    })

    expect(domain.name).toBe('cloud_engineering')
    expect(domain.description).toBe('Cloud infrastructure and platform engineering')
  })

  test('get returns domain by id', () => {
    const created = DomainRepo.create(db, { name: 'my_domain' })
    const fetched = DomainRepo.get(db, created.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe('my_domain')
  })

  test('get returns null for nonexistent id', () => {
    const result = DomainRepo.get(db, 'nonexistent-id')
    expect(result).toBeNull()
  })

  test('getByName returns domain by name', () => {
    DomainRepo.create(db, { name: 'unique_domain' })
    const fetched = DomainRepo.getByName(db, 'unique_domain')

    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('unique_domain')
  })

  test('getByName returns null for nonexistent name', () => {
    const result = DomainRepo.getByName(db, 'nonexistent')
    expect(result).toBeNull()
  })

  test('list returns domains with usage counts', () => {
    // Seed data — the migration already seeds domains, so list should include them
    const result = DomainRepo.list(db, 0, 50)

    expect(result.total).toBeGreaterThan(0)
    expect(result.data.length).toBeGreaterThan(0)

    // Each entry should have usage counts
    for (const domain of result.data) {
      expect(typeof domain.perspective_count).toBe('number')
      expect(typeof domain.archetype_count).toBe('number')
    }
  })

  test('list respects offset and limit', () => {
    const all = DomainRepo.list(db, 0, 100)
    const first = DomainRepo.list(db, 0, 2)
    const second = DomainRepo.list(db, 2, 2)

    expect(first.data.length).toBeLessThanOrEqual(2)
    expect(first.total).toBe(all.total)

    if (all.total > 2) {
      expect(second.data.length).toBeGreaterThan(0)
    }
  })

  test('update changes domain name', () => {
    const domain = DomainRepo.create(db, { name: 'old_name' })
    const updated = DomainRepo.update(db, domain.id, { name: 'new_name' })

    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('new_name')
  })

  test('update changes domain description', () => {
    const domain = DomainRepo.create(db, { name: 'test_desc', description: 'old' })
    const updated = DomainRepo.update(db, domain.id, { description: 'new desc' })

    expect(updated).not.toBeNull()
    expect(updated!.description).toBe('new desc')
  })

  test('update returns null for nonexistent id', () => {
    const result = DomainRepo.update(db, 'nonexistent', { name: 'whatever' })
    expect(result).toBeNull()
  })

  test('update with no changes returns existing', () => {
    const domain = DomainRepo.create(db, { name: 'no_change' })
    const result = DomainRepo.update(db, domain.id, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('no_change')
  })

  test('countReferences counts perspectives by domain name', () => {
    const domainId = seedDomain(db, { name: 'ref_domain' })
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId, { domain: 'ref_domain' })
    seedPerspective(db, bulletId, { domain: 'ref_domain' })

    const refs = DomainRepo.countReferences(db, domainId)
    expect(refs.perspective_count).toBe(2)
  })

  test('countReferences counts archetype_domains by id', () => {
    const domainId = seedDomain(db, { name: 'arch_ref_domain' })
    const archId = seedArchetype(db, { name: 'test-arch' })
    seedArchetypeDomain(db, archId, domainId)

    const refs = DomainRepo.countReferences(db, domainId)
    expect(refs.archetype_count).toBe(1)
  })

  test('countReferences returns zeros for unreferenced domain', () => {
    const domain = DomainRepo.create(db, { name: 'lonely_domain' })
    const refs = DomainRepo.countReferences(db, domain.id)
    expect(refs.perspective_count).toBe(0)
    expect(refs.archetype_count).toBe(0)
  })

  test('countReferences returns zeros for nonexistent id', () => {
    const refs = DomainRepo.countReferences(db, 'nonexistent')
    expect(refs.perspective_count).toBe(0)
    expect(refs.archetype_count).toBe(0)
  })

  test('del removes domain and returns true', () => {
    const domain = DomainRepo.create(db, { name: 'to_delete' })
    const result = DomainRepo.del(db, domain.id)
    expect(result).toBe(true)

    const fetched = DomainRepo.get(db, domain.id)
    expect(fetched).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    const result = DomainRepo.del(db, 'nonexistent')
    expect(result).toBe(false)
  })

  test('create with duplicate name throws', () => {
    DomainRepo.create(db, { name: 'dup_domain' })
    expect(() => DomainRepo.create(db, { name: 'dup_domain' })).toThrow()
  })
})
