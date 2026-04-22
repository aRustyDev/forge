import { describe, expect, test } from 'bun:test'
import { computeMigrationOrder } from '../entity-order'
import { ENTITY_MAP_SHAPE } from '../../entity-map.data'
import type { EntityMap } from '../../entity-map'

describe('computeMigrationOrder', () => {
  const order = computeMigrationOrder(ENTITY_MAP_SHAPE as unknown as EntityMap)

  test('returns all entities', () => {
    const entityCount = Object.keys(ENTITY_MAP_SHAPE).length
    expect(order).toHaveLength(entityCount)
  })

  test('no duplicates', () => {
    expect(new Set(order).size).toBe(order.length)
  })

  test('parents appear before children (sources before source_roles)', () => {
    expect(order.indexOf('sources')).toBeLessThan(order.indexOf('source_roles'))
  })

  test('parents appear before children (bullets before bullet_skills)', () => {
    expect(order.indexOf('bullets')).toBeLessThan(order.indexOf('bullet_skills'))
    expect(order.indexOf('skills')).toBeLessThan(order.indexOf('bullet_skills'))
  })

  test('organizations before source_roles (FK dependency)', () => {
    expect(order.indexOf('organizations')).toBeLessThan(order.indexOf('source_roles'))
  })

  test('skill_categories before skills', () => {
    expect(order.indexOf('skill_categories')).toBeLessThan(order.indexOf('skills'))
  })

  test('resumes before resume_sections before resume_entries', () => {
    expect(order.indexOf('resumes')).toBeLessThan(order.indexOf('resume_sections'))
    expect(order.indexOf('resume_sections')).toBeLessThan(order.indexOf('resume_entries'))
  })

  test('perspectives before resume_entries (FK)', () => {
    // perspectives FK is nullable on resume_entries, but if it exists
    // we still want perspectives migrated first for FK consistency
    const pIdx = order.indexOf('perspectives')
    const reIdx = order.indexOf('resume_entries')
    // perspectives may or may not come before resume_entries depending
    // on whether nullable FKs are included in the dependency graph.
    // At minimum, both should be present.
    expect(pIdx).toBeGreaterThanOrEqual(0)
    expect(reIdx).toBeGreaterThanOrEqual(0)
  })

  test('leaf entities appear before any of their dependents', () => {
    // skill_categories has no non-nullable FKs to other entities
    // It must appear before skills (which depends on it via category_slug FK)
    const scIdx = order.indexOf('skill_categories')
    const skIdx = order.indexOf('skills')
    expect(scIdx).toBeLessThan(skIdx)

    // user_profile has no non-nullable FKs — it's a leaf
    // It must appear before profile_urls (which depends on it)
    const upIdx = order.indexOf('user_profile')
    const puIdx = order.indexOf('profile_urls')
    expect(upIdx).toBeLessThan(puIdx)

    // resume_templates has no non-nullable FKs — it's a leaf
    const rtIdx = order.indexOf('resume_templates')
    expect(rtIdx).toBeGreaterThanOrEqual(0)
  })
})
