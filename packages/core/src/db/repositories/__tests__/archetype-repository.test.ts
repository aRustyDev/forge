/**
 * Tests for ArchetypeRepository — CRUD operations for the archetypes table
 * and archetype_domains junction management.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import {
  createTestDb,
  seedArchetype,
  seedDomain,
  seedArchetypeDomain,
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
} from '../../__tests__/helpers'
import * as ArchetypeRepo from '../archetype-repository'

let db: Database

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

describe('ArchetypeRepository', () => {
  test('create returns an archetype with generated id', () => {
    const arch = ArchetypeRepo.create(db, { name: 'test-archetype' })

    expect(arch.id).toHaveLength(36)
    expect(arch.name).toBe('test-archetype')
    expect(arch.description).toBeNull()
    expect(arch.created_at).toBeTruthy()
  })

  test('create with description', () => {
    const arch = ArchetypeRepo.create(db, {
      name: 'custom-arch',
      description: 'A custom archetype for testing',
    })

    expect(arch.name).toBe('custom-arch')
    expect(arch.description).toBe('A custom archetype for testing')
  })

  test('get returns archetype by id', () => {
    const created = ArchetypeRepo.create(db, { name: 'get-test' })
    const fetched = ArchetypeRepo.get(db, created.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe('get-test')
  })

  test('get returns null for nonexistent id', () => {
    expect(ArchetypeRepo.get(db, 'nonexistent')).toBeNull()
  })

  test('getByName returns archetype by name', () => {
    ArchetypeRepo.create(db, { name: 'by-name-test' })
    const fetched = ArchetypeRepo.getByName(db, 'by-name-test')

    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('by-name-test')
  })

  test('getByName returns null for nonexistent name', () => {
    expect(ArchetypeRepo.getByName(db, 'nonexistent')).toBeNull()
  })

  test('getWithDomains returns archetype with its associated domains', () => {
    const archId = seedArchetype(db, { name: 'with-domains' })
    const dom1 = seedDomain(db, { name: 'domain_one' })
    const dom2 = seedDomain(db, { name: 'domain_two' })
    seedArchetypeDomain(db, archId, dom1)
    seedArchetypeDomain(db, archId, dom2)

    const result = ArchetypeRepo.getWithDomains(db, archId)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('with-domains')
    expect(result!.domains).toHaveLength(2)
    const domainNames = result!.domains.map((d) => d.name).sort()
    expect(domainNames).toEqual(['domain_one', 'domain_two'])
  })

  test('getWithDomains returns null for nonexistent id', () => {
    expect(ArchetypeRepo.getWithDomains(db, 'nonexistent')).toBeNull()
  })

  test('getWithDomains returns empty domains array when none associated', () => {
    const archId = seedArchetype(db, { name: 'no-domains' })
    const result = ArchetypeRepo.getWithDomains(db, archId)

    expect(result).not.toBeNull()
    expect(result!.domains).toHaveLength(0)
  })

  test('list returns archetypes with usage counts', () => {
    // Migration seeds archetypes, so list should include them
    const result = ArchetypeRepo.list(db, 0, 50)

    expect(result.total).toBeGreaterThan(0)
    expect(result.data.length).toBeGreaterThan(0)

    for (const arch of result.data) {
      expect(typeof arch.resume_count).toBe('number')
      expect(typeof arch.perspective_count).toBe('number')
      expect(typeof arch.domain_count).toBe('number')
    }
  })

  test('list respects offset and limit', () => {
    const all = ArchetypeRepo.list(db, 0, 100)
    const first = ArchetypeRepo.list(db, 0, 2)

    expect(first.data.length).toBeLessThanOrEqual(2)
    expect(first.total).toBe(all.total)
  })

  test('update changes archetype name', () => {
    const arch = ArchetypeRepo.create(db, { name: 'old-name' })
    const updated = ArchetypeRepo.update(db, arch.id, { name: 'new-name' })

    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('new-name')
  })

  test('update changes archetype description', () => {
    const arch = ArchetypeRepo.create(db, { name: 'desc-test', description: 'old' })
    const updated = ArchetypeRepo.update(db, arch.id, { description: 'new desc' })

    expect(updated).not.toBeNull()
    expect(updated!.description).toBe('new desc')
  })

  test('update returns null for nonexistent id', () => {
    expect(ArchetypeRepo.update(db, 'nonexistent', { name: 'x' })).toBeNull()
  })

  test('update with no changes returns existing', () => {
    const arch = ArchetypeRepo.create(db, { name: 'no-change' })
    const result = ArchetypeRepo.update(db, arch.id, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('no-change')
  })

  test('countReferences counts resumes by archetype name', () => {
    const archId = seedArchetype(db, { name: 'ref-test-arch' })
    seedResume(db, { archetype: 'ref-test-arch' })

    const refs = ArchetypeRepo.countReferences(db, archId)
    expect(refs.resume_count).toBe(1)
  })

  test('countReferences counts perspectives by archetype name', () => {
    const archId = seedArchetype(db, { name: 'persp-ref-arch' })
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId, { archetype: 'persp-ref-arch' })
    seedPerspective(db, bulletId, { archetype: 'persp-ref-arch' })

    const refs = ArchetypeRepo.countReferences(db, archId)
    expect(refs.perspective_count).toBe(2)
  })

  test('countReferences returns zeros for unreferenced archetype', () => {
    const arch = ArchetypeRepo.create(db, { name: 'lonely-arch' })
    const refs = ArchetypeRepo.countReferences(db, arch.id)
    expect(refs.resume_count).toBe(0)
    expect(refs.perspective_count).toBe(0)
  })

  test('del removes archetype and returns true', () => {
    const arch = ArchetypeRepo.create(db, { name: 'to-delete' })
    expect(ArchetypeRepo.del(db, arch.id)).toBe(true)
    expect(ArchetypeRepo.get(db, arch.id)).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    expect(ArchetypeRepo.del(db, 'nonexistent')).toBe(false)
  })

  test('create with duplicate name throws', () => {
    ArchetypeRepo.create(db, { name: 'dup-arch' })
    expect(() => ArchetypeRepo.create(db, { name: 'dup-arch' })).toThrow()
  })
})

describe('ArchetypeRepository — Domain associations', () => {
  test('addDomain creates junction row', () => {
    const archId = seedArchetype(db, { name: 'assoc-arch' })
    const domId = seedDomain(db, { name: 'assoc_domain' })

    ArchetypeRepo.addDomain(db, archId, domId)

    const domains = ArchetypeRepo.listDomains(db, archId)
    expect(domains).toHaveLength(1)
    expect(domains[0].name).toBe('assoc_domain')
  })

  test('addDomain duplicate throws', () => {
    const archId = seedArchetype(db, { name: 'dup-assoc-arch' })
    const domId = seedDomain(db, { name: 'dup_assoc_domain' })

    ArchetypeRepo.addDomain(db, archId, domId)
    expect(() => ArchetypeRepo.addDomain(db, archId, domId)).toThrow()
  })

  test('removeDomain removes junction row and returns true', () => {
    const archId = seedArchetype(db, { name: 'rm-assoc-arch' })
    const domId = seedDomain(db, { name: 'rm_assoc_domain' })

    ArchetypeRepo.addDomain(db, archId, domId)
    expect(ArchetypeRepo.removeDomain(db, archId, domId)).toBe(true)

    const domains = ArchetypeRepo.listDomains(db, archId)
    expect(domains).toHaveLength(0)
  })

  test('removeDomain returns false when association does not exist', () => {
    const archId = seedArchetype(db, { name: 'no-rm-arch' })
    const domId = seedDomain(db, { name: 'no_rm_domain' })

    expect(ArchetypeRepo.removeDomain(db, archId, domId)).toBe(false)
  })

  test('listDomains returns correct domains sorted by name', () => {
    const archId = seedArchetype(db, { name: 'list-dom-arch' })
    const dom1 = seedDomain(db, { name: 'z_domain' })
    const dom2 = seedDomain(db, { name: 'a_domain' })
    seedArchetypeDomain(db, archId, dom1)
    seedArchetypeDomain(db, archId, dom2)

    const domains = ArchetypeRepo.listDomains(db, archId)
    expect(domains).toHaveLength(2)
    expect(domains[0].name).toBe('a_domain')
    expect(domains[1].name).toBe('z_domain')
  })

  test('getExpectedDomainNames returns domain names for seeded archetypes', () => {
    // The migration seeds 'agentic-ai' archetype with ai_ml, software_engineering, leadership
    const names = ArchetypeRepo.getExpectedDomainNames(db, 'agentic-ai')
    expect(names).toContain('ai_ml')
    expect(names).toContain('software_engineering')
    expect(names).toContain('leadership')
  })

  test('getExpectedDomainNames returns empty array for unknown archetype', () => {
    const names = ArchetypeRepo.getExpectedDomainNames(db, 'nonexistent')
    expect(names).toEqual([])
  })

  test('deleting archetype cascades archetype_domains', () => {
    const archId = seedArchetype(db, { name: 'cascade-arch' })
    const domId = seedDomain(db, { name: 'cascade_domain' })
    seedArchetypeDomain(db, archId, domId)

    // Verify junction row exists
    let domains = ArchetypeRepo.listDomains(db, archId)
    expect(domains).toHaveLength(1)

    // Delete archetype
    ArchetypeRepo.del(db, archId)

    // Junction row should be gone (cascade)
    const count = db.query('SELECT COUNT(*) AS c FROM archetype_domains WHERE archetype_id = ?').get(archId) as { c: number }
    expect(count.c).toBe(0)
  })
})
