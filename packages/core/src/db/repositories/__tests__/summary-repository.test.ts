import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedSummary, seedResume, testUuid } from '../../__tests__/helpers'
import * as SummaryRepo from '../summary-repository'

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
      description: 'Security engineer with 8+ years...',
      is_template: 0,
      notes: 'For FAANG applications',
    })

    expect(summary.id).toHaveLength(36)
    expect(summary.title).toBe('Security Engineer - Cloud')
    expect(summary.role).toBe('Senior Security Engineer')
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
    const id = seedSummary(db, { title: 'Original', role: 'Engineer' })

    const updated = SummaryRepo.update(db, id, {
      title: 'Updated',
      description: 'New description',
    })

    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('Updated')
    expect(updated!.description).toBe('New description')
    expect(updated!.role).toBe('Engineer')  // unchanged
  })

  test('update sets nullable fields to null', () => {
    const id = seedSummary(db, { role: 'Engineer', description: 'Test desc' })

    const updated = SummaryRepo.update(db, id, { role: null, description: null })
    expect(updated!.role).toBeNull()
    expect(updated!.description).toBeNull()
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
      description: 'A detailed description',
      notes: 'Some notes',
    })

    const cloned = SummaryRepo.clone(db, id)
    expect(cloned).not.toBeNull()
    expect(cloned!.id).not.toBe(id)
    expect(cloned!.title).toBe('Copy of Original')
    expect(cloned!.role).toBe('Engineer')
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

  // Phase 92 note: the migrateHeadersToSummaries data-migration tests were
  // removed because they called the helper against a db that already had all
  // migrations applied, including 034 which drops summaries.tagline. The
  // helper itself still runs correctly in production because migrate.ts
  // invokes it at 006 time (before 034 drops the column). The end-to-end
  // "fresh database: all migrations applied" test in migrate.test.ts covers
  // the full migration chain, so direct-call coverage here is redundant.

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

  // ──────────────────────────────────────────────────────────────────
  // Phase 91 — structured fields, filter/sort, skill keyword junction
  // ──────────────────────────────────────────────────────────────────

  describe('structured fields (Phase 91)', () => {
    /** Seed an industry row, returning its id. */
    function seedIndustry(name: string): string {
      const id = testUuid()
      db.run('INSERT INTO industries (id, name) VALUES (?, ?)', [id, name])
      return id
    }
    /** Seed a role type row, returning its id. */
    function seedRoleType(name: string): string {
      const id = testUuid()
      db.run('INSERT INTO role_types (id, name) VALUES (?, ?)', [id, name])
      return id
    }
    /** Seed a skill row, returning its id. */
    function seedSkillRow(name: string): string {
      const id = testUuid()
      db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, 'other')", [id, name])
      return id
    }

    test('create accepts industry_id and role_type_id', () => {
      const industryId = seedIndustry('FinTech')
      const roleTypeId = seedRoleType('Senior IC')

      const summary = SummaryRepo.create(db, {
        title: 'With structured fields',
        industry_id: industryId,
        role_type_id: roleTypeId,
      })

      expect(summary.industry_id).toBe(industryId)
      expect(summary.role_type_id).toBe(roleTypeId)
    })

    test('create defaults industry_id and role_type_id to null', () => {
      const summary = SummaryRepo.create(db, { title: 'Bare' })
      expect(summary.industry_id).toBeNull()
      expect(summary.role_type_id).toBeNull()
    })

    test('update clears industry_id/role_type_id when set to null', () => {
      const industryId = seedIndustry('Health')
      const id = seedSummary(db, { title: 'T' })
      SummaryRepo.update(db, id, { industry_id: industryId })
      expect(SummaryRepo.get(db, id)!.industry_id).toBe(industryId)

      SummaryRepo.update(db, id, { industry_id: null })
      expect(SummaryRepo.get(db, id)!.industry_id).toBeNull()
    })

    test('list filters by industry_id', () => {
      const finId = seedIndustry('Finance')
      const healthId = seedIndustry('Health')

      SummaryRepo.create(db, { title: 'Fin1', industry_id: finId })
      SummaryRepo.create(db, { title: 'Fin2', industry_id: finId })
      SummaryRepo.create(db, { title: 'HealthOne', industry_id: healthId })
      SummaryRepo.create(db, { title: 'NoIndustry' })

      const finRows = SummaryRepo.list(db, { industry_id: finId })
      expect(finRows.total).toBe(2)
      expect(finRows.data.every((s) => s.industry_id === finId)).toBe(true)
    })

    test('list filters by role_type_id', () => {
      const iC = seedRoleType('IC')
      const mgr = seedRoleType('Manager')

      SummaryRepo.create(db, { title: 'A', role_type_id: iC })
      SummaryRepo.create(db, { title: 'B', role_type_id: mgr })

      const icRows = SummaryRepo.list(db, { role_type_id: iC })
      expect(icRows.total).toBe(1)
      expect(icRows.data[0].title).toBe('A')
    })

    test('list filters by skill_id via summary_skills junction', () => {
      const k8sId = seedSkillRow('Kubernetes')
      const pgId = seedSkillRow('Postgres')

      const s1 = SummaryRepo.create(db, { title: 'Infra' })
      const s2 = SummaryRepo.create(db, { title: 'DB' })
      const s3 = SummaryRepo.create(db, { title: 'Both' })

      SummaryRepo.addSkill(db, s1.id, k8sId)
      SummaryRepo.addSkill(db, s2.id, pgId)
      SummaryRepo.addSkill(db, s3.id, k8sId)
      SummaryRepo.addSkill(db, s3.id, pgId)

      const k8sRows = SummaryRepo.list(db, { skill_id: k8sId })
      expect(k8sRows.total).toBe(2)
      expect(k8sRows.data.map((s) => s.title).sort()).toEqual(['Both', 'Infra'])
    })

    test('list combines multiple filters', () => {
      const finId = seedIndustry('Fintech2')
      const iC = seedRoleType('IC2')

      SummaryRepo.create(db, { title: 'Match', industry_id: finId, role_type_id: iC })
      SummaryRepo.create(db, { title: 'WrongRole', industry_id: finId })
      SummaryRepo.create(db, { title: 'WrongIndustry', role_type_id: iC })

      const combined = SummaryRepo.list(db, { industry_id: finId, role_type_id: iC })
      expect(combined.total).toBe(1)
      expect(combined.data[0].title).toBe('Match')
    })

    test('list sorts by title ascending', () => {
      seedSummary(db, { title: 'Zeta' })
      seedSummary(db, { title: 'Alpha' })
      seedSummary(db, { title: 'Mu' })

      const asc = SummaryRepo.list(db, undefined, { sort_by: 'title', direction: 'asc' })
      expect(asc.data.map((s) => s.title)).toEqual(['Alpha', 'Mu', 'Zeta'])
    })

    test('list sorts by title descending', () => {
      seedSummary(db, { title: 'Zeta' })
      seedSummary(db, { title: 'Alpha' })
      seedSummary(db, { title: 'Mu' })

      const desc = SummaryRepo.list(db, undefined, { sort_by: 'title', direction: 'desc' })
      expect(desc.data.map((s) => s.title)).toEqual(['Zeta', 'Mu', 'Alpha'])
    })

    test('list templates always float to top regardless of sort direction', () => {
      seedSummary(db, { title: 'Zeta', isTemplate: 1 })
      seedSummary(db, { title: 'Alpha', isTemplate: 0 })

      const asc = SummaryRepo.list(db, undefined, { sort_by: 'title', direction: 'asc' })
      expect(asc.data[0].is_template).toBe(1)
      expect(asc.data[0].title).toBe('Zeta') // template first even though Alpha < Zeta

      const desc = SummaryRepo.list(db, undefined, { sort_by: 'title', direction: 'desc' })
      expect(desc.data[0].is_template).toBe(1)
    })

    test('getWithRelations hydrates industry, role_type, and skills', () => {
      const industryId = seedIndustry('Aerospace')
      const roleTypeId = seedRoleType('Tech Lead')
      const skillId = seedSkillRow('Rust')

      const summary = SummaryRepo.create(db, {
        title: 'Hydrated',
        industry_id: industryId,
        role_type_id: roleTypeId,
      })
      SummaryRepo.addSkill(db, summary.id, skillId)

      const hydrated = SummaryRepo.getWithRelations(db, summary.id)
      expect(hydrated).not.toBeNull()
      expect(hydrated!.industry?.name).toBe('Aerospace')
      expect(hydrated!.role_type?.name).toBe('Tech Lead')
      expect(hydrated!.skills).toHaveLength(1)
      expect(hydrated!.skills[0].name).toBe('Rust')
    })

    test('getWithRelations returns null relations when FKs are null', () => {
      const id = seedSummary(db, { title: 'Empty' })
      const hydrated = SummaryRepo.getWithRelations(db, id)
      expect(hydrated!.industry).toBeNull()
      expect(hydrated!.role_type).toBeNull()
      expect(hydrated!.skills).toEqual([])
    })

    test('getWithRelations returns null for missing summary', () => {
      expect(
        SummaryRepo.getWithRelations(db, '00000000-0000-0000-0000-000000000000'),
      ).toBeNull()
    })
  })

  describe('skill keyword junction (Phase 91)', () => {
    function seedSkillRow(name: string): string {
      const id = testUuid()
      db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, 'other')", [id, name])
      return id
    }

    test('addSkill links a skill to a summary', () => {
      const summaryId = seedSummary(db)
      const skillId = seedSkillRow('Python')

      SummaryRepo.addSkill(db, summaryId, skillId)
      const skills = SummaryRepo.getSkills(db, summaryId)

      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe(skillId)
      expect(skills[0].name).toBe('Python')
    })

    test('addSkill is idempotent', () => {
      const summaryId = seedSummary(db)
      const skillId = seedSkillRow('Go')

      SummaryRepo.addSkill(db, summaryId, skillId)
      SummaryRepo.addSkill(db, summaryId, skillId)
      SummaryRepo.addSkill(db, summaryId, skillId)

      expect(SummaryRepo.getSkills(db, summaryId)).toHaveLength(1)
    })

    test('removeSkill unlinks a skill', () => {
      const summaryId = seedSummary(db)
      const skillId = seedSkillRow('Ruby')

      SummaryRepo.addSkill(db, summaryId, skillId)
      expect(SummaryRepo.getSkills(db, summaryId)).toHaveLength(1)

      SummaryRepo.removeSkill(db, summaryId, skillId)
      expect(SummaryRepo.getSkills(db, summaryId)).toHaveLength(0)
    })

    test('getSkills returns skills ordered by name', () => {
      const summaryId = seedSummary(db)
      const idZulu = seedSkillRow('Zulu')
      const idAlpha = seedSkillRow('Alpha')
      const idMike = seedSkillRow('Mike')

      SummaryRepo.addSkill(db, summaryId, idZulu)
      SummaryRepo.addSkill(db, summaryId, idAlpha)
      SummaryRepo.addSkill(db, summaryId, idMike)

      const skills = SummaryRepo.getSkills(db, summaryId)
      expect(skills.map((s) => s.name)).toEqual(['Alpha', 'Mike', 'Zulu'])
    })

    test('deleting a summary cascades and removes its skill links', () => {
      const summaryId = seedSummary(db)
      const skillId = seedSkillRow('Terraform')
      SummaryRepo.addSkill(db, summaryId, skillId)

      SummaryRepo.del(db, summaryId)

      const remaining = db
        .query('SELECT COUNT(*) AS c FROM summary_skills WHERE summary_id = ?')
        .get(summaryId) as { c: number }
      expect(remaining.c).toBe(0)
    })

    test('deleting a skill cascades and removes summary links', () => {
      const summaryId = seedSummary(db)
      const skillId = seedSkillRow('Nomad')
      SummaryRepo.addSkill(db, summaryId, skillId)

      db.run('DELETE FROM skills WHERE id = ?', [skillId])

      const remaining = db
        .query('SELECT COUNT(*) AS c FROM summary_skills WHERE skill_id = ?')
        .get(skillId) as { c: number }
      expect(remaining.c).toBe(0)
    })

    test('clone copies keyword skill links to the cloned summary', () => {
      const summaryId = seedSummary(db, { title: 'Source' })
      const k8sId = seedSkillRow('K8s')
      const pgId = seedSkillRow('PG')
      SummaryRepo.addSkill(db, summaryId, k8sId)
      SummaryRepo.addSkill(db, summaryId, pgId)

      const cloned = SummaryRepo.clone(db, summaryId)!
      const clonedSkills = SummaryRepo.getSkills(db, cloned.id)

      expect(clonedSkills.map((s) => s.name).sort()).toEqual(['K8s', 'PG'])
    })
  })
})
