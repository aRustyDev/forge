/**
 * Tests for IntegrityService — content drift detection.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { IntegrityService } from '../integrity-service'
import { createTestDb, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('IntegrityService', () => {
  let db: Database
  let service: IntegrityService

  beforeEach(() => {
    db = createTestDb()
    service = new IntegrityService(buildDefaultElm(db))
  })
  afterEach(() => db.close())

  // -- getDriftedEntities -----------------------------------------------

  test('returns empty when no entities exist', async () => {
    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })

  test('returns empty when all bullet snapshots match', async () => {
    const srcId = seedSource(db, { description: 'snapshot of source content' })
    // seedBullet uses 'snapshot of source content' as the default source_content_snapshot
    seedBullet(db, [{ id: srcId }])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Filter to bullet drifts only (perspectives may exist)
    const bulletDrifts = result.data.filter(d => d.entity_type === 'bullet')
    expect(bulletDrifts).toHaveLength(0)
  })

  test('detects bullet with stale source snapshot', async () => {
    const srcId = seedSource(db, { description: 'Original description' })
    const bulletId = seedBullet(db, [{ id: srcId }])

    // Update source description to create drift
    db.run("UPDATE sources SET description = 'Updated description' WHERE id = ?", [srcId])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const bulletDrifts = result.data.filter(d => d.entity_type === 'bullet')
    expect(bulletDrifts).toHaveLength(1)
    expect(bulletDrifts[0].entity_id).toBe(bulletId)
    expect(bulletDrifts[0].snapshot_field).toBe('source_content_snapshot')
    expect(bulletDrifts[0].snapshot_value).toBe('snapshot of source content')
    expect(bulletDrifts[0].current_value).toBe('Updated description')
  })

  test('returns empty when all perspective snapshots match', async () => {
    const srcId = seedSource(db)
    // seedBullet default content: 'Led 4-engineer team migrating...'
    // seedPerspective default bullet_content_snapshot: 'snapshot of bullet content'
    // These don't match so use custom values that do match
    const bulletId = seedBullet(db, [{ id: srcId }], { content: 'snapshot of bullet content' })
    seedPerspective(db, bulletId)

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perspDrifts = result.data.filter(d => d.entity_type === 'perspective')
    expect(perspDrifts).toHaveLength(0)
  })

  test('detects perspective with stale bullet snapshot', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    // Update bullet content to create drift
    db.run("UPDATE bullets SET content = 'Updated bullet content' WHERE id = ?", [bulletId])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const perspDrifts = result.data.filter(d => d.entity_type === 'perspective')
    expect(perspDrifts).toHaveLength(1)
    expect(perspDrifts[0].entity_id).toBe(perspId)
    expect(perspDrifts[0].snapshot_field).toBe('bullet_content_snapshot')
    expect(perspDrifts[0].snapshot_value).toBe('snapshot of bullet content')
    expect(perspDrifts[0].current_value).toBe('Updated bullet content')
  })

  test('detects both bullet and perspective drift simultaneously', async () => {
    const srcId = seedSource(db, { description: 'Original source' })
    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId)

    // Create both types of drift
    db.run("UPDATE sources SET description = 'Changed source' WHERE id = ?", [srcId])
    db.run("UPDATE bullets SET content = 'Changed bullet' WHERE id = ?", [bulletId])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const bulletDrifts = result.data.filter(d => d.entity_type === 'bullet')
    const perspDrifts = result.data.filter(d => d.entity_type === 'perspective')
    expect(bulletDrifts).toHaveLength(1)
    expect(perspDrifts).toHaveLength(1)
  })

  test('does not flag bullets without a primary source', async () => {
    // Create a bullet with no source associations
    const bulletId = seedBullet(db, [])

    // Even if we change some other source, this bullet has no primary source
    // so it should not appear in drift results
    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const bulletDrifts = result.data.filter(d => d.entity_type === 'bullet')
    expect(bulletDrifts).toHaveLength(0)
  })

  test('handles multiple drifted bullets', async () => {
    const src1 = seedSource(db, { title: 'Source 1', description: 'Desc 1' })
    const src2 = seedSource(db, { title: 'Source 2', description: 'Desc 2' })
    const b1 = seedBullet(db, [{ id: src1 }])
    const b2 = seedBullet(db, [{ id: src2 }])

    // Create drift on both
    db.run("UPDATE sources SET description = 'Changed 1' WHERE id = ?", [src1])
    db.run("UPDATE sources SET description = 'Changed 2' WHERE id = ?", [src2])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const bulletDrifts = result.data.filter(d => d.entity_type === 'bullet')
    expect(bulletDrifts).toHaveLength(2)
    const ids = bulletDrifts.map(d => d.entity_id).sort()
    expect(ids).toEqual([b1, b2].sort())
  })

  test('handles multiple drifted perspectives from same bullet', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const p1 = seedPerspective(db, bulletId, { archetype: 'agentic-ai' })
    const p2 = seedPerspective(db, bulletId, { archetype: 'platform-eng' })

    // Create drift
    db.run("UPDATE bullets SET content = 'Changed bullet' WHERE id = ?", [bulletId])

    const result = await service.getDriftedEntities()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const perspDrifts = result.data.filter(d => d.entity_type === 'perspective')
    expect(perspDrifts).toHaveLength(2)
    const ids = perspDrifts.map(d => d.entity_id).sort()
    expect(ids).toEqual([p1, p2].sort())
  })
})
