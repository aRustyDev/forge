import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ResumeRepository } from '../resume-repository'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection, seedSkill } from '../../__tests__/helpers'

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
        status: 'approved',
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Updated Resume')
      expect(updated!.status).toBe('approved')
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

    test('update persists summary_id when provided', () => {
      const resumeId = seedResume(db)
      const summaryId = crypto.randomUUID()
      db.run(
        `INSERT INTO summaries (id, title, description, is_template)
         VALUES (?, ?, ?, ?)`,
        [summaryId, 'Test Summary', 'Test description.', 0]
      )

      const updated = ResumeRepository.update(db, resumeId, {
        summary_id: summaryId,
      })
      expect(updated).not.toBeNull()
      expect(updated!.summary_id).toBe(summaryId)
    })

    test('update sets summary_override and bumps summary_override_updated_at', () => {
      const resumeId = seedResume(db)
      const before = new Date().toISOString()

      const updated = ResumeRepository.update(db, resumeId, {
        summary_override: 'Locally edited summary text',
      })
      expect(updated).not.toBeNull()
      expect(updated!.summary_override).toBe('Locally edited summary text')
      expect(updated!.summary_override_updated_at).not.toBeNull()
      expect(updated!.summary_override_updated_at! >= before).toBe(true)
    })

    test('update with summary_override: null clears the override', () => {
      const resumeId = seedResume(db)
      ResumeRepository.update(db, resumeId, { summary_override: 'text' })
      const cleared = ResumeRepository.update(db, resumeId, {
        summary_override: null,
      })
      expect(cleared!.summary_override).toBeNull()
    })

    test('update with summary_override: undefined leaves the field alone', () => {
      const resumeId = seedResume(db)
      ResumeRepository.update(db, resumeId, { summary_override: 'preserved' })
      const unchanged = ResumeRepository.update(db, resumeId, { name: 'Updated Name' })
      expect(unchanged!.summary_override).toBe('preserved')
    })

    test('update can clear both summary_id and summary_override in one call (Unlink)', () => {
      const resumeId = seedResume(db)
      const summaryId = crypto.randomUUID()
      db.run(
        `INSERT INTO summaries (id, title, description, is_template)
         VALUES (?, ?, ?, ?)`,
        [summaryId, 'Test', 'Desc', 0]
      )
      ResumeRepository.update(db, resumeId, {
        summary_id: summaryId,
        summary_override: 'override text',
      })
      const unlinked = ResumeRepository.update(db, resumeId, {
        summary_id: null,
        summary_override: null,
      })
      expect(unlinked!.summary_id).toBeNull()
      expect(unlinked!.summary_override).toBeNull()
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

    test('addEntry defaults position to next-available when omitted', () => {
      // First entry in empty section → position 0
      const first = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
      })
      expect(first.position).toBe(0)

      // Second entry without position → position 1
      const second = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
      })
      expect(second.position).toBe(1)

      // Third entry with explicit position → respected
      const explicit = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
        position: 10,
      })
      expect(explicit.position).toBe(10)

      // Fourth entry without position → MAX+1 = 11
      const fourth = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
      })
      expect(fourth.position).toBe(11)
    })

    test('addEntry next-available position is scoped per section', () => {
      const section2 = seedResumeSection(db, resumeId, 'Skills', 'skills', 1)

      // Two entries in the Experience section
      const a = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
      })
      const b = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: sectionId,
      })
      expect(a.position).toBe(0)
      expect(b.position).toBe(1)

      // First entry in the Skills section → starts at 0, not 2
      const c = ResumeRepository.addEntry(db, resumeId, {
        perspective_id: perspId,
        section_id: section2,
      })
      expect(c.position).toBe(0)
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

  // ── getWithEntries — empty sections ──────────────────────────────────

  describe('getWithEntries — empty sections', () => {
    test('includes empty sections (sections with no entries)', () => {
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Empty Section', 'experience')

      const resume = ResumeRepository.getWithEntries(db, resumeId)
      expect(resume).not.toBeNull()
      expect(resume!.sections).toHaveLength(1)
      expect(resume!.sections[0].title).toBe('Empty Section')
      expect(resume!.sections[0].entries).toHaveLength(0)
    })

    test('returns sections as array (not Record)', () => {
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
      seedResumeSection(db, resumeId, 'Skills', 'skills', 1)

      const resume = ResumeRepository.getWithEntries(db, resumeId)
      expect(Array.isArray(resume!.sections)).toBe(true)
      expect(resume!.sections).toHaveLength(2)
      expect(resume!.sections[0].title).toBe('Experience')
      expect(resume!.sections[1].title).toBe('Skills')
    })

    test('mixes empty and populated sections correctly', () => {
      const resumeId = seedResume(db)
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      const expSec = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
      seedResumeSection(db, resumeId, 'Empty Skills', 'skills', 1)
      seedResumeEntry(db, expSec, { perspectiveId: perspId, position: 0 })

      const resume = ResumeRepository.getWithEntries(db, resumeId)!
      expect(resume.sections).toHaveLength(2)
      expect(resume.sections[0].entries).toHaveLength(1)
      expect(resume.sections[1].entries).toHaveLength(0)
    })
  })

  // ── Section CRUD ────────────────────────────────────────────────────

  describe('Section CRUD', () => {
    test('createSection returns entity with UUID', () => {
      const resumeId = seedResume(db)
      const section = ResumeRepository.createSection(db, resumeId, {
        title: 'Work History',
        entry_type: 'experience',
        position: 0,
      })
      expect(section.id).toHaveLength(36)
      expect(section.title).toBe('Work History')
      expect(section.entry_type).toBe('experience')
      expect(section.resume_id).toBe(resumeId)
      expect(section.position).toBe(0)
      expect(section.created_at).toBeTruthy()
      expect(section.updated_at).toBeTruthy()
    })

    test('getSection returns section by ID', () => {
      const resumeId = seedResume(db)
      const created = ResumeRepository.createSection(db, resumeId, {
        title: 'Skills',
        entry_type: 'skills',
      })
      const fetched = ResumeRepository.getSection(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('Skills')
    })

    test('getSection returns null for nonexistent ID', () => {
      const result = ResumeRepository.getSection(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('listSections returns ordered by position', () => {
      const resumeId = seedResume(db)
      ResumeRepository.createSection(db, resumeId, { title: 'Skills', entry_type: 'skills', position: 1 })
      ResumeRepository.createSection(db, resumeId, { title: 'Summary', entry_type: 'freeform', position: 0 })

      const sections = ResumeRepository.listSections(db, resumeId)
      expect(sections).toHaveLength(2)
      expect(sections[0].title).toBe('Summary')
      expect(sections[1].title).toBe('Skills')
    })

    test('listSections returns empty array for resume with no sections', () => {
      const resumeId = seedResume(db)
      const sections = ResumeRepository.listSections(db, resumeId)
      expect(sections).toHaveLength(0)
    })

    test('updateSection changes title, entry_type unchanged', () => {
      const resumeId = seedResume(db)
      const section = ResumeRepository.createSection(db, resumeId, { title: 'Old', entry_type: 'experience' })
      const updated = ResumeRepository.updateSection(db, section.id, { title: 'New Title' })
      expect(updated).not.toBeNull()
      expect(updated!.title).toBe('New Title')
      expect(updated!.entry_type).toBe('experience')  // immutable
    })

    test('updateSection changes position', () => {
      const resumeId = seedResume(db)
      const section = ResumeRepository.createSection(db, resumeId, { title: 'Sec', entry_type: 'experience', position: 0 })
      const updated = ResumeRepository.updateSection(db, section.id, { position: 5 })
      expect(updated!.position).toBe(5)
    })

    test('updateSection with empty input returns existing section', () => {
      const resumeId = seedResume(db)
      const section = ResumeRepository.createSection(db, resumeId, { title: 'Sec', entry_type: 'experience' })
      const result = ResumeRepository.updateSection(db, section.id, {})
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Sec')
    })

    test('updateSection returns null for nonexistent ID', () => {
      const result = ResumeRepository.updateSection(db, crypto.randomUUID(), { title: 'Nope' })
      expect(result).toBeNull()
    })

    test('deleteSection removes section', () => {
      const resumeId = seedResume(db)
      const section = ResumeRepository.createSection(db, resumeId, { title: 'Del', entry_type: 'experience' })
      const deleted = ResumeRepository.deleteSection(db, section.id)
      expect(deleted).toBe(true)
      expect(ResumeRepository.getSection(db, section.id)).toBeNull()
    })

    test('deleteSection returns false for nonexistent ID', () => {
      const result = ResumeRepository.deleteSection(db, crypto.randomUUID())
      expect(result).toBe(false)
    })

    test('deleteSection cascades to entries', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])
      const perspId = seedPerspective(db, bulletId)
      seedResumeEntry(db, sectionId, { perspectiveId: perspId })

      ResumeRepository.deleteSection(db, sectionId)
      const entries = db.query('SELECT * FROM resume_entries WHERE section_id = ?').all(sectionId)
      expect(entries).toHaveLength(0)
    })
  })

  // ── Resume Skills ──────────────────────────────────────────────────

  describe('Resume Skills', () => {
    test('addSkill and listSkillsForSection', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Python', category: 'language' })

      const rs = ResumeRepository.addSkill(db, sectionId, skillId)
      expect(rs.skill_id).toBe(skillId)
      expect(rs.section_id).toBe(sectionId)
      expect(rs.id).toHaveLength(36)

      const skills = ResumeRepository.listSkillsForSection(db, sectionId)
      expect(skills).toHaveLength(1)
      expect(skills[0].skill_id).toBe(skillId)
    })

    test('removeSkill deletes the skill', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Go' })

      ResumeRepository.addSkill(db, sectionId, skillId)
      const removed = ResumeRepository.removeSkill(db, sectionId, skillId)
      expect(removed).toBe(true)

      const skills = ResumeRepository.listSkillsForSection(db, sectionId)
      expect(skills).toHaveLength(0)
    })

    test('removeSkill returns false for nonexistent skill', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const result = ResumeRepository.removeSkill(db, sectionId, crypto.randomUUID())
      expect(result).toBe(false)
    })

    test('duplicate skill throws UNIQUE constraint error', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Rust' })

      ResumeRepository.addSkill(db, sectionId, skillId)
      expect(() => ResumeRepository.addSkill(db, sectionId, skillId)).toThrow(/UNIQUE/)
    })

    test('reorderSkills updates positions', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const s1 = seedSkill(db, { name: 'Python' })
      const s2 = seedSkill(db, { name: 'Go' })
      ResumeRepository.addSkill(db, sectionId, s1, 0)
      ResumeRepository.addSkill(db, sectionId, s2, 1)

      // Swap positions
      ResumeRepository.reorderSkills(db, sectionId, [
        { skill_id: s2, position: 0 },
        { skill_id: s1, position: 1 },
      ])

      const skills = ResumeRepository.listSkillsForSection(db, sectionId)
      expect(skills[0].skill_id).toBe(s2)
      expect(skills[0].position).toBe(0)
      expect(skills[1].skill_id).toBe(s1)
      expect(skills[1].position).toBe(1)
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

    test('deleting section cascades to resume_skills', () => {
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Python' })
      ResumeRepository.addSkill(db, sectionId, skillId)

      ResumeRepository.deleteSection(db, sectionId)

      const skills = db.query('SELECT * FROM resume_skills WHERE section_id = ?').all(sectionId)
      expect(skills).toHaveLength(0)
    })
  })
})
