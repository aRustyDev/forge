/**
 * PerspectiveService — business logic for perspective reframings.
 *
 * Same status transition rules as BulletService: pending_review → approved,
 * pending_review → rejected, rejected → pending_review (reopen).
 * Delete is blocked if perspective is in a resume.
 */

import type { Database } from 'bun:sqlite'
import type {
  Perspective,
  PerspectiveWithChain,
  PerspectiveStatus,
  PerspectiveFilter,
  UpdatePerspectiveInput,
  Result,
  PaginatedResult,
} from '../types'
import { PerspectiveRepository } from '../db/repositories/perspective-repository'

/** Valid status transitions for perspectives. */
const VALID_TRANSITIONS: Record<string, PerspectiveStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  rejected: ['pending_review'],
  approved: [],
}

export class PerspectiveService {
  constructor(private db: Database) {}

  getPerspective(id: string): Result<Perspective> {
    const p = PerspectiveRepository.get(this.db, id)
    if (!p) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
    }
    return { ok: true, data: p }
  }

  getPerspectiveWithChain(id: string): Result<PerspectiveWithChain> {
    const chain = PerspectiveRepository.getWithChain(this.db, id)
    if (!chain) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
    }
    return { ok: true, data: chain }
  }

  listPerspectives(
    filter: PerspectiveFilter = {},
    offset = 0,
    limit = 50,
  ): PaginatedResult<Perspective> {
    const result = PerspectiveRepository.list(this.db, filter, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit },
    }
  }

  updatePerspective(id: string, input: UpdatePerspectiveInput): Result<Perspective> {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' } }
    }

    const p = PerspectiveRepository.update(this.db, id, input)
    if (!p) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
    }
    return { ok: true, data: p }
  }

  deletePerspective(id: string): Result<void> {
    try {
      const deleted = PerspectiveRepository.delete(this.db, id)
      if (!deleted) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
      }
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('FOREIGN KEY constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Cannot delete perspective that is in a resume' } }
      }
      throw err
    }
  }

  approvePerspective(id: string): Result<Perspective> {
    return this.transition(id, 'approved')
  }

  rejectPerspective(id: string, reason: string): Result<Perspective> {
    if (!reason || reason.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason must not be empty' } }
    }
    return this.transition(id, 'rejected', { rejection_reason: reason })
  }

  reopenPerspective(id: string): Result<Perspective> {
    return this.transition(id, 'pending_review')
  }

  private transition(
    id: string,
    target: PerspectiveStatus,
    opts?: { rejection_reason?: string },
  ): Result<Perspective> {
    const p = PerspectiveRepository.get(this.db, id)
    if (!p) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
    }

    const allowed = VALID_TRANSITIONS[p.status] ?? []
    if (!allowed.includes(target)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot transition from '${p.status}' to '${target}'`,
        },
      }
    }

    const updated = PerspectiveRepository.updateStatus(this.db, id, target, opts)
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${id} not found` } }
    }
    return { ok: true, data: updated }
  }
}
