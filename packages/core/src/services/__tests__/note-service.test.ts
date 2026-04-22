/**
 * Tests for NoteService — CRUD with validation and reference linking.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { NoteService } from '../note-service'
import { createTestDb, seedSource } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('NoteService', () => {
  let db: Database
  let service: NoteService

  beforeEach(() => {
    db = createTestDb()
    service = new NoteService(buildDefaultElm(db))
  })
  afterEach(() => db.close())

  // -- create -----------------------------------------------------------

  test('create with valid content succeeds', async () => {
    const result = await service.create({ content: 'Remember to mention K8s' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Remember to mention K8s')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with title and content succeeds', async () => {
    const result = await service.create({ title: 'Interview Prep', content: 'Study system design' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe('Interview Prep')
    expect(result.data.content).toBe('Study system design')
  })

  test('create with empty content fails validation', async () => {
    const result = await service.create({ content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Content')
  })

  test('create with whitespace-only content fails validation', async () => {
    const result = await service.create({ content: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  // -- get --------------------------------------------------------------

  test('get returns note with references', async () => {
    const created = await service.create({ title: 'Prep', content: 'Notes here' })
    if (!created.ok) return
    const result = await service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Notes here')
    expect(result.data.references).toEqual([])
  })

  test('get returns NOT_FOUND for missing note', async () => {
    const result = await service.get('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- list -------------------------------------------------------------

  test('list returns all notes with pagination', async () => {
    await service.create({ content: 'Note A' })
    await service.create({ content: 'Note B' })
    const result = await service.list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.pagination.total).toBe(2)
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.limit).toBe(50)
  })

  test('list searches by content', async () => {
    await service.create({ content: 'Kubernetes deployment' })
    await service.create({ content: 'Python scripting' })
    const result = await service.list('kubernetes')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].content).toBe('Kubernetes deployment')
  })

  test('list searches by title', async () => {
    await service.create({ title: 'K8s Notes', content: 'Some content' })
    await service.create({ title: 'Python Notes', content: 'Other content' })
    const result = await service.list('K8s')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('K8s Notes')
  })

  // -- update -----------------------------------------------------------

  test('update with valid input succeeds', async () => {
    const created = await service.create({ content: 'Old content' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { content: 'New content' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('New content')
  })

  test('update with empty content fails validation', async () => {
    const created = await service.create({ content: 'Test' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update returns NOT_FOUND for missing note', async () => {
    const result = await service.update('nonexistent-id', { content: 'Whatever' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- delete -----------------------------------------------------------

  test('delete removes note', async () => {
    const created = await service.create({ content: 'To Delete' })
    if (!created.ok) return
    const result = await service.delete(created.data.id)
    expect(result.ok).toBe(true)

    const check = await service.get(created.data.id)
    expect(check.ok).toBe(false)
  })

  test('delete returns NOT_FOUND for missing note', async () => {
    const result = await service.delete('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- addReference -----------------------------------------------------

  test('addReference links note to entity', async () => {
    const created = await service.create({ content: 'Related to source' })
    if (!created.ok) return
    const sourceId = seedSource(db)

    const result = await service.addReference(created.data.id, 'source', sourceId)
    expect(result.ok).toBe(true)

    const fetched = await service.get(created.data.id)
    if (!fetched.ok) return
    expect(fetched.data.references).toHaveLength(1)
    expect(fetched.data.references[0].entity_type).toBe('source')
    expect(fetched.data.references[0].entity_id).toBe(sourceId)
  })

  test('addReference with invalid entity_type fails validation', async () => {
    const created = await service.create({ content: 'test' })
    if (!created.ok) return
    const result = await service.addReference(created.data.id, 'invalid_type', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('invalid_type')
  })

  test('addReference returns NOT_FOUND when note does not exist', async () => {
    const result = await service.addReference('nonexistent-id', 'source', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- removeReference --------------------------------------------------

  test('removeReference unlinks note from entity', async () => {
    const created = await service.create({ content: 'test' })
    if (!created.ok) return
    const sourceId = seedSource(db)
    await service.addReference(created.data.id, 'source', sourceId)

    const result = await service.removeReference(created.data.id, 'source', sourceId)
    expect(result.ok).toBe(true)

    const fetched = await service.get(created.data.id)
    if (!fetched.ok) return
    expect(fetched.data.references).toHaveLength(0)
  })

  test('removeReference returns NOT_FOUND when reference does not exist', async () => {
    const created = await service.create({ content: 'test' })
    if (!created.ok) return
    const result = await service.removeReference(created.data.id, 'source', 'nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- getNotesForEntity ------------------------------------------------

  test('getNotesForEntity finds notes linked to a specific entity', async () => {
    const sourceId = seedSource(db)
    const n1 = await service.create({ content: 'Note about source' })
    const n2 = await service.create({ content: 'Unrelated note' })
    if (!n1.ok || !n2.ok) return
    await service.addReference(n1.data.id, 'source', sourceId)

    const result = await service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(n1.data.id)
  })

  test('getNotesForEntity with invalid entity_type fails validation', async () => {
    const result = await service.getNotesForEntity('invalid_type', 'some-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('getNotesForEntity returns empty array when no notes linked', async () => {
    const sourceId = seedSource(db)
    const result = await service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })

  // -- expanded entity types (sep.3) -------------------------------------

  test('addReference accepts job_description entity type', async () => {
    const note = await service.create({ content: 'JD note' })
    if (!note.ok) return
    const result = await service.addReference(note.data.id, 'job_description', 'fake-jd-id')
    expect(result.ok).toBe(true)
  })

  test('addReference accepts contact entity type', async () => {
    const note = await service.create({ content: 'Contact note' })
    if (!note.ok) return
    const result = await service.addReference(note.data.id, 'contact', 'fake-contact-id')
    expect(result.ok).toBe(true)
  })

  test('addReference accepts credential entity type', async () => {
    const note = await service.create({ content: 'Credential note' })
    if (!note.ok) return
    const result = await service.addReference(note.data.id, 'credential', 'fake-cred-id')
    expect(result.ok).toBe(true)
  })

  test('addReference accepts certification entity type', async () => {
    const note = await service.create({ content: 'Cert note' })
    if (!note.ok) return
    const result = await service.addReference(note.data.id, 'certification', 'fake-cert-id')
    expect(result.ok).toBe(true)
  })

  test('getNotesForEntity works with job_description type', async () => {
    const note = await service.create({ content: 'JD note' })
    if (!note.ok) return
    await service.addReference(note.data.id, 'job_description', 'jd-123')
    const result = await service.getNotesForEntity('job_description', 'jd-123')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].content).toBe('JD note')
  })

  // -- multiple notes per entity -----------------------------------------

  test('entity can have multiple linked notes', async () => {
    const sourceId = seedSource(db)
    const n1 = await service.create({ content: 'First note' })
    const n2 = await service.create({ content: 'Second note' })
    const n3 = await service.create({ content: 'Third note' })
    if (!n1.ok || !n2.ok || !n3.ok) return
    await service.addReference(n1.data.id, 'source', sourceId)
    await service.addReference(n2.data.id, 'source', sourceId)
    await service.addReference(n3.data.id, 'source', sourceId)

    const result = await service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(3)
  })

  test('note can be linked to multiple entities', async () => {
    const s1 = seedSource(db)
    const s2 = seedSource(db)
    const note = await service.create({ content: 'Shared note' })
    if (!note.ok) return
    await service.addReference(note.data.id, 'source', s1)
    await service.addReference(note.data.id, 'source', s2)

    const r1 = await service.getNotesForEntity('source', s1)
    const r2 = await service.getNotesForEntity('source', s2)
    expect(r1.ok && r1.data).toHaveLength(1)
    expect(r2.ok && r2.data).toHaveLength(1)
  })

  test('deleting note cascades to note_references', async () => {
    const sourceId = seedSource(db)
    const note = await service.create({ content: 'Will be deleted' })
    if (!note.ok) return
    await service.addReference(note.data.id, 'source', sourceId)

    await service.delete(note.data.id)

    const result = await service.getNotesForEntity('source', sourceId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })
})
