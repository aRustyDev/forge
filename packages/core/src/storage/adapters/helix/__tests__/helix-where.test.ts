import { describe, expect, test } from 'bun:test'
import { routeWhereClause, filterInTypeScript } from '../helix-where'
import type { WhereClause } from '../../../adapter-types'

describe('routeWhereClause', () => {
  test('no where clause → tier 1 list', () => {
    const result = routeWhereClause('bullets', undefined, new Set(), new Map())
    expect(result.tier).toBe(1)
    expect(result.strategy).toBe('list')
  })

  test('simple equality on single field → tier 1 getBy', () => {
    const result = routeWhereClause('bullets', { status: 'draft' }, new Set(), new Map())
    expect(result.tier).toBe(1)
    expect(result.strategy).toBe('getBy')
    expect(result.params).toEqual({ status: 'draft' })
  })

  test('edge entity with from field → tier 1 listFrom', () => {
    const edgeMeta = new Map([
      ['bullet_skills', { fromEntity: 'bullets', fromField: 'bullet_id', toEntity: 'skills', toField: 'skill_id', propertyFields: [] as string[] }],
    ])
    const result = routeWhereClause('bullet_skills', { bullet_id: 'abc' }, new Set(['bullet_skills']), edgeMeta)
    expect(result.tier).toBe(1)
    expect(result.strategy).toBe('listFrom')
    expect(result.params).toEqual({ id: 'abc' })
  })

  test('edge entity with to field → tier 1 listTo', () => {
    const edgeMeta = new Map([
      ['bullet_skills', { fromEntity: 'bullets', fromField: 'bullet_id', toEntity: 'skills', toField: 'skill_id', propertyFields: [] as string[] }],
    ])
    const result = routeWhereClause('bullet_skills', { skill_id: 'xyz' }, new Set(['bullet_skills']), edgeMeta)
    expect(result.tier).toBe(1)
    expect(result.strategy).toBe('listTo')
    expect(result.params).toEqual({ id: 'xyz' })
  })

  test('$in operator → tier 2', () => {
    const result = routeWhereClause('sources', { id: { $in: ['a', 'b'] } }, new Set(), new Map())
    expect(result.tier).toBe(2)
    expect(result.strategy).toBe('filterIn')
    expect(result.field).toBe('id')
  })

  test('$like operator → tier 2', () => {
    const result = routeWhereClause('organizations', { name: { $like: '%foo%' } }, new Set(), new Map())
    expect(result.tier).toBe(2)
    expect(result.strategy).toBe('filterLike')
    expect(result.field).toBe('name')
  })

  test('$gt operator → tier 2', () => {
    const result = routeWhereClause('pending_derivations', { expires_at: { $gt: '2026-01-01' } }, new Set(), new Map())
    expect(result.tier).toBe(2)
    expect(result.strategy).toBe('filterGt')
    expect(result.field).toBe('expires_at')
  })

  test('$or compound → tier 3 fallback', () => {
    const where: WhereClause = { $or: [{ name: 'a' }, { name: 'b' }] }
    const result = routeWhereClause('organizations', where, new Set(), new Map())
    expect(result.tier).toBe(3)
    expect(result.strategy).toBe('clientFilter')
  })

  test('$and compound → tier 3 fallback', () => {
    const where: WhereClause = { $and: [{ status: 'draft' }, { name: 'a' }] }
    const result = routeWhereClause('organizations', where, new Set(), new Map())
    expect(result.tier).toBe(3)
    expect(result.strategy).toBe('clientFilter')
  })

  test('composite equality (2 simple fields) → tier 1 getBy', () => {
    const result = routeWhereClause('perspectives', { bullet_id: 'x', status: 'approved' }, new Set(), new Map())
    expect(result.tier).toBe(1)
    expect(result.strategy).toBe('getBy')
    expect(result.params).toEqual({ bullet_id: 'x', status: 'approved' })
  })
})

describe('filterInTypeScript', () => {
  const rows = [
    { id: '1', name: 'Alice', status: 'active' },
    { id: '2', name: 'Bob', status: 'draft' },
    { id: '3', name: 'Carol', status: 'active' },
  ]

  test('simple equality filter', () => {
    const result = filterInTypeScript(rows, { status: 'active' })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['1', '3'])
  })

  test('$in filter', () => {
    const result = filterInTypeScript(rows, { id: { $in: ['1', '3'] } })
    expect(result).toHaveLength(2)
  })

  test('$like filter', () => {
    const result = filterInTypeScript(rows, { name: { $like: '%ob%' } })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  test('$or filter', () => {
    const result = filterInTypeScript(rows, { $or: [{ name: 'Alice' }, { name: 'Carol' }] })
    expect(result).toHaveLength(2)
  })

  test('$and filter', () => {
    const result = filterInTypeScript(rows, { $and: [{ status: 'active' }, { name: 'Alice' }] })
    expect(result).toHaveLength(1)
  })

  test('$ne filter', () => {
    const result = filterInTypeScript(rows, { status: { $ne: 'active' } })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  test('$gt filter', () => {
    const result = filterInTypeScript(rows, { id: { $gt: '1' } })
    expect(result).toHaveLength(2)
  })
})
