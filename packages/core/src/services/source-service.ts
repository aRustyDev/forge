/**
 * SourceService — business logic for source experience entries.
 *
 * Validates input before delegating to the SourceRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type { Source, SourceWithExtension, CreateSource, UpdateSource, Result, PaginatedResult } from '../types'
import * as SourceRepo from '../db/repositories/source-repository'
import type { SourceFilter } from '../db/repositories/source-repository'
import type { EmbeddingService } from './embedding-service'

export class SourceService {
  private embeddingService: EmbeddingService | null = null

  constructor(private db: Database) {}

  /**
   * Set the embedding service for fire-and-forget hooks.
   *
   * NOTE (I6): Constructor injection would be preferred but requires careful
   * ordering in createServices(). The setter pattern is used here because
   * EmbeddingService initialization is async (model loading) and may complete
   * after createServices(). This avoids circular dependency issues.
   */
  setEmbeddingService(svc: EmbeddingService): void {
    this.embeddingService = svc
  }

  createSource(input: CreateSource): Result<SourceWithExtension> {
    if (!input.title || input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (!input.description || input.description.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Description must not be empty' } }
    }

    const source = SourceRepo.create(this.db, input)

    // Fire-and-forget embedding for source description
    if (this.embeddingService) {
      queueMicrotask(() =>
        this.embeddingService!.onSourceCreated(source).catch(err =>
          // TODO: Replace with structured logger (Phase 23)
          console.error(`[SourceService] Embedding hook failed for source ${source.id}:`, err)
        )
      )
    }

    return { ok: true, data: source }
  }

  getSource(id: string): Result<SourceWithExtension> {
    const source = SourceRepo.get(this.db, id)
    if (!source) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${id} not found` } }
    }
    return { ok: true, data: source }
  }

  listSources(
    filter: SourceFilter = {},
    offset = 0,
    limit = 50,
  ): PaginatedResult<SourceWithExtension> {
    const result = SourceRepo.list(this.db, filter, offset, limit)
    // Enrich each source with its extension data
    const enriched = result.data.map(source => {
      const extension = SourceRepo.getExtension(this.db, source.id, source.source_type)
      return { ...source, extension }
    })
    return {
      ok: true,
      data: enriched,
      pagination: { total: result.total, offset, limit },
    }
  }

  updateSource(id: string, input: UpdateSource): Result<SourceWithExtension> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (input.description !== undefined && input.description.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Description must not be empty' } }
    }

    const source = SourceRepo.update(this.db, id, input)
    if (!source) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${id} not found` } }
    }
    return { ok: true, data: source }
  }

  deleteSource(id: string): Result<void> {
    try {
      const deleted = SourceRepo.del(this.db, id)
      if (!deleted) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${id} not found` } }
      }
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('FOREIGN KEY constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Cannot delete source with existing bullets' } }
      }
      throw err
    }
  }
}
