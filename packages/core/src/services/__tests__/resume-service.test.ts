import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { ResumeService } from '../resume-service'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection, seedSkill } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('ResumeService', () => {
  let db: Database
  let service: ResumeService

  beforeEach(() => {
    db = createTestDb()
    service = new ResumeService(db, buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── createResume ──────────────────────────────────────────────────

  test('createResume with valid input succeeds', async () => {
    const result = await service.createResume({
      name: 'AI Engineer Resume',
      target_role: 'AI Engineer',
      target_employer: 'Anthropic',
      archetype: 'agentic-ai',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('AI Engineer Resume')
    expect(result.data.status).toBe('draft')
  })

  test('createResume rejects empty name', async () => {
    const result = await service.createResume({
      name: '',
      target_role: 'AI Engineer',
      target_employer: 'Anthropic',
      archetype: 'agentic-ai',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('createResume rejects empty target_role', async () => {
    const result = await service.createResume({
      name: 'Resume',
      target_role: '',
      target_employer: 'Anthropic',
      archetype: 'agentic-ai',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('createResume rejects empty target_employer', async () => {
    const result = await service.createResume({
      name: 'Resume',
      target_role: 'AI Engineer',
      target_employer: '',
      archetype: 'agentic-ai',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('createResume rejects empty archetype', async () => {
    const result = await service.createResume({
      name: 'Resume',
      target_role: 'AI Engineer',
      target_employer: 'Anthropic',
      archetype: '',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  // ── getResume ─────────────────────────────────────────────────────

  test('getResume returns resume with entries', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = await service.getResume(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(resumeId)
    expect(result.data.sections).toBeDefined()
    const expSection = result.data.sections.find(s => s.entry_type === 'experience')
    expect(expSection).toBeDefined()
    expect(expSection!.entries).toHaveLength(1)
  })

  test('getResume returns NOT_FOUND for missing ID', async () => {
    const result = await service.getResume('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── listResumes ───────────────────────────────────────────────────

  test('listResumes returns all resumes', async () => {
    seedResume(db, { name: 'Resume A' })
    seedResume(db, { name: 'Resume B' })

    const result = await service.listResumes()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })

  test('listResumes supports pagination', async () => {
    for (let i = 0; i < 5; i++) {
      seedResume(db, { name: `Resume ${i}` })
    }

    const result = await service.listResumes(0, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(5)
  })

  // ── updateResume ──────────────────────────────────────────────────

  test('updateResume with valid input succeeds', async () => {
    const resumeId = seedResume(db)

    const result = await service.updateResume(resumeId, { name: 'Updated Resume' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('Updated Resume')
  })

  test('updateResume rejects empty name', async () => {
    const resumeId = seedResume(db)

    const result = await service.updateResume(resumeId, { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('updateResume returns NOT_FOUND for missing ID', async () => {
    const result = await service.updateResume('nonexistent', { name: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── deleteResume ──────────────────────────────────────────────────

  test('deleteResume removes resume', async () => {
    const resumeId = seedResume(db)

    const result = await service.deleteResume(resumeId)
    expect(result.ok).toBe(true)

    const check = await service.getResume(resumeId)
    expect(check.ok).toBe(false)
  })

  test('deleteResume returns NOT_FOUND for missing ID', async () => {
    const result = await service.deleteResume('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── addEntry ──────────────────────────────────────────────────────

  test('addEntry adds approved perspective to resume', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'approved' })
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = await service.addEntry(resumeId, {
      perspective_id: perspId,
      section_id: secId,
      position: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspective_id).toBe(perspId)
    expect(result.data.section_id).toBe(secId)
  })

  test('addEntry rejects non-approved perspective', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'draft' })
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = await service.addEntry(resumeId, {
      perspective_id: perspId,
      section_id: secId,
      position: 0,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('approved')
  })

  test('addEntry returns NOT_FOUND for missing resume', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'approved' })

    const result = await service.addEntry('nonexistent', {
      perspective_id: perspId,
      section_id: 'some-section-id',
      position: 0,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('addEntry returns NOT_FOUND for missing perspective', async () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = await service.addEntry(resumeId, {
      perspective_id: 'nonexistent',
      section_id: secId,
      position: 0,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('addEntry creates freeform entry without perspective', async () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Summary', 'freeform')

    const result = await service.addEntry(resumeId, {
      section_id: secId,
      content: 'My freeform summary text',
      position: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspective_id).toBeNull()
    expect(result.data.content).toBe('My freeform summary text')
  })

  // ── removeEntry ───────────────────────────────────────────────────

  test('removeEntry removes existing entry', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const entryId = seedResumeEntry(db, secId, { perspectiveId: perspId })

    const result = await service.removeEntry(resumeId, entryId)
    expect(result.ok).toBe(true)

    // Verify it's gone
    const check = await service.getResume(resumeId)
    expect(check.ok).toBe(true)
    if (!check.ok) return
    const allEntries = check.data.sections.flatMap(s => s.entries)
    expect(allEntries).toHaveLength(0)
  })

  test('removeEntry returns NOT_FOUND for missing entry', async () => {
    const resumeId = seedResume(db)

    const result = await service.removeEntry(resumeId, 'nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── reorderEntries ────────────────────────────────────────────────

  test('reorderEntries updates positions', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const p1 = seedPerspective(db, bulletId)
    const p2 = seedPerspective(db, bulletId, { domain: 'security' })
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    const e1 = seedResumeEntry(db, secId, { perspectiveId: p1, position: 0 })
    const e2 = seedResumeEntry(db, secId, { perspectiveId: p2, position: 1 })

    // Swap positions
    const result = await service.reorderEntries(resumeId, [
      { id: e1, section_id: secId, position: 1 },
      { id: e2, section_id: secId, position: 0 },
    ])
    expect(result.ok).toBe(true)

    const check = await service.getResume(resumeId)
    expect(check.ok).toBe(true)
    if (!check.ok) return
    const entries = check.data.sections[0].entries
    expect(entries[0].id).toBe(e2)
    expect(entries[1].id).toBe(e1)
  })

  test('reorderEntries returns NOT_FOUND for missing resume', async () => {
    const result = await service.reorderEntries('nonexistent', [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('reorderEntries rejects unknown entry ID', async () => {
    const resumeId = seedResume(db)
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    seedResumeEntry(db, secId, { perspectiveId: perspId })

    const result = await service.reorderEntries(resumeId, [
      { id: 'nonexistent', section_id: secId, position: 0 },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('not in this resume')
  })

  // ── analyzeGaps ───────────────────────────────────────────────────

  test('analyzeGaps identifies missing domain coverage', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      status: 'approved',
    })
    const resumeId = seedResume(db, { archetype: 'agentic-ai' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    seedResumeEntry(db, secId, { perspectiveId: perspId })

    const result = await service.analyzeGaps(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // agentic-ai expects: ai_ml, software_engineering, leadership
    // We only have ai_ml, so software_engineering and leadership are missing
    expect(result.data.coverage_summary.domains_represented).toContain('ai_ml')
    expect(result.data.coverage_summary.domains_missing).toContain('software_engineering')
    expect(result.data.coverage_summary.domains_missing).toContain('leadership')
  })

  test('analyzeGaps identifies thin coverage', async () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])

    // Create 1 perspective for ai_ml (threshold is 2)
    const p1 = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      status: 'approved',
    })
    // Create 2 perspectives for software_engineering (meets threshold)
    const p2 = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'software_engineering',
      status: 'approved',
    })
    const p3 = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'software_engineering',
      status: 'approved',
    })
    // Create 2 for leadership
    const p4 = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'leadership',
      status: 'approved',
    })
    const p5 = seedPerspective(db, bulletId, {
      archetype: 'agentic-ai',
      domain: 'leadership',
      status: 'approved',
    })

    const resumeId = seedResume(db, { archetype: 'agentic-ai' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    seedResumeEntry(db, secId, { perspectiveId: p1 })
    seedResumeEntry(db, secId, { perspectiveId: p2 })
    seedResumeEntry(db, secId, { perspectiveId: p3 })
    seedResumeEntry(db, secId, { perspectiveId: p4 })
    seedResumeEntry(db, secId, { perspectiveId: p5 })

    const result = await service.analyzeGaps(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const thinGaps = result.data.gaps.filter(g => g.type === 'thin_coverage')
    expect(thinGaps.length).toBeGreaterThanOrEqual(1)
    const aiMlThin = thinGaps.find(g => g.type === 'thin_coverage' && g.domain === 'ai_ml')
    expect(aiMlThin).toBeDefined()
  })

  test('analyzeGaps identifies unused bullets', async () => {
    const srcId = seedSource(db)
    // Approved bullet with no perspective for 'agentic-ai'
    seedBullet(db, [{ id: srcId }], { status: 'approved' })

    const resumeId = seedResume(db, { archetype: 'agentic-ai' })

    const result = await service.analyzeGaps(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const unusedGaps = result.data.gaps.filter(g => g.type === 'unused_bullet')
    expect(unusedGaps.length).toBeGreaterThanOrEqual(1)
  })

  test('analyzeGaps unused bullets show source title from junction', async () => {
    const srcId = seedSource(db, { title: 'Cloud Migration' })
    seedBullet(db, [{ id: srcId }], { status: 'approved' })

    const resumeId = seedResume(db, { archetype: 'agentic-ai' })

    const result = await service.analyzeGaps(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const unusedGaps = result.data.gaps.filter(g => g.type === 'unused_bullet')
    expect(unusedGaps.length).toBeGreaterThanOrEqual(1)
    if (unusedGaps[0].type === 'unused_bullet') {
      expect(unusedGaps[0].source_title).toBe('Cloud Migration')
    }
  })

  test('analyzeGaps returns NOT_FOUND for missing resume', async () => {
    const result = await service.analyzeGaps('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('analyzeGaps skips freeform entries (no crash on null perspective_id)', async () => {
    const resumeId = seedResume(db, { archetype: 'agentic-ai' })
    const secId = seedResumeSection(db, resumeId, 'Summary', 'freeform')
    seedResumeEntry(db, secId, { content: 'My freeform summary' })

    const result = await service.analyzeGaps(resumeId)
    expect(result.ok).toBe(true)
  })

  // ── Section management ────────────────────────────────────────────

  describe('section management', () => {
    test('createSection returns section entity', async () => {
      const resumeId = seedResume(db)
      const result = await service.createSection(resumeId, {
        title: 'Experience',
        entry_type: 'experience',
        position: 0,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.title).toBe('Experience')
      expect(result.data.entry_type).toBe('experience')
      expect(result.data.resume_id).toBe(resumeId)
    })

    test('createSection returns NOT_FOUND for missing resume', async () => {
      const result = await service.createSection('nonexistent', {
        title: 'Sec',
        entry_type: 'experience',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('listSections returns all sections ordered by position', async () => {
      const resumeId = seedResume(db)
      await service.createSection(resumeId, { title: 'Skills', entry_type: 'skills', position: 1 })
      await service.createSection(resumeId, { title: 'Summary', entry_type: 'freeform', position: 0 })

      const result = await service.listSections(resumeId)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(2)
      expect(result.data[0].title).toBe('Summary')
      expect(result.data[1].title).toBe('Skills')
    })

    test('listSections returns NOT_FOUND for missing resume', async () => {
      const result = await service.listSections('nonexistent')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('updateSection changes title', async () => {
      const resumeId = seedResume(db)
      const created = await service.createSection(resumeId, { title: 'Old', entry_type: 'experience' })
      if (!created.ok) throw new Error('setup failed')

      const result = await service.updateSection(resumeId, created.data.id, { title: 'New Title' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.title).toBe('New Title')
      expect(result.data.entry_type).toBe('experience')
    })

    test('updateSection returns NOT_FOUND for wrong resume', async () => {
      const resumeId = seedResume(db)
      const otherResumeId = seedResume(db)
      const created = await service.createSection(resumeId, { title: 'Sec', entry_type: 'experience' })
      if (!created.ok) throw new Error('setup failed')

      const result = await service.updateSection(otherResumeId, created.data.id, { title: 'Nope' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('deleteSection removes section', async () => {
      const resumeId = seedResume(db)
      const created = await service.createSection(resumeId, { title: 'Del', entry_type: 'experience' })
      if (!created.ok) throw new Error('setup failed')

      const result = await service.deleteSection(resumeId, created.data.id)
      expect(result.ok).toBe(true)

      const check = await service.listSections(resumeId)
      if (!check.ok) throw new Error('listSections failed')
      expect(check.data).toHaveLength(0)
    })

    test('deleteSection returns NOT_FOUND for wrong resume', async () => {
      const resumeId = seedResume(db)
      const otherResumeId = seedResume(db)
      const created = await service.createSection(resumeId, { title: 'Sec', entry_type: 'experience' })
      if (!created.ok) throw new Error('setup failed')

      const result = await service.deleteSection(otherResumeId, created.data.id)
      expect(result.ok).toBe(false)
    })
  })

  // ── Skills management ─────────────────────────────────────────────

  describe('skills management', () => {
    test('addSkill adds skill to section', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Python', category: 'language' })

      const result = await service.addSkill(resumeId, secId, skillId)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.skill_id).toBe(skillId)
    })

    test('addSkill returns NOT_FOUND for wrong resume', async () => {
      const resumeId = seedResume(db)
      const otherResumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db)

      const result = await service.addSkill(otherResumeId, secId, skillId)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('addSkill returns CONFLICT for duplicate', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db, { name: 'Go' })

      await service.addSkill(resumeId, secId, skillId)
      const result = await service.addSkill(resumeId, secId, skillId)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('CONFLICT')
    })

    test('removeSkill removes skill', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const skillId = seedSkill(db)
      await service.addSkill(resumeId, secId, skillId)

      const result = await service.removeSkill(resumeId, secId, skillId)
      expect(result.ok).toBe(true)
    })

    test('removeSkill returns NOT_FOUND for missing skill', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')

      const result = await service.removeSkill(resumeId, secId, crypto.randomUUID())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('listSkillsForSection returns skills', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const s1 = seedSkill(db, { name: 'Python' })
      const s2 = seedSkill(db, { name: 'Go' })
      await service.addSkill(resumeId, secId, s1)
      await service.addSkill(resumeId, secId, s2)

      const result = await service.listSkillsForSection(resumeId, secId)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(2)
    })

    test('listSkillsForSection returns NOT_FOUND for wrong resume', async () => {
      const resumeId = seedResume(db)
      const otherResumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')

      const result = await service.listSkillsForSection(otherResumeId, secId)
      expect(result.ok).toBe(false)
    })

    test('reorderSkills updates positions', async () => {
      const resumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')
      const s1 = seedSkill(db, { name: 'Python' })
      const s2 = seedSkill(db, { name: 'Go' })
      await service.addSkill(resumeId, secId, s1)
      await service.addSkill(resumeId, secId, s2)

      const result = await service.reorderSkills(resumeId, secId, [
        { skill_id: s2, position: 0 },
        { skill_id: s1, position: 1 },
      ])
      expect(result.ok).toBe(true)
    })

    test('reorderSkills returns NOT_FOUND for wrong resume', async () => {
      const resumeId = seedResume(db)
      const otherResumeId = seedResume(db)
      const secId = seedResumeSection(db, resumeId, 'Skills', 'skills')

      const result = await service.reorderSkills(otherResumeId, secId, [])
      expect(result.ok).toBe(false)
    })
  })
})
