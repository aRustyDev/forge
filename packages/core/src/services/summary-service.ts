/**
 * SummaryService -- business logic for summary entities.
 *
 * Validates input before delegating to the SummaryRepository.
 * All methods return Result<T> (never throw).
 *
 * Phase 91 additions: structured fields (industry_id, role_type_id),
 * skill keyword junction, filter/sort on list().
 */

import type { Database } from 'bun:sqlite'
import type {
  Summary,
  SummaryWithRelations,
  Resume,
  Result,
  PaginatedResult,
  Skill,
} from '../types'
import * as SummaryRepo from '../db/repositories/summary-repository'
import type {
  SummaryFilter,
  SummarySort,
  SummarySortBy,
  SortDirection,
} from '../db/repositories/summary-repository'

const VALID_SORT_BY: readonly SummarySortBy[] = ['title', 'created_at', 'updated_at'] as const
const VALID_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'] as const

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

  getWithRelations(id: string): Result<SummaryWithRelations> {
    const summary = SummaryRepo.getWithRelations(this.db, id)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${id} not found` } }
    }
    return { ok: true, data: summary }
  }

  list(
    filter?: SummaryFilter,
    sort?: SummarySort,
    offset?: number,
    limit?: number,
  ): PaginatedResult<Summary> {
    if (sort?.sort_by !== undefined && !VALID_SORT_BY.includes(sort.sort_by)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid sort_by '${sort.sort_by}'. Valid: ${VALID_SORT_BY.join(', ')}`,
        },
      }
    }
    if (sort?.direction !== undefined && !VALID_DIRECTIONS.includes(sort.direction)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid direction '${sort.direction}'. Valid: ${VALID_DIRECTIONS.join(', ')}`,
        },
      }
    }
    const result = SummaryRepo.list(this.db, filter, sort, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
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

  // ── Skill keyword junction ──────────────────────────────────────────

  /** Link a skill as a keyword on the summary (idempotent). */
  addSkill(summaryId: string, skillId: string): Result<void> {
    const summary = SummaryRepo.get(this.db, summaryId)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${summaryId} not found` } }
    }
    try {
      SummaryRepo.addSkill(this.db, summaryId, skillId)
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('FOREIGN KEY')) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` } }
      }
      throw err
    }
  }

  /** Unlink a skill keyword from the summary. */
  removeSkill(summaryId: string, skillId: string): Result<void> {
    SummaryRepo.removeSkill(this.db, summaryId, skillId)
    return { ok: true, data: undefined }
  }

  /** Get all skill keywords linked to the summary. */
  getSkills(summaryId: string): Result<Skill[]> {
    const summary = SummaryRepo.get(this.db, summaryId)
    if (!summary) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Summary ${summaryId} not found` } }
    }
    return { ok: true, data: SummaryRepo.getSkills(this.db, summaryId) }
  }
}
