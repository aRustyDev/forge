import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { AuditService } from '../audit-service'
import { createTestDb, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('AuditService', () => {
  let db: Database
  let service: AuditService

  beforeEach(() => {
    db = createTestDb()
    service = new AuditService(buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── traceChain ────────────────────────────────────────────────────

  test('traceChain resolves primary source via junction', async () => {
    const srcId = seedSource(db, { description: 'Led cloud migration.' })
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = await service.traceChain(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspective.id).toBe(perspId)
    expect(result.data.bullet.id).toBe(bulletId)
    expect(result.data.source.id).toBe(srcId)
  })

  test('traceChain returns NOT_FOUND for missing perspective', async () => {
    const result = await service.traceChain('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('traceChain returns NOT_FOUND when bullet is missing (broken chain)', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    // Temporarily disable FK constraints to simulate a broken chain
    db.run('PRAGMA foreign_keys = OFF')
    db.run('DELETE FROM bullet_sources WHERE bullet_id = ?', [bulletId])
    db.run('DELETE FROM bullets WHERE id = ?', [bulletId])
    db.run('PRAGMA foreign_keys = ON')

    const result = await service.traceChain(perspId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('Bullet')
    expect(result.error.message).toContain('not found')
  })

  test('traceChain returns NOT_FOUND when no primary source', async () => {
    // Create a bullet with no source associations
    const bulletId = crypto.randomUUID()
    db.run(
      `INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'content', 'snapshot', 'approved')`,
      [bulletId],
    )
    const perspId = seedPerspective(db, bulletId)

    const result = await service.traceChain(perspId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('No primary source')
  })

  // ── checkIntegrity ────────────────────────────────────────────────

  test('checkIntegrity reports matching snapshots', async () => {
    const srcId = seedSource(db, { description: 'Led cloud migration.' })
    // Create bullet with matching snapshot
    const bulletId = crypto.randomUUID()
    db.run(
      `INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, ?, ?, 'approved')`,
      [bulletId, 'Bullet content', 'Led cloud migration.'],
    )
    db.run(
      'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
      [bulletId, srcId],
    )

    // Create perspective with matching snapshot
    const perspId = crypto.randomUUID()
    db.run(
      `INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status)
       VALUES (?, ?, 'Perspective content', ?, 'agentic-ai', 'ai_ml', 'accomplishment', 'approved')`,
      [perspId, bulletId, 'Bullet content'],
    )

    const result = await service.checkIntegrity(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullet_snapshot_matches).toBe(true)
    expect(result.data.source_snapshot_matches).toBe(true)
    expect(result.data.bullet_diff).toBeUndefined()
    expect(result.data.source_diff).toBeUndefined()
  })

  test('checkIntegrity detects bullet content drift', async () => {
    const srcId = seedSource(db, { description: 'Original desc.' })
    const bulletId = crypto.randomUUID()
    db.run(
      `INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, ?, ?, 'approved')`,
      [bulletId, 'Updated bullet content', 'Original desc.'],
    )
    db.run(
      'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
      [bulletId, srcId],
    )

    const perspId = crypto.randomUUID()
    db.run(
      `INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status)
       VALUES (?, ?, 'Perspective', ?, 'agentic-ai', 'ai_ml', 'accomplishment', 'approved')`,
      [perspId, bulletId, 'Old bullet content'],
    )

    const result = await service.checkIntegrity(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullet_snapshot_matches).toBe(false)
    expect(result.data.bullet_diff).toBeDefined()
    expect(result.data.bullet_diff!.snapshot).toBe('Old bullet content')
    expect(result.data.bullet_diff!.current).toBe('Updated bullet content')
  })

  test('checkIntegrity detects source description drift', async () => {
    const srcId = seedSource(db, { description: 'Updated description.' })
    const bulletId = crypto.randomUUID()
    db.run(
      `INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, ?, ?, 'approved')`,
      [bulletId, 'Bullet content', 'Old description.'],
    )
    db.run(
      'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
      [bulletId, srcId],
    )

    const perspId = crypto.randomUUID()
    db.run(
      `INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status)
       VALUES (?, ?, 'Perspective', ?, 'agentic-ai', 'ai_ml', 'accomplishment', 'approved')`,
      [perspId, bulletId, 'Bullet content'],
    )

    const result = await service.checkIntegrity(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.source_snapshot_matches).toBe(false)
    expect(result.data.source_diff).toBeDefined()
    expect(result.data.source_diff!.snapshot).toBe('Old description.')
    expect(result.data.source_diff!.current).toBe('Updated description.')
  })

  test('checkIntegrity returns NOT_FOUND for missing perspective', async () => {
    const result = await service.checkIntegrity('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})
