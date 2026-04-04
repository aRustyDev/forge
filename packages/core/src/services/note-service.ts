/**
 * NoteService — business logic for user notes and reference linking.
 *
 * Validates input before delegating to the NoteRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type { UserNote, Result, PaginatedResult } from '../types'
import * as NoteRepo from '../db/repositories/note-repository'
import type { UserNoteWithReferences } from '../db/repositories/note-repository'

const VALID_ENTITY_TYPES = ['source', 'bullet', 'perspective', 'resume_entry', 'resume', 'skill', 'organization']

export class NoteService {
  constructor(private db: Database) {}

  create(input: { title?: string; content: string }): Result<UserNote> {
    if (!input.content || input.content.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' } }
    }
    const note = NoteRepo.create(this.db, input)
    return { ok: true, data: note }
  }

  get(id: string): Result<UserNoteWithReferences> {
    const note = NoteRepo.getWithReferences(this.db, id)
    if (!note) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Note ${id} not found` } }
    }
    return { ok: true, data: note }
  }

  list(search?: string, offset?: number, limit?: number): PaginatedResult<UserNote> {
    const result = NoteRepo.list(this.db, search, offset, limit)
    return { ok: true, data: result.data, pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 } }
  }

  update(id: string, input: { title?: string; content?: string }): Result<UserNote> {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Content must not be empty' } }
    }
    const note = NoteRepo.update(this.db, id, input)
    if (!note) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Note ${id} not found` } }
    }
    return { ok: true, data: note }
  }

  delete(id: string): Result<void> {
    const deleted = NoteRepo.del(this.db, id)
    if (!deleted) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Note ${id} not found` } }
    }
    return { ok: true, data: undefined }
  }

  addReference(noteId: string, entityType: string, entityId: string): Result<void> {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid entity_type: ${entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` } }
    }
    const note = NoteRepo.get(this.db, noteId)
    if (!note) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Note ${noteId} not found` } }
    }
    NoteRepo.addReference(this.db, noteId, entityType, entityId)
    return { ok: true, data: undefined }
  }

  removeReference(noteId: string, entityType: string, entityId: string): Result<void> {
    const removed = NoteRepo.removeReference(this.db, noteId, entityType, entityId)
    if (!removed) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Reference not found' } }
    }
    return { ok: true, data: undefined }
  }

  getNotesForEntity(entityType: string, entityId: string): Result<UserNote[]> {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid entity_type: ${entityType}` } }
    }
    const notes = NoteRepo.getByEntity(this.db, entityType, entityId)
    return { ok: true, data: notes }
  }
}
