/**
 * ReviewService — review queue for pending bullets and perspectives.
 *
 * Returns counts and items in in_review status with
 * relevant context (source title, bullet content).
 *
 * Phase 1.4: uses EntityLifecycleManager
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { ReviewQueue, BulletReviewItem, PerspectiveReviewItem, Result } from '../types'

export class ReviewService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async getPendingReview(): Promise<Result<ReviewQueue>> {
    // Pending bullets via elm.list with status filter
    const bulletResult = await this.elm.list('bullets', {
      where: { status: 'in_review' },
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 10000,
    })
    if (!bulletResult.ok) {
      return { ok: false, error: storageErrorToForgeError(bulletResult.error) }
    }

    const bullets: BulletReviewItem[] = []
    for (const row of bulletResult.value.rows) {
      // Get primary source title via bullet_sources junction
      const bsResult = await this.elm.list('bullet_sources', {
        where: { bullet_id: row.id as string, is_primary: 1 },
        limit: 1,
      })
      let sourceTitle = ''
      if (bsResult.ok && bsResult.value.rows.length > 0) {
        const sourceId = bsResult.value.rows[0].source_id as string
        const srcResult = await this.elm.get('sources', sourceId)
        if (srcResult.ok) {
          sourceTitle = (srcResult.value.title as string) ?? ''
        }
      }

      // Hydrate technologies via bullet_skills + skills junction
      const bskResult = await this.elm.list('bullet_skills', {
        where: { bullet_id: row.id as string },
        limit: 10000,
      })
      const technologies: string[] = []
      if (bskResult.ok) {
        for (const bsk of bskResult.value.rows) {
          const skillResult = await this.elm.get('skills', bsk.skill_id as string)
          if (skillResult.ok) {
            technologies.push((skillResult.value.name as string).toLowerCase().trim())
          }
        }
        technologies.sort()
      }

      bullets.push({
        id: row.id as string,
        content: row.content as string,
        source_content_snapshot: row.source_content_snapshot as string,
        technologies,
        metrics: (row.metrics as string | null) ?? null,
        domain: (row.domain as string | null) ?? null,
        status: row.status as BulletReviewItem['status'],
        rejection_reason: (row.rejection_reason as string | null) ?? null,
        prompt_log_id: (row.prompt_log_id as string | null) ?? null,
        approved_at: (row.approved_at as string | null) ?? null,
        approved_by: (row.approved_by as string | null) ?? null,
        created_at: row.created_at as string,
        source_title: sourceTitle,
      })
    }

    // Pending perspectives via elm.list with status filter
    const perspResult = await this.elm.list('perspectives', {
      where: { status: 'in_review' },
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 10000,
    })
    if (!perspResult.ok) {
      return { ok: false, error: storageErrorToForgeError(perspResult.error) }
    }

    const perspectives: PerspectiveReviewItem[] = []
    for (const row of perspResult.value.rows) {
      // Get bullet content
      let bulletContent = ''
      let sourceTitle = ''
      const bulletId = row.bullet_id as string
      if (bulletId) {
        const bulletResult2 = await this.elm.get('bullets', bulletId)
        if (bulletResult2.ok) {
          bulletContent = (bulletResult2.value.content as string) ?? ''
        }
        // Get primary source title via bullet → bullet_sources → source
        const bsResult = await this.elm.list('bullet_sources', {
          where: { bullet_id: bulletId, is_primary: 1 },
          limit: 1,
        })
        if (bsResult.ok && bsResult.value.rows.length > 0) {
          const sourceId = bsResult.value.rows[0].source_id as string
          const srcResult = await this.elm.get('sources', sourceId)
          if (srcResult.ok) {
            sourceTitle = (srcResult.value.title as string) ?? ''
          }
        }
      }

      perspectives.push({
        id: row.id as string,
        bullet_id: bulletId,
        content: row.content as string,
        bullet_content_snapshot: row.bullet_content_snapshot as string,
        target_archetype: (row.target_archetype as string | null) ?? null,
        domain: (row.domain as string | null) ?? null,
        framing: row.framing as PerspectiveReviewItem['framing'],
        status: row.status as PerspectiveReviewItem['status'],
        rejection_reason: (row.rejection_reason as string | null) ?? null,
        prompt_log_id: (row.prompt_log_id as string | null) ?? null,
        approved_at: (row.approved_at as string | null) ?? null,
        approved_by: (row.approved_by as string | null) ?? null,
        created_at: row.created_at as string,
        bullet_content: bulletContent,
        source_title: sourceTitle,
      })
    }

    return {
      ok: true,
      data: {
        bullets: { count: bullets.length, items: bullets },
        perspectives: { count: perspectives.length, items: perspectives },
      },
    }
  }
}
