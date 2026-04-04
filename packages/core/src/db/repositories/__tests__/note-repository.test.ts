/**
 * Tests for NoteRepository — CRUD operations for user_notes and note_references tables.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSource } from '../../__tests__/helpers'
import * as NoteRepo from '../note-repository'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let db: Database

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

// ===========================================================================
// NoteRepository
// ===========================================================================

describe('NoteRepository', () => {
  // ── Basic CRUD ──────────────────────────────────────────────────────

  test('create returns a note with generated id', () => {
    const note = NoteRepo.create(db, { content: 'My first note' })

    expect(note.id).toHaveLength(36)
    expect(note.content).toBe('My first note')
    expect(note.title).toBeNull()
    expect(note.created_at).toBeTruthy()
    expect(note.updated_at).toBeTruthy()
  })

  test('create with title', () => {
    const note = NoteRepo.create(db, {
      title: 'Important',
      content: 'Do not forget this',
    })

    expect(note.title).toBe('Important')
    expect(note.content).toBe('Do not forget this')
  })

  test('get returns the note by id', () => {
    const note = NoteRepo.create(db, { content: 'Test note' })
    const fetched = NoteRepo.get(db, note.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(note.id)
    expect(fetched!.content).toBe('Test note')
  })

  test('get returns null for nonexistent id', () => {
    expect(NoteRepo.get(db, crypto.randomUUID())).toBeNull()
  })

  test('update modifies specified fields', () => {
    const note = NoteRepo.create(db, { content: 'Original' })
    const updated = NoteRepo.update(db, note.id, {
      title: 'Updated Title',
      content: 'Updated content',
    })

    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('Updated Title')
    expect(updated!.content).toBe('Updated content')
  })

  test('update returns null for nonexistent id', () => {
    expect(NoteRepo.update(db, crypto.randomUUID(), { content: 'X' })).toBeNull()
  })

  test('del removes the note', () => {
    const note = NoteRepo.create(db, { content: 'Temp' })
    const deleted = NoteRepo.del(db, note.id)

    expect(deleted).toBe(true)
    expect(NoteRepo.get(db, note.id)).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    expect(NoteRepo.del(db, crypto.randomUUID())).toBe(false)
  })

  // ── List / Search ──────────────────────────────────────────────────

  test('list returns all notes ordered by updated_at desc', () => {
    NoteRepo.create(db, { content: 'First' })
    NoteRepo.create(db, { content: 'Second' })
    NoteRepo.create(db, { content: 'Third' })

    const result = NoteRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(3)
  })

  test('list searches by content', () => {
    NoteRepo.create(db, { content: 'TypeScript patterns' })
    NoteRepo.create(db, { content: 'Rust ownership' })
    NoteRepo.create(db, { content: 'Go concurrency' })

    const result = NoteRepo.list(db, 'Rust')
    expect(result.total).toBe(1)
    expect(result.data[0].content).toBe('Rust ownership')
  })

  test('list searches by title', () => {
    NoteRepo.create(db, { title: 'Interview prep', content: 'Study algorithms' })
    NoteRepo.create(db, { title: 'Resume notes', content: 'Update experience section' })

    const result = NoteRepo.list(db, 'Interview')
    expect(result.total).toBe(1)
    expect(result.data[0].title).toBe('Interview prep')
  })

  test('list supports pagination', () => {
    NoteRepo.create(db, { content: 'Note A' })
    NoteRepo.create(db, { content: 'Note B' })
    NoteRepo.create(db, { content: 'Note C' })

    const page1 = NoteRepo.list(db, undefined, 0, 2)
    expect(page1.data).toHaveLength(2)
    expect(page1.total).toBe(3)

    const page2 = NoteRepo.list(db, undefined, 2, 2)
    expect(page2.data).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  // ── References ─────────────────────────────────────────────────────

  test('addReference links a note to an entity', () => {
    const note = NoteRepo.create(db, { content: 'About this source' })
    const sourceId = seedSource(db)

    NoteRepo.addReference(db, note.id, 'source', sourceId)

    const withRefs = NoteRepo.getWithReferences(db, note.id)
    expect(withRefs).not.toBeNull()
    expect(withRefs!.references).toHaveLength(1)
    expect(withRefs!.references[0].entity_type).toBe('source')
    expect(withRefs!.references[0].entity_id).toBe(sourceId)
  })

  test('removeReference unlinks a note from an entity', () => {
    const note = NoteRepo.create(db, { content: 'Temp link' })
    const sourceId = seedSource(db)

    NoteRepo.addReference(db, note.id, 'source', sourceId)
    const removed = NoteRepo.removeReference(db, note.id, 'source', sourceId)

    expect(removed).toBe(true)

    const withRefs = NoteRepo.getWithReferences(db, note.id)
    expect(withRefs!.references).toHaveLength(0)
  })

  test('removeReference returns false when reference does not exist', () => {
    const note = NoteRepo.create(db, { content: 'No refs' })
    const removed = NoteRepo.removeReference(db, note.id, 'source', crypto.randomUUID())
    expect(removed).toBe(false)
  })

  test('getByEntity returns notes linked to a specific entity', () => {
    const sourceId = seedSource(db)

    const note1 = NoteRepo.create(db, { content: 'Note about source' })
    const note2 = NoteRepo.create(db, { content: 'Another note about source' })
    const note3 = NoteRepo.create(db, { content: 'Unrelated note' })

    NoteRepo.addReference(db, note1.id, 'source', sourceId)
    NoteRepo.addReference(db, note2.id, 'source', sourceId)
    // note3 not linked

    const notes = NoteRepo.getByEntity(db, 'source', sourceId)
    expect(notes).toHaveLength(2)
    const ids = notes.map(n => n.id)
    expect(ids).toContain(note1.id)
    expect(ids).toContain(note2.id)
    expect(ids).not.toContain(note3.id)
  })

  test('getByEntity returns empty array when no notes are linked', () => {
    const notes = NoteRepo.getByEntity(db, 'source', crypto.randomUUID())
    expect(notes).toHaveLength(0)
  })

  test('getWithReferences returns null for nonexistent note', () => {
    expect(NoteRepo.getWithReferences(db, crypto.randomUUID())).toBeNull()
  })

  test('getWithReferences returns empty references array when note has none', () => {
    const note = NoteRepo.create(db, { content: 'Solo note' })
    const withRefs = NoteRepo.getWithReferences(db, note.id)

    expect(withRefs).not.toBeNull()
    expect(withRefs!.references).toHaveLength(0)
  })

  test('deleting a note cascades to its references', () => {
    const note = NoteRepo.create(db, { content: 'Will be deleted' })
    const sourceId = seedSource(db)

    NoteRepo.addReference(db, note.id, 'source', sourceId)
    NoteRepo.del(db, note.id)

    // Reference should be gone (CASCADE)
    const refCount = db
      .query('SELECT COUNT(*) AS cnt FROM note_references WHERE note_id = ?')
      .get(note.id) as { cnt: number }
    expect(refCount.cnt).toBe(0)
  })
})
