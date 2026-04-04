import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ResumeRepository } from '../resume-repository'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection } from '../../__tests__/helpers'

describe('ResumeRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ── CRUD lifecycle ──────────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    test('create returns a resume with generated UUID', () => {
      const resume = ResumeRepository.create(db, {
        name: 'My Resume',
        target_role: 'AI Engineer',
        target_employer: 'Anthropic',
        archetype: 'agentic-ai',
      })

      expect(resume.id).toHaveLength(36)
      expect(resume.name).toBe('My Resume')
      expect(resume.target_role).toBe('AI Engineer')
      expect(resume.target_employer).toBe('Anthropic')
      expect(resume.archetype).toBe('agentic-ai')
      expect(resume.status).toBe('draft')
      expect(resume.created_at).toBeTruthy()
      expect(resume.updated_at).toBeTruthy()
    })

    test('get returns the created resume', () => {
      const created = ResumeRepository.create(db, {
        name: 'Test',
        target_role: 'SE',
        target_employer: 'Google',
        archetype: 'infra',
      })

      const fetched = ResumeRepository.get(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.name).toBe('Test')
    })

    test('get returns null for nonexistent ID', () => {
      const result = ResumeRepository.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('update modifies fields', () => {
      const resume = ResumeRepository.create(db, {
        name: 'Original',
        target_role: 'SE',
        target_employer: 'Google',
        archetype: 'infra',
      })

      const updated = ResumeRepository.update(db, resume.id, {
        name: 'Updated Resume',
        status: 'final',
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Updated Resume')
      expect(updated!.status).toBe('final')
    })

    test('update returns null for nonexistent ID', () => {
      const result = ResumeRepository.update(db, crypto.randomUUID(), {
        name: 'nope',
      })
      expect(result).toBeNull()
    })

    test('delete removes the resume', () => {
      const resume = ResumeRepository.create(db, {
        name: 'Delete Me',
        target_role: 'SE',
        target_employer: 'Nowhere',
        archetype: 'test',
      })

      const deleted = ResumeRepository.delete(db, resume.id)
      expect(deleted).toBe(true)
      expect(ResumeRepository.get(db, resume.id)).toBeNull()
    })

    test('delete returns false for nonexistent ID', () => {
      const result = ResumeRepository.delete(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    test('returns all resumes with pagination', () => {
      for (let i = 0; i < 3; i++) {
        ResumeRepository.create(db, {
          name: `Resume ${i}`,
          target_role: 'SE',
          target_employer: 'Test',
          archetype: 'test',
        })
      }

      const result = ResumeRepository.list(db, 0, 2)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)

      const page2 = ResumeRepository.list(db, 2, 2)
      expect(page2.data).toHaveLength(1)
    })
  })

  // ── entry management ───────────────────────────────────────────────

  describe('entry management', () => {
    let resumeId: string
    let perspId: string
    let sectionId: string

    beforeEach(() => {
      resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      perspId = seedPerspective(db, bulletId)
      sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    })

    test('addEntry creates a resume entry in reference mode (content=NULL)', () => {
      const entry = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
        position: 0,
      })

      expect(entry.id).toHaveLength(36)
      expect(entry.resume_id).toBe(resumeId)
      expect(entry.perspective_id).toBe(perspId)
      expect(entry.content).toBeNull()
      expect(entry.section_id).toBe(sectionId)
      expect(entry.position).toBe(0)
    })

    test('addEntry with content creates entry in clone mode', () => {
      const entry = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
        position: 0,
        content: 'Custom content for this resume',
      })

      expect(entry.content).toBe('Custom content for this resume')
    })

    test('removeEntry removes an entry', () => {
      const entry = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
        position: 0,
      })

      const removed = ResumeRepository.removeEntry(db, resumeId, entry.id)
      expect(removed).toBe(true)
    })

    test('removeEntry returns false for nonexistent entry', () => {
      const result = ResumeRepository.removeEntry(db, resumeId, crypto.randomUUID())
      expect(result).toBe(false)
    })

    test('reorderEntries updates section_id and position', () => {
      const entry1 = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
        position: 0,
      })

      const srcId2 = seedSource(db, { title: 'Source 2' })
      const bulletId2 = seedBullet(db, [{ id: srcId2 }])
      const perspId2 = seedPerspective(db, bulletId2)
      const skillsSectionId = seedResumeSection(db, resumeId, 'Skills', 'skills', 1)
      const entry2 = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId2,
        section_id: sectionId,
        position: 1,
      })

      // Move entry1 to skills section, entry2 stays in experience
      ResumeRepository.reorderEntries(db, resumeId, [
        { id: entry1.id, section_id: skillsSectionId, position: 0 },
        { id: entry2.id, section_id: sectionId, position: 0 },
      ])

      const result = ResumeRepository.getWithEntries(db, resumeId)!
      const skillsSection = result.sections.find(s => s.entry_type === 'skills')
      const expSection = result.sections.find(s => s.entry_type === 'experience')
      expect(skillsSection).toBeDefined()
      expect(expSection).toBeDefined()
      expect(skillsSection!.entries).toHaveLength(1)
      expect(expSection!.entries).toHaveLength(1)
    })
  })

  // ── updateEntry ────────────────────────────────────────────────────

  describe('updateEntry', () => {
    test('setting content string enters clone mode and captures snapshot', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId })

      const updated = ResumeRepository.updateEntry(db, entryId, {
        content: 'Customized content for this resume',
      })

      expect(updated).not.toBeNull()
      expect(updated!.content).toBe('Customized content for this resume')
      expect(updated!.perspective_content_snapshot).not.toBeNull()
    })

    test('setting content=null resets to reference mode', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId })

      // First clone
      ResumeRepository.updateEntry(db, entryId, { content: 'Cloned' })
      // Then reset
      const reset = ResumeRepository.updateEntry(db, entryId, { content: null })

      expect(reset!.content).toBeNull()
      expect(reset!.perspective_content_snapshot).toBeNull()
    })

    test('updates section_id and position', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const skillsSecId = seedResumeSection(db, resumeId, 'Skills', 'skills', 1)
      const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

      const updated = ResumeRepository.updateEntry(db, entryId, {
        section_id: skillsSecId,
        position: 3,
      })

      expect(updated!.section_id).toBe(skillsSecId)
      expect(updated!.position).toBe(3)
    })

    test('updates notes', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId })

      const updated = ResumeRepository.updateEntry(db, entryId, {
        notes: 'Entry note',
      })

      expect(updated!.notes).toBe('Entry note')
    })

    test('empty input returns existing entry', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId })

      const result = ResumeRepository.updateEntry(db, entryId, {})
      expect(result).not.toBeNull()
    })

    test('returns null for nonexistent entry', () => {
      const result = ResumeRepository.updateEntry(db, crypto.randomUUID(), {
        content: 'nope',
      })
      expect(result).toBeNull()
    })
  })

  // ── getWithEntries ──────────────────────────────────────────────────

  describe('getWithEntries', () => {
    test('returns entries grouped by section', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const p1 = seedPerspective(db, bulletId)
      const p2 = seedPerspective(db, bulletId, { domain: 'security' })
      const expSec = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
      const skillsSec = seedResumeSection(db, resumeId, 'Skills', 'skills', 1)
      seedResumeEntry(db, expSec, { perspectiveId: p1, position: 0 })
      seedResumeEntry(db, skillsSec, { perspectiveId: p2, position: 0 })

      const result = ResumeRepository.getWithEntries(db, resumeId)!
      expect(result).not.toBeNull()
      expect(result.sections).toHaveLength(2)
      const expSection = result.sections.find(s => s.entry_type === 'experience')
      const skillsSection = result.sections.find(s => s.entry_type === 'skills')
      expect(expSection).toBeDefined()
      expect(skillsSection).toBeDefined()
      expect(expSection!.entries).toHaveLength(1)
      expect(skillsSection!.entries).toHaveLength(1)
    })

    test('entries include perspective_content', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId, {
        content: 'Perspective content here',
      })
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

      const result = ResumeRepository.getWithEntries(db, resumeId)!
      const entry = result.sections[0].entries[0]
      expect(entry.perspective_content).toBe('Perspective content here')
    })

    test('entries are ordered by section position then entry position', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const p1 = seedPerspective(db, bulletId, { content: 'Third' })
      const p2 = seedPerspective(db, bulletId, { content: 'First' })
      const p3 = seedPerspective(db, bulletId, { content: 'Second' })
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      seedResumeEntry(db, secId, { perspectiveId: p1, position: 2 })
      seedResumeEntry(db, secId, { perspectiveId: p2, position: 0 })
      seedResumeEntry(db, secId, { perspectiveId: p3, position: 1 })

      const result = ResumeRepository.getWithEntries(db, resumeId)!
      const entries = result.sections[0].entries
      expect(entries[0].position).toBe(0)
      expect(entries[1].position).toBe(1)
      expect(entries[2].position).toBe(2)
    })

    test('returns null for nonexistent resume', () => {
      const result = ResumeRepository.getWithEntries(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('returns empty sections for resume with no entries', () => {
      const resumeId = seedResume(db)
      const result = ResumeRepository.getWithEntries(db, resumeId)!
      expect(result).not.toBeNull()
      expect(result.sections).toHaveLength(0)
    })

    test('freeform entries with null perspective_id are included', () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Summary', 'freeform')
      seedResumeEntry(db, secId, { content: 'My summary text' })

      const result = ResumeRepository.getWithEntries(db, resumeId)!
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].entries).toHaveLength(1)
      expect(result.sections[0].entries[0].perspective_id).toBeNull()
      expect(result.sections[0].entries[0].perspective_content).toBeNull()
    })
  })

  // ── delete cascades ────────────────────────────────────────────────

  describe('delete cascades', () => {
    test('deleting resume cascades to sections and entries', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      seedResumeEntry(db, secId, { perspectiveId: perspId })

      ResumeRepository.delete(db, resumeId)

      // Entry should be gone
      const row = db.query('SELECT COUNT(*) AS count FROM resume_entries WHERE resume_id = ?')
        .get(resumeId) as { count: number }
      expect(row.count).toBe(0)

      // Section should be gone
      const secRow = db.query('SELECT COUNT(*) AS count FROM resume_sections WHERE resume_id = ?')
        .get(resumeId) as { count: number }
      expect(secRow.count).toBe(0)
    })
  })
})
