import { describe, expect, test, beforeEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { createTestDb } from '../../__tests__/helpers'
import * as IndustryRepo from '../industry-repository'

describe('industry-repository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  test('create and get', () => {
    const created = IndustryRepo.create(db, { name: 'FinTech', description: 'Financial technology' })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('FinTech')
    expect(created.description).toBe('Financial technology')

    const fetched = IndustryRepo.get(db, created.id)
    expect(fetched).toEqual(created)
  })

  test('getByName case-insensitive', () => {
    IndustryRepo.create(db, { name: 'Defense' })
    const found = IndustryRepo.getByName(db, 'defense')
    expect(found?.name).toBe('Defense')

    const upper = IndustryRepo.getByName(db, 'DEFENSE')
    expect(upper?.name).toBe('Defense')
  })

  test('list returns all industries ordered by name', () => {
    IndustryRepo.create(db, { name: 'Healthcare' })
    IndustryRepo.create(db, { name: 'Aerospace' })
    IndustryRepo.create(db, { name: 'FinTech' })

    const result = IndustryRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data.map((i) => i.name)).toEqual(['Aerospace', 'FinTech', 'Healthcare'])
  })

  test('update changes name and description', () => {
    const created = IndustryRepo.create(db, { name: 'Tech' })
    const updated = IndustryRepo.update(db, created.id, { name: 'Technology', description: 'Software + hardware' })
    expect(updated?.name).toBe('Technology')
    expect(updated?.description).toBe('Software + hardware')
  })

  test('delete removes industry', () => {
    const created = IndustryRepo.create(db, { name: 'Retail' })
    expect(IndustryRepo.del(db, created.id)).toBe(true)
    expect(IndustryRepo.get(db, created.id)).toBe(null)
  })

  test('countReferences returns 0 for unreferenced', () => {
    const created = IndustryRepo.create(db, { name: 'Robotics' })
    expect(IndustryRepo.countReferences(db, created.id)).toBe(0)
  })

  test('UNIQUE constraint on name', () => {
    IndustryRepo.create(db, { name: 'SaaS' })
    expect(() => IndustryRepo.create(db, { name: 'SaaS' })).toThrow()
  })
})
