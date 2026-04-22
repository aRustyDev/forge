import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { ReviewService } from '../review-service'
import { createTestDb, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('ReviewService', () => {
  let db: Database
  let service: ReviewService

  beforeEach(() => {
    db = createTestDb()
    service = new ReviewService(buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── getPendingReview ──────────────────────────────────────────────

  test('getPendingReview returns empty queues when nothing pending', async () => {
    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets.count).toBe(0)
    expect(result.data.bullets.items).toHaveLength(0)
    expect(result.data.perspectives.count).toBe(0)
    expect(result.data.perspectives.items).toHaveLength(0)
  })

  test('getPendingReview returns pending bullets with source title from junction', async () => {
    const srcId = seedSource(db, { title: 'Cloud Migration' })
    seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets.count).toBe(1)
    expect(result.data.bullets.items[0].source_title).toBe('Cloud Migration')
  })

  test('getPendingReview does not include approved bullets', async () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }], { status: 'approved' })
    seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets.count).toBe(1)
  })

  test('getPendingReview returns pending perspectives with bullet content and source title', async () => {
    const srcId = seedSource(db, { title: 'Security Platform' })
    const bulletId = seedBullet(db, [{ id: srcId }], { content: 'Built security platform' })
    seedPerspective(db, bulletId, { status: 'in_review' })

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspectives.count).toBe(1)
    expect(result.data.perspectives.items[0].bullet_content).toBe('Built security platform')
    expect(result.data.perspectives.items[0].source_title).toBe('Security Platform')
  })

  test('getPendingReview does not include approved perspectives', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId, { status: 'approved' })
    seedPerspective(db, bulletId, { status: 'in_review' })

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspectives.count).toBe(1)
  })

  test('getPendingReview hydrates technologies for bullets', async () => {
    const srcId = seedSource(db)
    // Create bullet manually to set technologies
    const bulletId = crypto.randomUUID()
    db.run(
      `INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'Test bullet', 'snapshot', 'in_review')`,
      [bulletId],
    )
    db.run(
      'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
      [bulletId, srcId],
    )
    // Phase 89: technologies are now backed by bullet_skills + skills junction.
    const tsId = crypto.randomUUID()
    const awsId = crypto.randomUUID()
    db.run(`INSERT INTO skills (id, name, category) VALUES (?, 'typescript', 'other')`, [tsId])
    db.run(`INSERT INTO skills (id, name, category) VALUES (?, 'aws', 'other')`, [awsId])
    db.run('INSERT INTO bullet_skills (bullet_id, skill_id) VALUES (?, ?)', [bulletId, tsId])
    db.run('INSERT INTO bullet_skills (bullet_id, skill_id) VALUES (?, ?)', [bulletId, awsId])

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets.items[0].technologies).toContain('typescript')
    expect(result.data.bullets.items[0].technologies).toContain('aws')
  })

  test('getPendingReview returns combined bullets and perspectives', async () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }], { status: 'in_review' })
    seedBullet(db, [{ id: srcId }], { status: 'in_review', content: 'Second bullet' })

    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId, { status: 'in_review' })

    const result = await service.getPendingReview()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets.count).toBe(2)
    expect(result.data.perspectives.count).toBe(1)
  })
})
