/**
 * BulletService — business logic for bullet points.
 *
 * Enforces status transition rules: in_review → approved,
 * in_review → rejected, rejected → in_review (reopen).
 * Any non-archived status can transition to archived.
 * Archived status can transition back to draft.
 */

import type { Database } from 'bun:sqlite'
import type { Result, PaginatedResult } from '../types'
import { BulletRepository } from '../db/repositories/bullet-repository'
import type { Bullet, BulletStatus, BulletFilter, UpdateBulletInput } from '../db/repositories/bullet-repository'

/** Valid status transitions for bullets. */
const VALID_TRANSITIONS: Record<string, BulletStatus[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'rejected'],
  rejected: ['in_review'],
  approved: ['archived'],
  archived: ['draft'],
}

export class BulletService {
  constructor(private db: Database) {}

  getBullet(id: string): Result<Bullet> {
    const bullet = BulletRepository.get(this.db, id)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${id} not found` } }
    }
    return { ok: true, data: bullet }
  }

  listBullets(
    filter: BulletFilter = {},
    offset = 0,
    limit = 50,
  ): PaginatedResult<Bullet> {
    const result = BulletRepository.list(this.db, filter, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit },
    }
  }

  updateBullet(id: string, input: UpdateBulletInput): Result<Bullet> {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' } }
    }

    const bullet = BulletRepository.update(this.db, id, input)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${id} not found` } }
    }
    return { ok: true, data: bullet }
  }

  deleteBullet(id: string): Result<void> {
    try {
      const deleted = BulletRepository.delete(this.db, id)
      if (!deleted) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${id} not found` } }
      }
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('FOREIGN KEY constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Cannot delete bullet with existing perspectives' } }
      }
      throw err
    }
  }

  approveBullet(id: string): Result<Bullet> {
    return this.transition(id, 'approved')
  }

  rejectBullet(id: string, reason: string): Result<Bullet> {
    if (!reason || reason.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason must not be empty' } }
    }
    return this.transition(id, 'rejected', { rejection_reason: reason })
  }

  reopenBullet(id: string): Result<Bullet> {
    return this.transition(id, 'in_review')
  }

  /**
   * Submit a draft bullet for review (draft -> in_review).
   * Only draft bullets can be submitted. Use reopenBullet for rejected bullets.
   */
  submitBullet(id: string): Result<Bullet> {
    const bullet = BulletRepository.get(this.db, id)
    if (!bullet) return { ok: false, error: { code: 'NOT_FOUND', message: 'Bullet not found' } }
    if (bullet.status !== 'draft') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Only draft bullets can be submitted for review' } }
    }
    return this.transition(id, 'in_review')
  }

  private transition(
    id: string,
    target: BulletStatus,
    opts?: { rejection_reason?: string },
  ): Result<Bullet> {
    const bullet = BulletRepository.get(this.db, id)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${id} not found` } }
    }

    const allowed = VALID_TRANSITIONS[bullet.status] ?? []
    if (!allowed.includes(target)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot transition from '${bullet.status}' to '${target}'`,
        },
      }
    }

    const updated = BulletRepository.updateStatus(this.db, id, target, opts)
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${id} not found` } }
    }
    return { ok: true, data: updated }
  }
}
