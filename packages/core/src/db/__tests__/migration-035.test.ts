/**
 * Tests for Migration 035: resume tagline engine
 *
 * Verifies that the migration:
 * 1. Adds generated_tagline and tagline_override columns to resumes
 * 2. Copies existing summary.tagline values into tagline_override of
 *    resumes linked to those summaries (preserves user text)
 * 3. Rebuilds summaries table without the tagline column, preserving
 *    all other columns (id, title, role, description, is_template,
 *    industry_id, role_type_id, notes, created_at, updated_at)
 * 4. Recreates the expected indexes on the rebuilt summaries table
 */

import { describe, test, expect, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { resolve } from 'path'
import { readdirSync, readFileSync } from 'node:fs'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../migrations')

/**
 * Apply migrations up to (and including) a named one, skipping any already
 * recorded in _migrations. Mirrors migration-031.test.ts's helper so we can
 * set up pre-035 state, seed data, then apply just 035.
 */
function applyMigrationsUpTo(db: Database, upTo: string): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let applied = new Set<string>()
  const migTableExists = db
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
    .get() as { name: string } | null
  if (migTableExists) {
    const rows = db.query('SELECT name FROM _migrations').all() as Array<{ name: string }>
    applied = new Set(rows.map((r) => r.name))
  }

  for (const file of files) {
    const name = file.replace(/\.sql$/, '')
    if (applied.has(name)) {
      if (name === upTo) break
      continue
    }

    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    const needsFkOff = sql.includes('PRAGMA foreign_keys = OFF')
    if (needsFkOff) db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN')
    db.exec(sql)
    db.run('INSERT OR IGNORE INTO _migrations (name) VALUES (?)', [name])
    db.exec('COMMIT')
    if (needsFkOff) db.exec('PRAGMA foreign_keys = ON')

    if (name === upTo) break
  }
}

describe('Migration 035: resume tagline engine', () => {
  let db: Database

  afterEach(() => {
    if (db) db.close()
  })

  test('applies cleanly on an empty database', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const mig = db
      .query("SELECT name FROM _migrations WHERE name = '035_resume_tagline_engine'")
      .get() as { name: string } | null
    expect(mig).not.toBeNull()
  })

  test('resumes table gains generated_tagline and tagline_override columns', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(resumes)').all() as Array<{
      name: string
      notnull: number
    }>
    const colMap = new Map(cols.map((c) => [c.name, c]))

    expect(colMap.has('generated_tagline')).toBe(true)
    expect(colMap.has('tagline_override')).toBe(true)
    // Both nullable
    expect(colMap.get('generated_tagline')!.notnull).toBe(0)
    expect(colMap.get('tagline_override')!.notnull).toBe(0)
  })

  test('summaries table no longer has tagline column', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(summaries)').all() as Array<{ name: string }>
    expect(cols.map((c) => c.name)).not.toContain('tagline')
  })

  test('summaries table preserves all other Phase 91 columns', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(summaries)').all() as Array<{ name: string }>
    const names = cols.map((c) => c.name).sort()

    // Every non-tagline column from Phase 91 should survive the rebuild.
    expect(names).toContain('id')
    expect(names).toContain('title')
    expect(names).toContain('role')
    expect(names).toContain('description')
    expect(names).toContain('is_template')
    expect(names).toContain('industry_id')
    expect(names).toContain('role_type_id')
    expect(names).toContain('notes')
    expect(names).toContain('created_at')
    expect(names).toContain('updated_at')
  })

  test('summaries indexes (template, industry_id, role_type_id) still exist', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const indexes = db
      .query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='summaries'")
      .all() as Array<{ name: string }>
    const names = indexes.map((i) => i.name)
    expect(names).toContain('idx_summaries_template')
    expect(names).toContain('idx_summaries_industry_id')
    expect(names).toContain('idx_summaries_role_type_id')
  })

  test('data migration: summary.tagline copied to resume.tagline_override', () => {
    db = getDatabase(':memory:')
    // Apply all migrations UP TO 033, then seed linked summary + resume with
    // tagline, then apply 035 and verify the copy.
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, role, tagline) VALUES (?, 'Sum', 'Engineer', 'Cloud Security Expert')",
      [summaryId],
    )

    const resumeId = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, 'My Resume', 'Security Eng', 'Corp', 'security', ?)`,
      [resumeId, summaryId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row = db
      .query('SELECT tagline_override, generated_tagline FROM resumes WHERE id = ?')
      .get(resumeId) as { tagline_override: string | null; generated_tagline: string | null }

    expect(row.tagline_override).toBe('Cloud Security Expert')
    expect(row.generated_tagline).toBeNull()
  })

  test('data migration: empty/whitespace tagline is not copied', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, tagline) VALUES (?, 'Sum', '   ')",
      [summaryId],
    )

    const resumeId = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, 'R', 'role', 'Corp', 'general', ?)`,
      [resumeId, summaryId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row = db
      .query('SELECT tagline_override FROM resumes WHERE id = ?')
      .get(resumeId) as { tagline_override: string | null }
    expect(row.tagline_override).toBeNull()
  })

  test('data migration: null summary tagline leaves override null', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, tagline) VALUES (?, 'Sum', NULL)",
      [summaryId],
    )
    const resumeId = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, 'R', 'role', 'Corp', 'general', ?)`,
      [resumeId, summaryId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row = db
      .query('SELECT tagline_override FROM resumes WHERE id = ?')
      .get(resumeId) as { tagline_override: string | null }
    expect(row.tagline_override).toBeNull()
  })

  test('data migration: resume with no summary_id stays unchanged', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const resumeId = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype)
       VALUES (?, 'Lonely', 'role', 'Corp', 'general')`,
      [resumeId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row = db
      .query('SELECT tagline_override, generated_tagline FROM resumes WHERE id = ?')
      .get(resumeId) as { tagline_override: string | null; generated_tagline: string | null }
    expect(row.tagline_override).toBeNull()
    expect(row.generated_tagline).toBeNull()
  })

  test('data migration: multiple resumes linked to one summary all receive the tagline', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const summaryId = crypto.randomUUID()
    db.run(
      "INSERT INTO summaries (id, title, tagline) VALUES (?, 'Shared', 'Platform Engineer | DevOps')",
      [summaryId],
    )

    const r1 = crypto.randomUUID()
    const r2 = crypto.randomUUID()
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, 'R1', 'role1', 'Corp', 'general', ?)`,
      [r1, summaryId],
    )
    db.run(
      `INSERT INTO resumes (id, name, target_role, target_employer, archetype, summary_id)
       VALUES (?, 'R2', 'role2', 'Corp', 'general', ?)`,
      [r2, summaryId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row1 = db
      .query('SELECT tagline_override FROM resumes WHERE id = ?')
      .get(r1) as { tagline_override: string | null }
    const row2 = db
      .query('SELECT tagline_override FROM resumes WHERE id = ?')
      .get(r2) as { tagline_override: string | null }
    expect(row1.tagline_override).toBe('Platform Engineer | DevOps')
    expect(row2.tagline_override).toBe('Platform Engineer | DevOps')
  })

  test('data migration: summaries without tagline survive rebuild intact', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '033_summary_structured_fields')

    const summaryId = crypto.randomUUID()
    db.run(
      `INSERT INTO summaries (id, title, role, description, is_template, notes)
       VALUES (?, 'Preserved', 'Engineer', 'Description text', 1, 'Some notes')`,
      [summaryId],
    )

    applyMigrationsUpTo(db, '035_resume_tagline_engine')

    const row = db
      .query('SELECT * FROM summaries WHERE id = ?')
      .get(summaryId) as {
        id: string
        title: string
        role: string
        description: string
        is_template: number
        notes: string
      }
    expect(row.title).toBe('Preserved')
    expect(row.role).toBe('Engineer')
    expect(row.description).toBe('Description text')
    expect(row.is_template).toBe(1)
    expect(row.notes).toBe('Some notes')
  })
})
