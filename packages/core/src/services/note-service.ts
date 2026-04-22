/**
 * NoteService — business logic for user notes and reference linking.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of NoteRepository.
 *
 * Validates input before delegating to the ELM. All methods return
 * Result<T> (never throw).
 *
 * Polymorphic `note_references` junction: the table has a composite
 * primary key `(note_id, entity_type, entity_id)` and no FK on
 * `entity_id` (the referenced id is just a text column — notes can
 * point at sources, bullets, organizations, etc.). The service keeps
 * its own narrower `VALID_ENTITY_TYPES` list because the historical
 * contract rejects certain types that the entity map's broader enum
 * would accept.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { UserNote, NoteReference, Result, PaginatedResult, UserNoteWithReferences } from '../types'

const VALID_ENTITY_TYPES = [
  'source',
  'bullet',
  'perspective',
  'resume_entry',
  'resume',
  'skill',
  'organization',
  'job_description',
  'contact',
  'credential',
  'certification',
]

export class NoteService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: { title?: string; content: string }): Promise<Result<UserNote>> {
    if (!input.content || input.content.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' },
      }
    }

    const createResult = await this.elm.create('user_notes', {
      title: input.title ?? null,
      content: input.content,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchNote(createResult.value.id)
  }

  async get(id: string): Promise<Result<UserNoteWithReferences>> {
    const noteResult = await this.fetchNote(id)
    if (!noteResult.ok) return noteResult

    const refsResult = await this.elm.list('note_references', {
      where: { note_id: id },
      limit: 1000,
    })
    const references: NoteReference[] = refsResult.ok
      ? (refsResult.value.rows as unknown as NoteReference[])
      : []

    return { ok: true, data: { ...noteResult.data, references } }
  }

  async list(
    search?: string,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<UserNote>> {
    // The historical repository runs `content LIKE ? OR title LIKE ?`.
    // The WhereClause DSL has `$like` and `$or`, so we can express the
    // same filter without falling back to a named query.
    const where = search
      ? {
          $or: [
            { content: { $like: `%${search}%` } },
            { title: { $like: `%${search}%` } },
          ],
        }
      : undefined

    const listResult = await this.elm.list('user_notes', {
      where,
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows as unknown as UserNote[],
      pagination: {
        total: listResult.value.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  async update(
    id: string,
    input: { title?: string; content?: string },
  ): Promise<Result<UserNote>> {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.content !== undefined) patch.content = input.content

    const updateResult = await this.elm.update('user_notes', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchNote(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('user_notes', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async addReference(
    noteId: string,
    entityType: string,
    entityId: string,
  ): Promise<Result<void>> {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid entity_type: ${entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
        },
      }
    }

    const noteResult = await this.elm.get('user_notes', noteId)
    if (!noteResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Note ${noteId} not found` } }
    }

    // Historical semantics: the old NoteRepo.addReference did a raw
    // INSERT with no dedup check, so duplicate calls would throw on
    // PK collision. The ELM's composite-PK uniqueness check (added in
    // Phase 1.2.1) returns CONFLICT on duplicate, which matches the
    // implicit contract.
    const createResult = await this.elm.create('note_references', {
      note_id: noteId,
      entity_type: entityType,
      entity_id: entityId,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async removeReference(
    noteId: string,
    entityType: string,
    entityId: string,
  ): Promise<Result<void>> {
    // Pre-check that the row exists so we can return NOT_FOUND when
    // it doesn't (the old repo returned `removed` boolean and the
    // service mapped false → NOT_FOUND).
    const existing = await this.elm.count('note_references', {
      note_id: noteId,
      entity_type: entityType,
      entity_id: entityId,
    })
    if (!existing.ok) {
      return { ok: false, error: storageErrorToForgeError(existing.error) }
    }
    if (existing.value === 0) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Reference not found' },
      }
    }

    const delResult = await this.elm.deleteWhere('note_references', {
      note_id: noteId,
      entity_type: entityType,
      entity_id: entityId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async getNotesForEntity(
    entityType: string,
    entityId: string,
  ): Promise<Result<UserNote[]>> {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid entity_type: ${entityType}`,
        },
      }
    }

    // Walk the junction to find note ids, then fetch each note.
    const refsResult = await this.elm.list('note_references', {
      where: { entity_type: entityType, entity_id: entityId },
      limit: 10000,
    })
    if (!refsResult.ok) {
      return { ok: false, error: storageErrorToForgeError(refsResult.error) }
    }

    const notes: UserNote[] = []
    for (const row of refsResult.value.rows) {
      const ref = row as unknown as NoteReference
      const noteResult = await this.elm.get('user_notes', ref.note_id)
      if (noteResult.ok) {
        notes.push(noteResult.value as unknown as UserNote)
      }
    }

    // Match historical ordering: updated_at DESC
    notes.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
    return { ok: true, data: notes }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchNote(id: string): Promise<Result<UserNote>> {
    const result = await this.elm.get('user_notes', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as UserNote }
  }
}
