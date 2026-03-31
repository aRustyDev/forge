/**
 * JobDescriptionService -- business logic for job description entities.
 *
 * Validates input before delegating to the JobDescriptionRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type {
  JobDescriptionWithOrg,
  CreateJobDescription,
  UpdateJobDescription,
  Result,
  PaginatedResult,
} from '../types'
import * as JDRepo from '../db/repositories/job-description-repository'
import type { JobDescriptionFilter } from '../db/repositories/job-description-repository'

const VALID_STATUSES = [
  'interested',
  'analyzing',
  'applied',
  'interviewing',
  'offered',
  'rejected',
  'withdrawn',
  'closed',
]

export class JobDescriptionService {
  constructor(private db: Database) {}

  create(input: CreateJobDescription): Result<JobDescriptionWithOrg> {
    if (!input.title || input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' },
      }
    }
    if (!input.raw_text || input.raw_text.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job description text (raw_text) must not be empty',
        },
      }
    }
    if (
      input.status !== undefined &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const jd = JDRepo.create(this.db, input)
    return { ok: true, data: jd }
  }

  get(id: string): Result<JobDescriptionWithOrg> {
    const jd = JDRepo.get(this.db, id)
    if (!jd) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Job description ${id} not found`,
        },
      }
    }
    return { ok: true, data: jd }
  }

  list(
    filter?: JobDescriptionFilter,
    offset?: number,
    limit?: number,
  ): PaginatedResult<JobDescriptionWithOrg> {
    if (
      filter?.status !== undefined &&
      !VALID_STATUSES.includes(filter.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status filter: ${filter.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const result = JDRepo.list(this.db, filter, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: {
        total: result.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  update(
    id: string,
    input: UpdateJobDescription,
  ): Result<JobDescriptionWithOrg> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' },
      }
    }
    if (input.raw_text !== undefined && input.raw_text.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job description text (raw_text) must not be empty',
        },
      }
    }
    if (
      input.status !== undefined &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const jd = JDRepo.update(this.db, id, input)
    if (!jd) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Job description ${id} not found`,
        },
      }
    }
    return { ok: true, data: jd }
  }

  delete(id: string): Result<void> {
    const deleted = JDRepo.del(this.db, id)
    if (!deleted) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Job description ${id} not found`,
        },
      }
    }
    return { ok: true, data: undefined }
  }
}
