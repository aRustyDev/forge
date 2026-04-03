/**
 * SummaryService -- business logic for summary entities.
 *
 * Validates input before delegating to the SummaryRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type { Summary, Resume, Result, PaginatedResult } from '../types'
import * as SummaryRepo from '../db/repositories/summary-repository'
import type { SummaryFilter } from '../db/repositories/summary-repository'

export class SummaryService {
  constructor(private db: Database) {}

  create(input: SummaryRepo.CreateSummaryInput): Result<Summary> {
    if (!input.title || input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (input.is_template !== undefined && input.is_template !== 0 && input.is_template !== 1) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'is_template must be 0 or 1' } }
    }
    const summary = SummaryRepo.create(this.db, input)
    return { ok: true, data: summary }
  }

  get(id: string): Result<Summary> {
    const summary = SummaryRepo.get(this.db, id)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }
    return { ok: true, data: summary }
  }

  list(filter?: SummaryFilter, offset?: number, limit?: number): PaginatedResult<Summary> {
    const result = SummaryRepo.list(this.db, filter, offset, limit)
    return { ok: true, data: result.data, pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 } }
  }

  update(id: string, input: SummaryRepo.UpdateSummaryInput): Result<Summary> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (input.is_template !== undefined && input.is_template !== 0 && input.is_template !== 1) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'is_template must be 0 or 1' } }
    }
    const summary = SummaryRepo.update(this.db, id, input)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }
    return { ok: true, data: summary }
  }

  delete(id: string): Result<void> {
    const deleted = SummaryRepo.del(this.db, id)
    if (!deleted) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }
    return { ok: true, data: undefined }
  }

  clone(id: string): Result<Summary> {
    const cloned = SummaryRepo.clone(this.db, id)
    if (!cloned) {
      return { ok: false, error: { code: 'SUMMARY_NOT_FOUND', message: 'Summary not found' } }
    }
    return { ok: true, data: cloned }
  }

  /** Toggle the is_template flag atomically. */
  toggleTemplate(id: string): Result<Summary> {
    const summary = SummaryRepo.toggleTemplate(this.db, id)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }
    return { ok: true, data: summary }
  }

  /** List resumes linked to a summary via summary_id, with pagination. */
  getLinkedResumes(
    id: string,
    offset?: number,
    limit?: number,
  ): PaginatedResult<Resume> {
    // Verify the summary exists before querying linked resumes
    const summary = SummaryRepo.get(this.db, id)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }

    const result = SummaryRepo.getLinkedResumes(this.db, id, offset, limit)
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
}
