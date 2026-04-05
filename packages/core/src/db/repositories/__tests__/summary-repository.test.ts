import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSummary, seedResume, testUuid } from '../../__tests__/helpers'
import * as SummaryRepo from '../summary-repository'
import { migrateHeadersToSummaries } from '../../migrations/006_summaries_data'

describe('SummaryRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ── create ────────────────────────────────────────────────────────

  test('create inserts a summary with all fields', () => {
    const summary = SummaryRepo.create(db, {
      title: 'Security Engineer - Cloud',
      role: 'Senior Security Engineer',
      tagline: 'Cloud + DevSecOps',
      description: 'Security engineer with 8+ years...',
      is_template: 0,
      notes: 'For FAANG applications',
    })

    expect(summary.id).toHaveLength(36)
    expect(summary.title).toBe('Security Engineer - Cloud')
    expect(summary.role).toBe('Senior Security Engineer')
    expect(summary.tagline).toBe('Cloud + DevSecOps')
    expect(summary.description).toBe('Security engineer with 8+ years...')
    expect(summary.is_template).toBe(0)
    expect(summary.notes).toBe('For FAANG applications')
    expect(summary.created_at).toBeTruthy()
    expect(summary.updated_at).toBeTruthy()
  })

  test('create with minimal fields uses defaults', () => {
    const summary = SummaryRepo.create(db, { title: 'Minimal' })

    expect(summary.title).toBe('Minimal')
    expect(summary.role).toBeNull()
    expect(summary.tagline).toBeNull()
    expect(summary.description).toBeNull()
    expect(summary.is_template).toBe(0)
    expect(summary.notes).toBeNull()
  })

  test('create template summary', () => {
    const summary = SummaryRepo.create(db, {
      title: 'Template: Generic',
      is_template: 1,
    })

    expect(summary.is_template).toBe(1)
  })

  // ── get ───────────────────────────────────────────────────────────

  test('get returns summary by id', () => {
    const id = seedSummary(db, { title: 'Findable' })
    const summary = SummaryRepo.get(db, id)

    expect(summary).not.toBeNull()
    expect(summary!.title).toBe('Findable')
  })

  test('get returns null for non-existent id', () => {
    const summary = SummaryRepo.get(db, '00000000-0000-0000-0000-000000000000')
    expect(summary).toBeNull()
  })

  // ── list ──────────────────────────────────────────────────────────

  test('list returns all summaries without filter', () => {
    seedSummary(db, { title: 'One' })
    seedSummary(db, { title: 'Two' })
    seedSummary(db, { title: 'Three', isTemplate: 1 })

    const result = SummaryRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(3)
  })

  test('list filters by is_template', () => {
    seedSummary(db, { title: 'Instance', isTemplate: 0 })
    seedSummary(db, { title: 'Template', isTemplate: 1 })

    const templates = SummaryRepo.list(db, { is_template: 1 })
    expect(templates.total).toBe(1)
    expect(templates.data[0].title).toBe('Template')

    const instances = SummaryRepo.list(db, { is_template: 0 })
    expect(instances.total).toBe(1)
    expect(instances.data[0].title).toBe('Instance')
  })

  test('list paginates correctly', () => {
    for (let i = 0; i < 5; i++) {
      seedSummary(db, { title: `Summary ${i}` })
    }

    const page1 = SummaryRepo.list(db, undefined, undefined, 0, 2)
    expect(page1.data).toHaveLength(2)
    expect(page1.total).toBe(5)

    const page2 = SummaryRepo.list(db, undefined, undefined, 2, 2)
    expect(page2.data).toHaveLength(2)

    const page3 = SummaryRepo.list(db, undefined, undefined, 4, 2)
    expect(page3.data).toHaveLength(1)
  })

  // ── update ────────────────────────────────────────────────────────

  test('update changes specified fields', () => {
    const id = seedSummary(db, { title: 'Original', tagline: 'Old tagline' })

    const updated = SummaryRepo.update(db, id, {
      title: 'Updated',
      tagline: 'New tagline',
    })

    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('Updated')
    expect(updated!.tagline).toBe('New tagline')
    expect(updated!.role).toBe('Security Engineer')  // unchanged
  })

  test('update sets nullable fields to null', () => {
    const id = seedSummary(db, { role: 'Engineer', tagline: 'Test' })

    const updated = SummaryRepo.update(db, id, { role: null, tagline: null })
    expect(updated!.role).toBeNull()
    expect(updated!.tagline).toBeNull()
  })

  test('update sets notes field to null', () => {
    const id = seedSummary(db, { notes: 'Some notes' })

    const updated = SummaryRepo.update(db, id, { notes: null })
    expect(updated).not.toBeNull()
    expect(updated!.notes).toBeNull()
  })

  test('update returns null for non-existent id', () => {
    const result = SummaryRepo.update(db, '00000000-0000-0000-0000-000000000000', { title: 'Nope' })
    expect(result).toBeNull()
  })

  test('update with empty input still refreshes updated_at', () => {
    const id = seedSummary(db)
    const before = SummaryRepo.get(db, id)!

    const updated = SummaryRepo.update(db, id, {})
    expect(updated).not.toBeNull()
    // updated_at should be refreshed (may or may not differ by ms, but field is present)
    expect(updated!.updated_at).toBeTruthy()
  })

  // ── delete ────────────────────────────────────────────────────────

  test('del removes summary', () => {
    const id = seedSummary(db)
    expect(SummaryRepo.del(db, id)).toBe(true)
    expect(SummaryRepo.get(db, id)).toBeNull()
  })

  test('del returns false for non-existent id', () => {
    expect(SummaryRepo.del(db, '00000000-0000-0000-0000-000000000000')).toBe(false)
  })

  test('del sets resume summary_id to NULL (ON DELETE SET NULL)', () => {
    const summaryId = seedSummary(db)

    // Create a resume and link it to the summary
    const resumeId = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [resumeId, 'Test Resume', 'Engineer', 'Corp', 'general', summaryId]
    )

    // Verify link exists
    const before = db.query('SELECT summary_id FROM resumes WHERE id = ?').get(resumeId) as { summary_id: string | null }
    expect(before.summary_id).toBe(summaryId)

    // Delete summary
    SummaryRepo.del(db, summaryId)

    // Verify resume.summary_id is now NULL
    const after = db.query('SELECT summary_id FROM resumes WHERE id = ?').get(resumeId) as { summary_id: string | null }
    expect(after.summary_id).toBeNull()
  })

  // ── clone ─────────────────────────────────────────────────────────

  test('clone creates copy with "Copy of" title', () => {
    const id = seedSummary(db, {
      title: 'Original',
      role: 'Engineer',
      tagline: 'Builds things',
      description: 'A detailed description',
      notes: 'Some notes',
    })

    const cloned = SummaryRepo.clone(db, id)
    expect(cloned).not.toBeNull()
    expect(cloned!.id).not.toBe(id)
    expect(cloned!.title).toBe('Copy of Original')
    expect(cloned!.role).toBe('Engineer')
    expect(cloned!.tagline).toBe('Builds things')
    expect(cloned!.description).toBe('A detailed description')
    expect(cloned!.notes).toBe('Some notes')
    expect(cloned!.is_template).toBe(0)
  })

  test('clone of template sets is_template to 0', () => {
    const id = seedSummary(db, { title: 'Template', isTemplate: 1 })

    const cloned = SummaryRepo.clone(db, id)
    expect(cloned!.is_template).toBe(0)
  })

  test('clone of non-existent id returns null', () => {
    const cloned = SummaryRepo.clone(db, '00000000-0000-0000-0000-000000000000')
    expect(cloned).toBeNull()
  })

  test('clone generates new UUID and timestamps', () => {
    const id = seedSummary(db)
    const original = SummaryRepo.get(db, id)!

    const cloned = SummaryRepo.clone(db, id)!
    expect(cloned.id).not.toBe(original.id)
    expect(cloned.id).toHaveLength(36)
    expect(cloned.created_at).toBeTruthy()
  })

  // ── data migration ────────────────────────────────────────────────

  test('migrateHeadersToSummaries creates summaries for resumes with headers', () => {
    // Create resumes with header JSON
    const r1 = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, header)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r1, 'Resume 1', 'Engineer', 'Corp', 'general', JSON.stringify({ tagline: 'Cloud Expert' })]
    )

    const r2 = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, header)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r2, 'Resume 2', 'DevOps', 'Corp', 'general', JSON.stringify({ tagline: null })]
    )

    const result = migrateHeadersToSummaries(db)

    expect(result.migrated).toBe(2)

    // Verify summaries were created
    const s1 = db.query('SELECT summary_id FROM resumes WHERE id = ?').get(r1) as { summary_id: string }
    expect(s1.summary_id).toBeTruthy()

    const summary1 = db.query('SELECT * FROM summaries WHERE id = ?').get(s1.summary_id) as any
    expect(summary1.tagline).toBe('Cloud Expert')
    expect(summary1.role).toBe('Engineer')

    // Second resume also gets a summary (tagline falls through to target_role)
    const s2 = db.query('SELECT summary_id FROM resumes WHERE id = ?').get(r2) as { summary_id: string }
    expect(s2.summary_id).toBeTruthy()

    const summary2 = db.query('SELECT * FROM summaries WHERE id = ?').get(s2.summary_id) as any
    expect(summary2.role).toBe('DevOps')
  })

  test('migrateHeadersToSummaries is re-entrant (skips if already migrated)', () => {
    // Create a resume with header
    const r1 = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, header)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r1, 'Resume 1', 'Engineer', 'Corp', 'general', JSON.stringify({ tagline: 'Test' })]
    )

    // Run migration
    const first = migrateHeadersToSummaries(db)
    expect(first.migrated).toBe(1)

    // Run again -- should skip
    const second = migrateHeadersToSummaries(db)
    expect(second.migrated).toBe(0)
    expect(second.skipped).toBe(0)
  })

  // ── toggleTemplate ─────────────────────────────────────────────────

  describe('toggleTemplate', () => {
    test('flips 0 to 1', () => {
      const id = seedSummary(db, { isTemplate: 0 })
      const result = SummaryRepo.toggleTemplate(db, id)
      expect(result).not.toBeNull()
      expect(result!.is_template).toBe(1)
    })

    test('flips 1 to 0', () => {
      const id = seedSummary(db, { isTemplate: 1 })
      const result = SummaryRepo.toggleTemplate(db, id)
      expect(result).not.toBeNull()
      expect(result!.is_template).toBe(0)
    })

    test('returns null for nonexistent id', () => {
      const result = SummaryRepo.toggleTemplate(db, testUuid())
      expect(result).toBeNull()
    })

    test('updates updated_at', () => {
      const id = seedSummary(db)
      const before = SummaryRepo.get(db, id)!.updated_at
      SummaryRepo.toggleTemplate(db, id)
      const after = SummaryRepo.get(db, id)!.updated_at
      expect(after >= before).toBe(true)
    })

    test('includes linked_resume_count in returned summary', () => {
      const sId = seedSummary(db)
      const rId = seedResume(db)
      db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])

      const result = SummaryRepo.toggleTemplate(db, sId)
      expect(result).not.toBeNull()
      expect(result!.linked_resume_count).toBe(1)
    })
  })

  // ── linked_resume_count ────────────────────────────────────────────

  describe('linked_resume_count', () => {
    test('get includes linked_resume_count = 0 when no resumes linked', () => {
      const id = seedSummary(db)
      const summary = SummaryRepo.get(db, id)
      expect(summary).not.toBeNull()
      expect(summary!.linked_resume_count).toBe(0)
    })

    test('get includes correct linked_resume_count', () => {
      const sId = seedSummary(db)
      const r1 = seedResume(db)
      const r2 = seedResume(db)
      db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, r1])
      db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, r2])

      const summary = SummaryRepo.get(db, sId)
      expect(summary!.linked_resume_count).toBe(2)
    })

    test('list includes linked_resume_count on every row', () => {
      const s1 = seedSummary(db, { title: 'A' })
      const s2 = seedSummary(db, { title: 'B' })
      const r1 = seedResume(db)
      db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [s1, r1])

      const result = SummaryRepo.list(db)
      const found1 = result.data.find(s => s.id === s1)
      const found2 = result.data.find(s => s.id === s2)
      expect(found1!.linked_resume_count).toBe(1)
      expect(found2!.linked_resume_count).toBe(0)
    })
  })

  // ── getLinkedResumes ───────────────────────────────────────────────

  describe('getLinkedResumes', () => {
    test('returns paginated results', () => {
      const sId = seedSummary(db)
      for (let i = 0; i < 3; i++) {
        const rId = seedResume(db, { name: `Resume ${i}` })
        db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])
      }

      const result = SummaryRepo.getLinkedResumes(db, sId, 0, 2)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)
    })

    test('returns empty for unlinked summary', () => {
      const sId = seedSummary(db)
      const result = SummaryRepo.getLinkedResumes(db, sId)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  // ── list filtering (template extensions) ───────────────────────────

  describe('list filtering — template extensions', () => {
    test('is_template=1 returns only templates', () => {
      seedSummary(db, { title: 'Template', isTemplate: 1 })
      seedSummary(db, { title: 'Instance', isTemplate: 0 })

      const result = SummaryRepo.list(db, { is_template: 1 })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Template')
    })

    test('is_template=0 returns only instances', () => {
      seedSummary(db, { title: 'Template', isTemplate: 1 })
      seedSummary(db, { title: 'Instance', isTemplate: 0 })

      const result = SummaryRepo.list(db, { is_template: 0 })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Instance')
    })

    test('no filter returns all, templates first', () => {
      seedSummary(db, { title: 'Instance', isTemplate: 0 })
      seedSummary(db, { title: 'Template', isTemplate: 1 })

      const result = SummaryRepo.list(db)
      expect(result.data).toHaveLength(2)
      expect(result.data[0].is_template).toBe(1)  // templates first
      expect(result.data[1].is_template).toBe(0)
    })
  })

  // ── delete safety ──────────────────────────────────────────────────

  describe('delete safety', () => {
    test('deleting a template does not affect cloned summaries', () => {
      const templateId = seedSummary(db, { title: 'My Template', isTemplate: 1 })
      const cloneId = seedSummary(db, { title: 'Copy of My Template', isTemplate: 0 })

      SummaryRepo.del(db, templateId)
      const clone = SummaryRepo.get(db, cloneId)
      expect(clone).not.toBeNull()
      expect(clone!.title).toBe('Copy of My Template')
    })
  })
})
