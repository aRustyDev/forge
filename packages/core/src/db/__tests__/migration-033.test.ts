/**
 * Tests for Migration 033: summary structured fields
 *
 * Verifies that the migration:
 * 1. Adds industry_id and role_type_id FKs to summaries (nullable, SET NULL
 *    on parent delete)
 * 2. Creates the summary_skills junction table with composite PK and cascade
 *    deletes from both sides
 * 3. Preserves the existing tagline column (intentionally kept — Phase 92
 *    owns the tagline-to-resume migration)
 * 4. Creates the expected indexes (summaries.industry_id, summaries.role_type_id,
 *    summary_skills.skill_id)
 */

import { describe, test, expect, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { resolve } from 'path'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../migrations')

describe('Migration 033: summary structured fields', () => {
  let db: Database

  afterEach(() => {
    if (db) db.close()
  })

  test('applies cleanly on an empty database', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    // The 033 migration should be recorded
    const mig = db
      .query("SELECT name FROM _migrations WHERE name = '033_summary_structured_fields'")
      .get() as { name: string } | null
    expect(mig).not.toBeNull()
  })

  test('summaries table gains industry_id and role_type_id columns', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(summaries)').all() as Array<{
      name: string
      notnull: number
    }>
    const colMap = new Map(cols.map((c) => [c.name, c]))

    expect(colMap.has('industry_id')).toBe(true)
    expect(colMap.has('role_type_id')).toBe(true)
    // Both nullable
    expect(colMap.get('industry_id')!.notnull).toBe(0)
    expect(colMap.get('role_type_id')!.notnull).toBe(0)
  })

  test('summaries.tagline column is preserved (Phase 92 owns removal)', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(summaries)').all() as Array<{ name: string }>
    expect(cols.map((c) => c.name)).toContain('tagline')
  })

  test('summary_skills junction table exists with composite PK', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='summary_skills'")
      .all()
    expect(tables.length).toBe(1)

    const cols = db.query('PRAGMA table_info(summary_skills)').all() as Array<{
      name: string
      pk: number
    }>
    expect(cols.map((c) => c.name).sort()).toEqual(['created_at', 'skill_id', 'summary_id'])
    // summary_id + skill_id form composite PK
    const pkCols = cols.filter((c) => c.pk > 0).map((c) => c.name).sort()
    expect(pkCols).toEqual(['skill_id', 'summary_id'])
  })

  test('expected indexes are created', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const indexes = db
      .query("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%summar%'")
      .all() as Array<{ name: string }>
    const names = indexes.map((i) => i.name)
    expect(names).toContain('idx_summaries_industry_id')
    expect(names).toContain('idx_summaries_role_type_id')
    expect(names).toContain('idx_summary_skills_skill')
  })

  test('summary.industry_id SET NULL on industry delete', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const industryId = crypto.randomUUID()
    db.run('INSERT INTO industries (id, name) VALUES (?, ?)', [industryId, 'FinTestA'])

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, industry_id) VALUES (?, 'S', ?)",
      [summaryId, industryId],
    )

    // Sanity: linked
    const before = db
      .query('SELECT industry_id FROM summaries WHERE id = ?')
      .get(summaryId) as { industry_id: string | null }
    expect(before.industry_id).toBe(industryId)

    db.run('DELETE FROM industries WHERE id = ?', [industryId])

    const after = db
      .query('SELECT industry_id FROM summaries WHERE id = ?')
      .get(summaryId) as { industry_id: string | null }
    expect(after.industry_id).toBeNull()
  })

  test('summary.role_type_id SET NULL on role_type delete', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const roleTypeId = crypto.randomUUID()
    db.run('INSERT INTO role_types (id, name) VALUES (?, ?)', [roleTypeId, 'IC-RT-delete'])

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, role_type_id) VALUES (?, 'S', ?)",
      [summaryId, roleTypeId],
    )

    db.run('DELETE FROM role_types WHERE id = ?', [roleTypeId])

    const after = db
      .query('SELECT role_type_id FROM summaries WHERE id = ?')
      .get(summaryId) as { role_type_id: string | null }
    expect(after.role_type_id).toBeNull()
  })

  test('summary_skills cascades on summary delete', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const summaryId = crypto.randomUUID()
    db.run("INSERT INTO summaries (id, title) VALUES (?, 'CascadeSum')", [summaryId])

    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'CascadeSkill', 'other')", [skillId])

    db.run('INSERT INTO summary_skills (summary_id, skill_id) VALUES (?, ?)', [summaryId, skillId])
    expect(
      (db.query('SELECT COUNT(*) AS c FROM summary_skills WHERE summary_id = ?').get(summaryId) as { c: number }).c,
    ).toBe(1)

    db.run('DELETE FROM summaries WHERE id = ?', [summaryId])

    expect(
      (db.query('SELECT COUNT(*) AS c FROM summary_skills WHERE summary_id = ?').get(summaryId) as { c: number }).c,
    ).toBe(0)
  })

  test('summary_skills cascades on skill delete', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const summaryId = crypto.randomUUID()
    db.run("INSERT INTO summaries (id, title) VALUES (?, 'SumForSkillDel')", [summaryId])

    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'SkillToDel', 'other')", [skillId])

    db.run('INSERT INTO summary_skills (summary_id, skill_id) VALUES (?, ?)', [summaryId, skillId])

    db.run('DELETE FROM skills WHERE id = ?', [skillId])

    expect(
      (db.query('SELECT COUNT(*) AS c FROM summary_skills WHERE skill_id = ?').get(skillId) as { c: number }).c,
    ).toBe(0)
  })

  test('summary_skills rejects duplicate (summary_id, skill_id) pairs', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const summaryId = crypto.randomUUID()
    db.run("INSERT INTO summaries (id, title) VALUES (?, 'DupSum')", [summaryId])
    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'DupSkill', 'other')", [skillId])

    db.run('INSERT INTO summary_skills (summary_id, skill_id) VALUES (?, ?)', [summaryId, skillId])

    // Second insert with identical PK should fail the composite UNIQUE
    expect(() => {
      db.run('INSERT INTO summary_skills (summary_id, skill_id) VALUES (?, ?)', [summaryId, skillId])
    }).toThrow()
  })
})
