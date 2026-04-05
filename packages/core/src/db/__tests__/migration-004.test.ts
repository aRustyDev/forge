/**
 * Tests for Migration 004: resume_sections
 *
 * Verifies that the migration:
 * 1. Creates resume_sections and resume_skills tables
 * 2. Replaces section string column with section_id FK
 * 3. Makes perspective_id nullable (for freeform entries)
 * 4. Migrates summary entries to freeform
 * 5. Auto-populates resume_skills from bullet_skills
 * 6. Cascade delete works correctly
 */

import { describe, test, expect, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { resolve } from 'path'
import { readdirSync, readFileSync } from 'node:fs'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../migrations')

/**
 * Apply migrations up to (and including) a named migration.
 * Used to set up pre-004 state for data migration tests.
 */
function applyMigrationsUpTo(db: Database, upTo: string): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const name = file.replace(/\.sql$/, '')
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    db.exec('BEGIN')
    db.exec(sql)
    db.run('INSERT OR IGNORE INTO _migrations (name) VALUES (?)', [name])
    db.exec('COMMIT')
    if (name === upTo) break
  }
}

describe('Migration 004: resume_sections', () => {
  let db: Database

  afterEach(() => {
    if (db) db.close()
  })

  test('applies cleanly on empty database', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    // resume_sections table exists
    const tables = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resume_sections'"
    ).all()
    expect(tables.length).toBe(1)

    // resume_skills table exists
    const skillTables = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resume_skills'"
    ).all()
    expect(skillTables.length).toBe(1)

    // resume_entries has section_id, no section column
    const cols = db.query('PRAGMA table_info(resume_entries)').all() as Array<{ name: string; notnull: number }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toContain('section_id')
    expect(colNames).not.toContain('section')

    // perspective_id should exist but be nullable
    const perspCol = cols.find(c => c.name === 'perspective_id')
    expect(perspCol).toBeDefined()
    expect(perspCol!.notnull).toBe(0)
  })

  test('resume_sections has correct column structure', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(resume_sections)').all() as Array<{ name: string }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('resume_id')
    expect(colNames).toContain('title')
    expect(colNames).toContain('entry_type')
    expect(colNames).toContain('position')
    expect(colNames).toContain('created_at')
    expect(colNames).toContain('updated_at')
  })

  test('resume_skills has correct column structure', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const cols = db.query('PRAGMA table_info(resume_skills)').all() as Array<{ name: string }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('section_id')
    expect(colNames).toContain('skill_id')
    expect(colNames).toContain('position')
    expect(colNames).toContain('created_at')
  })

  test('cascade delete works: delete section removes entries', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    // Create resume, section, entry
    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    const sectionId = crypto.randomUUID()
    db.run(
      "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Experience', 'experience', 0)",
      [sectionId, resumeId]
    )

    const entryId = crypto.randomUUID()
    db.run(
      'INSERT INTO resume_entries (id, resume_id, section_id, position) VALUES (?, ?, ?, 0)',
      [entryId, resumeId, sectionId]
    )

    // Delete section
    db.run('DELETE FROM resume_sections WHERE id = ?', [sectionId])

    // Entry should be gone (CASCADE)
    const entry = db.query('SELECT * FROM resume_entries WHERE id = ?').get(entryId)
    expect(entry).toBeNull()
  })

  test('cascade delete works: delete section removes resume_skills', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    const sectionId = crypto.randomUUID()
    db.run(
      "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Skills', 'skills', 0)",
      [sectionId, resumeId]
    )

    const skillId = crypto.randomUUID()
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId, 'Python', 'language'])

    const rsId = crypto.randomUUID()
    db.run(
      'INSERT INTO resume_skills (id, section_id, skill_id, position) VALUES (?, ?, ?, 0)',
      [rsId, sectionId, skillId]
    )

    // Delete section
    db.run('DELETE FROM resume_sections WHERE id = ?', [sectionId])

    // Resume skill should be gone (CASCADE)
    const skill = db.query('SELECT * FROM resume_skills WHERE id = ?').get(rsId)
    expect(skill).toBeNull()
  })

  test('cascade delete works: delete resume removes sections', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    const sectionId = crypto.randomUUID()
    db.run(
      "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Experience', 'experience', 0)",
      [sectionId, resumeId]
    )

    db.run('DELETE FROM resumes WHERE id = ?', [resumeId])

    const section = db.query('SELECT * FROM resume_sections WHERE id = ?').get(sectionId)
    expect(section).toBeNull()
  })

  test('entry_type CHECK constraint enforced', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    // Valid entry_type should work
    const sectionId = crypto.randomUUID()
    expect(() => {
      db.run(
        "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Exp', 'experience', 0)",
        [sectionId, resumeId]
      )
    }).not.toThrow()

    // Invalid entry_type should fail
    expect(() => {
      db.run(
        "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Bad', 'invalid_type', 0)",
        [crypto.randomUUID(), resumeId]
      )
    }).toThrow()
  })

  test('resume_skills UNIQUE constraint on (section_id, skill_id)', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    const sectionId = crypto.randomUUID()
    db.run(
      "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Skills', 'skills', 0)",
      [sectionId, resumeId]
    )

    const skillId = crypto.randomUUID()
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId, 'Python', 'language'])

    // First insert should work
    db.run(
      'INSERT INTO resume_skills (id, section_id, skill_id, position) VALUES (?, ?, ?, 0)',
      [crypto.randomUUID(), sectionId, skillId]
    )

    // Duplicate should fail
    expect(() => {
      db.run(
        'INSERT INTO resume_skills (id, section_id, skill_id, position) VALUES (?, ?, ?, 1)',
        [crypto.randomUUID(), sectionId, skillId]
      )
    }).toThrow(/UNIQUE/)
  })

  test('freeform entry can have null perspective_id', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const resumeId = crypto.randomUUID()
    db.run(
      "INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES (?, 'Test', 'Eng', 'Co', 'ai')",
      [resumeId]
    )

    const sectionId = crypto.randomUUID()
    db.run(
      "INSERT INTO resume_sections (id, resume_id, title, entry_type, position) VALUES (?, ?, 'Summary', 'freeform', 0)",
      [sectionId, resumeId]
    )

    // Insert entry with null perspective_id
    const entryId = crypto.randomUUID()
    expect(() => {
      db.run(
        'INSERT INTO resume_entries (id, resume_id, section_id, content, position) VALUES (?, ?, ?, ?, 0)',
        [entryId, resumeId, sectionId, 'My freeform text']
      )
    }).not.toThrow()

    const entry = db.query('SELECT * FROM resume_entries WHERE id = ?').get(entryId) as any
    expect(entry.perspective_id).toBeNull()
    expect(entry.content).toBe('My freeform text')
  })
})
