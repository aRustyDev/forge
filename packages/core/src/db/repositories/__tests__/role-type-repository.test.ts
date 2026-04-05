import { describe, expect, test, beforeEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { createTestDb } from '../../__tests__/helpers'
import * as RoleTypeRepo from '../role-type-repository'

describe('role-type-repository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  test('create and get', () => {
    const created = RoleTypeRepo.create(db, { name: 'Tech Lead', description: 'Senior IC with leadership scope' })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('Tech Lead')
    expect(created.description).toBe('Senior IC with leadership scope')
  })

  test('getByName case-insensitive', () => {
    RoleTypeRepo.create(db, { name: 'Individual Contributor' })
    const found = RoleTypeRepo.getByName(db, 'individual contributor')
    expect(found?.name).toBe('Individual Contributor')
  })

  test('list ordered by name', () => {
    RoleTypeRepo.create(db, { name: 'Architect' })
    RoleTypeRepo.create(db, { name: 'Manager' })
    RoleTypeRepo.create(db, { name: 'Individual Contributor' })

    const result = RoleTypeRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data.map((r) => r.name)).toEqual(['Architect', 'Individual Contributor', 'Manager'])
  })

  test('update', () => {
    const created = RoleTypeRepo.create(db, { name: 'IC' })
    const updated = RoleTypeRepo.update(db, created.id, { name: 'Individual Contributor' })
    expect(updated?.name).toBe('Individual Contributor')
  })

  test('delete', () => {
    const created = RoleTypeRepo.create(db, { name: 'Principal' })
    expect(RoleTypeRepo.del(db, created.id)).toBe(true)
    expect(RoleTypeRepo.get(db, created.id)).toBe(null)
  })

  test('UNIQUE constraint on name', () => {
    RoleTypeRepo.create(db, { name: 'Staff' })
    expect(() => RoleTypeRepo.create(db, { name: 'Staff' })).toThrow()
  })
})
