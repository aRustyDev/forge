// packages/core/src/services/__tests__/embedding-service.test.ts

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { EmbeddingService } from '../embedding-service'
import { EmbeddingRepository } from '../../db/repositories/embedding-repository'
import { resetPipeline } from '../../lib/model-loader'
import { createTestDb } from '../../db/__tests__/helpers'
import type { Bullet } from '../../types'

// AP2: Clean up module-level mutable singleton to prevent test pollution
afterAll(() => {
  resetPipeline()
})

describe('EmbeddingService', () => {
  let db: Database
  let service: EmbeddingService

  beforeEach(() => {
    db = createTestDb()
    service = new EmbeddingService(db)
  })

  afterEach(() => db.close())

  describe('embed()', () => {
    it('computes and stores an embedding', async () => {
      const result = await service.embed('bullet', 'b-001', 'Designed Kubernetes clusters')
      expect(result.ok).toBe(true)

      const row = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')
      expect(row).not.toBeNull()
      expect(row!.entity_type).toBe('bullet')
      expect(row!.entity_id).toBe('b-001')

      const vec = EmbeddingRepository.deserializeVector(row!.vector)
      expect(vec.length).toBe(384)
    })

    it('skips recomputation if content hash matches', async () => {
      await service.embed('bullet', 'b-001', 'Same text')
      const row1 = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')

      await service.embed('bullet', 'b-001', 'Same text')
      const row2 = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')

      // Same created_at means it was not re-upserted
      expect(row1!.created_at).toBe(row2!.created_at)
    })

    it('re-embeds when content changes', async () => {
      await service.embed('bullet', 'b-001', 'Original text')
      const row1 = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')

      await service.embed('bullet', 'b-001', 'Updated text')
      const row2 = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')

      expect(row1!.content_hash).not.toBe(row2!.content_hash)
    })
  })

  describe('findSimilar()', () => {
    it('returns similar entities above threshold', async () => {
      // Seed embeddings
      await service.embed('bullet', 'b-infra', 'Managed AWS infrastructure and deployed with Terraform')
      await service.embed('bullet', 'b-sec', 'Implemented zero-trust security architecture')
      await service.embed('bullet', 'b-food', 'Baked artisan sourdough bread')

      const result = await service.findSimilar(
        'Cloud infrastructure automation',
        'bullet',
        0.3,
        10,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // b-infra should be most similar
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0].entity_id).toBe('b-infra')

      // b-food should be least similar (possibly filtered out)
      const foodMatch = result.data.find(m => m.entity_id === 'b-food')
      if (foodMatch) {
        expect(foodMatch.similarity).toBeLessThan(result.data[0].similarity)
      }
    })

    it('respects threshold filter', async () => {
      await service.embed('bullet', 'b-1', 'Python web development with Django')

      const highThreshold = await service.findSimilar('Cooking pasta', 'bullet', 0.9)
      expect(highThreshold.ok).toBe(true)
      if (highThreshold.ok) {
        expect(highThreshold.data.length).toBe(0)
      }
    })

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await service.embed('bullet', `b-${i}`, `Software engineering task number ${i}`)
      }

      const result = await service.findSimilar('Engineering', 'bullet', 0.0, 3)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.length).toBeLessThanOrEqual(3)
      }
    })
  })

  describe('checkStale() + refreshStale()', () => {
    it('detects stale bullet after content update and refreshes it', async () => {
      const bulletId = crypto.randomUUID()
      // Seed a bullet in the DB and embed it
      db.run(
        `INSERT INTO bullets (id, content, source_content_snapshot, status, created_at)
         VALUES (?, 'Original content for stale test', '', 'approved', datetime('now'))`,
        [bulletId],
      )
      await service.embed('bullet', bulletId, 'Original content for stale test')

      // Verify it is not stale initially
      const freshResult = await service.checkStale()
      expect(freshResult.ok).toBe(true)
      if (freshResult.ok) {
        const staleBullet = freshResult.data.find(
          s => s.entity_type === 'bullet' && s.entity_id === bulletId,
        )
        expect(staleBullet).toBeUndefined()
      }

      // Update bullet content directly via SQL (simulating an external edit)
      db.run(`UPDATE bullets SET content = 'Updated content for stale test' WHERE id = ?`, [bulletId])

      // Now it should be stale
      const staleResult = await service.checkStale()
      expect(staleResult.ok).toBe(true)
      if (staleResult.ok) {
        const staleBullet = staleResult.data.find(
          s => s.entity_type === 'bullet' && s.entity_id === bulletId,
        )
        expect(staleBullet).toBeDefined()
      }

      // Refresh and verify it is no longer stale
      const refreshResult = await service.refreshStale()
      expect(refreshResult.ok).toBe(true)

      const afterRefresh = await service.checkStale()
      expect(afterRefresh.ok).toBe(true)
      if (afterRefresh.ok) {
        const staleBullet = afterRefresh.data.find(
          s => s.entity_type === 'bullet' && s.entity_id === bulletId,
        )
        expect(staleBullet).toBeUndefined()
      }
    })

    it('cleans up orphan embeddings for deleted entities', async () => {
      const bulletId = crypto.randomUUID()
      // Embed a bullet, then delete the bullet from the source table
      db.run(
        `INSERT INTO bullets (id, content, source_content_snapshot, status, created_at)
         VALUES (?, 'Content that will be orphaned', '', 'approved', datetime('now'))`,
        [bulletId],
      )
      await service.embed('bullet', bulletId, 'Content that will be orphaned')

      // Delete the source entity
      db.run(`DELETE FROM bullets WHERE id = ?`, [bulletId])

      // The embedding should still exist
      const beforeRefresh = EmbeddingRepository.findByEntity(db, 'bullet', bulletId)
      expect(beforeRefresh).not.toBeNull()

      // refreshStale should clean up the orphan
      await service.refreshStale()

      const afterRefresh = EmbeddingRepository.findByEntity(db, 'bullet', bulletId)
      expect(afterRefresh).toBeNull()
    })
  })

  describe('onBulletCreated()', () => {
    it('embeds bullet content without throwing', async () => {
      // M2 note: Use `as Bullet` cast for minimal fixture subset.
      const bullet = {
        id: 'b-test',
        content: 'Built CI/CD pipelines with GitHub Actions',
        source_content_snapshot: '',
        technologies: [],
        metrics: null,
        domain: null,
        status: 'pending_review' as const,
        rejection_reason: null,
        prompt_log_id: null,
        approved_at: null,
        approved_by: null,
        notes: null,
        created_at: new Date().toISOString(),
      } as Bullet

      // Should not throw
      await service.onBulletCreated(bullet)

      const row = EmbeddingRepository.findByEntity(db, 'bullet', 'b-test')
      expect(row).not.toBeNull()
    })
  })

  describe('onJDCreated()', () => {
    it('embeds each requirement with indexed entity ID', async () => {
      const jd = {
        id: 'jd-001',
        organization_id: null,
        title: 'Senior Engineer',
        url: null,
        raw_text: 'full text here',
        status: 'interested' as const,
        salary_range: null,
        location: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const requirements = [
        '5+ years of experience with Python',
        'Experience with Kubernetes and Docker',
        'Strong understanding of distributed systems',
      ]

      await service.onJDCreated(jd, requirements)

      for (let i = 0; i < requirements.length; i++) {
        const row = EmbeddingRepository.findByEntity(db, 'jd_requirement', `jd-001:${i}`)
        expect(row).not.toBeNull()
      }
    })
  })
})
