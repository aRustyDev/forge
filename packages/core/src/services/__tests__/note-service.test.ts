/**
 * Tests for NoteService — CRUD with validation and reference linking.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { NoteService } from '../note-service'
import { createTestDb, seedSource } from '../../db/__tests__/helpers'

describe('NoteService', () => {
  let db: Database
  let service: NoteService

  beforeEach(() => {
    db = createTestDb()
    service = new NoteService(db)
  })
  afterEach(() => db.close())

  // -- create -----------------------------------------------------------

  test('create with valid content succeeds', () => {
    const result = service.create({ content: 'Remember to mention K8s' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Remember to mention K8s')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with title and content succeeds', () => {
    const result = service.create({ title: 'Interview Prep', content: 'Study system design' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe('Interview Prep')
    expect(result.data.content).toBe('Study system design')
  })

  test('create with empty content fails validation', () => {
    const result = service.create({ content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Content')
  })

  test('create with whitespace-only content fails validation', () => {
    const result = service.create({ content: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  // -- get --------------------------------------------------------------

  test('get returns note with references', () => {
    const created = service.create({ title: 'Prep', content: 'Notes here' })
    if (!created.ok) return
    const result = service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Notes here')
    expect(result.data.references).toEqual([])
  })

  test('get returns NOT_FOUND for missing note', () => {
    const result = service.get('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- list -------------------------------------------------------------

  test('list returns all notes with pagination', () => {
    service.create({ content: 'Note A' })
    service.create({ content: 'Note B' })
    const result = service.list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.pagination.total).toBe(2)
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.limit).toBe(50)
  })

  test('list searches by content', () => {
    service.create({ content: 'Kubernetes deployment' })
    service.create({ content: 'Python scripting' })
    const result = service.list('kubernetes')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].content).toBe('Kubernetes deployment')
  })

  test('list searches by title', () => {
    service.create({ title: 'K8s Notes', content: 'Some content' })
    service.create({ title: 'Python Notes', content: 'Other content' })
    const result = service.list('K8s')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('K8s Notes')
  })

  // -- update -----------------------------------------------------------

  test('update with valid input succeeds', () => {
    const created = service.create({ content: 'Old content' })
    if (!created.ok) return
    const result = service.update(created.data.id, { content: 'New content' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('New content')
  })

  test('update with empty content fails validation', () => {
    const created = service.create({ content: 'Test' })
    if (!created.ok) return
    const result = service.update(created.data.id, { content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update returns NOT_FOUND for missing note', () => {
    const result = service.update('nonexistent-id', { content: 'Whatever' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- delete -----------------------------------------------------------

  test('delete removes note', () => {
    const created = service.create({ content: 'To Delete' })
    if (!created.ok) return
    const result = service.delete(created.data.id)
    expect(result.ok).toBe(true)

    const check = service.get(created.data.id)
    expect(check.ok).toBe(false)
  })

  test('delete returns NOT_FOUND for missing note', () => {
    const result = service.delete('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- addReference -----------------------------------------------------

  test('addReference links note to entity', () => {
    const created = service.create({ content: 'Related to source' })
    if (!created.ok) return
    const sourceId = seedSource(db)

    const result = service.addReference(created.data.id, 'source', sourceId)
    expect(result.ok).toBe(true)

    const fetched = service.get(created.data.id)
    if (!fetched.ok) return
    expect(fetched.data.references).toHaveLength(1)
    expect(fetched.data.references[0].entity_type).toBe('source')
    expect(fetched.data.references[0].entity_id).toBe(sourceId)
  })

  test('addReference with invalid entity_type fails validation', () => {
    const created = service.create({ content: 'test' })
    if (!created.ok) return
    const result = service.addReference(created.data.id, 'invalid_type', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('invalid_type')
  })

  test('addReference returns NOT_FOUND when note does not exist', () => {
    const result = service.addReference('nonexistent-id', 'source', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- removeReference --------------------------------------------------

  test('removeReference unlinks note from entity', () => {
    const created = service.create({ content: 'test' })
    if (!created.ok) return
    const sourceId = seedSource(db)
    service.addReference(created.data.id, 'source', sourceId)

    const result = service.removeReference(created.data.id, 'source', sourceId)
    expect(result.ok).toBe(true)

    const fetched = service.get(created.data.id)
    if (!fetched.ok) return
    expect(fetched.data.references).toHaveLength(0)
  })

  test('removeReference returns NOT_FOUND when reference does not exist', () => {
    const created = service.create({ content: 'test' })
    if (!created.ok) return
    const result = service.removeReference(created.data.id, 'source', 'nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- getNotesForEntity ------------------------------------------------

  test('getNotesForEntity finds notes linked to a specific entity', () => {
    const sourceId = seedSource(db)
    const n1 = service.create({ content: 'Note about source' })
    const n2 = service.create({ content: 'Unrelated note' })
    if (!n1.ok || !n2.ok) return
    service.addReference(n1.data.id, 'source', sourceId)

    const result = service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(n1.data.id)
  })

  test('getNotesForEntity with invalid entity_type fails validation', () => {
    const result = service.getNotesForEntity('invalid_type', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('getNotesForEntity returns empty array when no notes linked', () => {
    const sourceId = seedSource(db)
    const result = service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })
})
