/**
 * Tests for ResumeEntryRepository — CRUD operations for the resume_entries table.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import {
  createTestDb,
  seedResume,
  seedSource,
  seedBullet,
  seedPerspective,
  seedResumeSection,
} from '../../__tests__/helpers'
import * as EntryRepo from '../resume-entry-repository'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a full chain: source -> bullet -> perspective, return IDs. */
function seedChain(opts?: { perspectiveContent?: string }) {
  const sourceId = seedSource(db)
  const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }])
  const perspectiveId = seedPerspective(db, bulletId, {
    content: opts?.perspectiveContent ?? 'Led cloud platform migration enabling ML-based log analysis pipeline',
  })
  return { sourceId, bulletId, perspectiveId }
}

// ===========================================================================
// ResumeEntryRepository
// ===========================================================================

describe('ResumeEntryRepository', () => {
  // ── Basic CRUD ──────────────────────────────────────────────────────

  test('create returns an entry with generated id (reference mode)', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain()

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      position: 0,
    })

    expect(entry.id).toHaveLength(36)
    expect(entry.resume_id).toBe(resumeId)
    expect(entry.section_id).toBe(sectionId)
    expect(entry.perspective_id).toBe(perspectiveId)
    expect(entry.content).toBeNull()
    expect(entry.perspective_content_snapshot).toBeNull()
    expect(entry.position).toBe(0)
    expect(entry.created_at).toBeTruthy()
    expect(entry.updated_at).toBeTruthy()
  })

  test('create with content captures perspective_content_snapshot (clone mode)', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain({
      perspectiveContent: 'Original perspective content',
    })

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      position: 1,
      content: 'Custom override text',
    })

    expect(entry.content).toBe('Custom override text')
    expect(entry.perspective_content_snapshot).toBe('Original perspective content')
  })

  test('create freeform entry with no perspective_id', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Summary', 'freeform')

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      content: 'My professional summary',
      position: 0,
    })

    expect(entry.id).toHaveLength(36)
    expect(entry.perspective_id).toBeNull()
    expect(entry.content).toBe('My professional summary')
  })

  test('get returns the entry by id', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
    const { perspectiveId } = seedChain()

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
    })

    const fetched = EntryRepo.get(db, entry.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(entry.id)
    expect(fetched!.section_id).toBe(sectionId)
  })

  test('get returns null for nonexistent id', () => {
    expect(EntryRepo.get(db, crypto.randomUUID())).toBeNull()
  })

  test('del removes the entry', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain()

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
    })

    const deleted = EntryRepo.del(db, entry.id)
    expect(deleted).toBe(true)
    expect(EntryRepo.get(db, entry.id)).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    expect(EntryRepo.del(db, crypto.randomUUID())).toBe(false)
  })

  // ── Update with content snapshot logic ─────────────────────────────

  test('update content from null to non-null captures snapshot (clone mode)', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain({
      perspectiveContent: 'Perspective v1',
    })

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
    })

    // Starts as reference mode
    expect(entry.content).toBeNull()
    expect(entry.perspective_content_snapshot).toBeNull()

    // Switch to clone mode
    const updated = EntryRepo.update(db, entry.id, {
      content: 'My custom wording',
    })

    expect(updated).not.toBeNull()
    expect(updated!.content).toBe('My custom wording')
    expect(updated!.perspective_content_snapshot).toBe('Perspective v1')
  })

  test('update content from non-null to null clears snapshot (reference reset)', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain({
      perspectiveContent: 'Perspective v1',
    })

    // Create in clone mode
    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      content: 'Custom text',
    })

    expect(entry.content).toBe('Custom text')
    expect(entry.perspective_content_snapshot).toBe('Perspective v1')

    // Reset to reference mode
    const updated = EntryRepo.update(db, entry.id, { content: null })

    expect(updated).not.toBeNull()
    expect(updated!.content).toBeNull()
    expect(updated!.perspective_content_snapshot).toBeNull()
  })

  test('update section_id and position without touching content', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const projectsId = seedResumeSection(db, resumeId, 'Projects', 'projects', 1)
    const { perspectiveId } = seedChain()

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      position: 0,
    })

    const updated = EntryRepo.update(db, entry.id, {
      section_id: projectsId,
      position: 5,
    })

    expect(updated).not.toBeNull()
    expect(updated!.section_id).toBe(projectsId)
    expect(updated!.position).toBe(5)
    // content unchanged
    expect(updated!.content).toBeNull()
  })

  test('update returns null for nonexistent id', () => {
    expect(EntryRepo.update(db, crypto.randomUUID(), { section_id: 'x' })).toBeNull()
  })

  // ── listByResume ───────────────────────────────────────────────────

  test('listByResume returns entries ordered by section position then entry position', () => {
    const resumeId = seedResume(db)
    const expSec = seedResumeSection(db, resumeId, 'Experience', 'experience', 1)
    const skillsSec = seedResumeSection(db, resumeId, 'Skills', 'skills', 0)
    const { perspectiveId: p1 } = seedChain()
    const { perspectiveId: p2 } = seedChain()
    const { perspectiveId: p3 } = seedChain()

    EntryRepo.create(db, { resume_id: resumeId, section_id: expSec, perspective_id: p1, position: 1 })
    EntryRepo.create(db, { resume_id: resumeId, section_id: skillsSec, perspective_id: p2, position: 0 })
    EntryRepo.create(db, { resume_id: resumeId, section_id: expSec, perspective_id: p3, position: 0 })

    const entries = EntryRepo.listByResume(db, resumeId)
    expect(entries).toHaveLength(3)

    // Skills section (position 0) first, then experience (position 1)
    expect(entries[0].section_id).toBe(skillsSec)
    expect(entries[1].section_id).toBe(expSec)
    expect(entries[1].position).toBe(0)
    expect(entries[2].section_id).toBe(expSec)
    expect(entries[2].position).toBe(1)
  })

  test('listByResume returns empty array for resume with no entries', () => {
    const resumeId = seedResume(db)
    const entries = EntryRepo.listByResume(db, resumeId)
    expect(entries).toHaveLength(0)
  })

  // ── resolveContent ─────────────────────────────────────────────────

  test('resolveContent returns perspective content in reference mode', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain({
      perspectiveContent: 'Live perspective content',
    })

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      // No content — reference mode
    })

    const resolved = EntryRepo.resolveContent(db, entry.id)
    expect(resolved).toBe('Live perspective content')
  })

  test('resolveContent returns entry content in clone mode', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const { perspectiveId } = seedChain({
      perspectiveContent: 'Live perspective content',
    })

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      perspective_id: perspectiveId,
      content: 'My custom override',
    })

    const resolved = EntryRepo.resolveContent(db, entry.id)
    expect(resolved).toBe('My custom override')
  })

  test('resolveContent returns content for freeform entry (null perspective_id)', () => {
    const resumeId = seedResume(db)
    const sectionId = seedResumeSection(db, resumeId, 'Summary', 'freeform')

    const entry = EntryRepo.create(db, {
      resume_id: resumeId,
      section_id: sectionId,
      content: 'My freeform content',
    })

    const resolved = EntryRepo.resolveContent(db, entry.id)
    expect(resolved).toBe('My freeform content')
  })

  test('resolveContent returns null for nonexistent entry', () => {
    const resolved = EntryRepo.resolveContent(db, crypto.randomUUID())
    expect(resolved).toBeNull()
  })
})
