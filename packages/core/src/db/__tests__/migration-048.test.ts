/**
 * Tests for Migration 048: Notes Normalization
 *
 * Verifies that:
 * 1. Inline notes are migrated to user_notes + note_references
 * 2. Notes columns are dropped from all 8 entity tables
 * 3. reputation_notes is dropped from organizations
 * 4. Indexes and triggers are preserved
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from './helpers'

function getColumns(db: Database, table: string): string[] {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.map(r => r.name)
}

describe('Migration 048: notes normalization', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })
  afterEach(() => db.close())

  const TABLES_WITHOUT_NOTES = [
    'sources',
    'bullets',
    'perspectives',
    'resumes',
    'resume_entries',
    'skills',
    'organizations',
    'job_descriptions',
  ]

  test('notes column is absent from all 8 entity tables', () => {
    for (const table of TABLES_WITHOUT_NOTES) {
      const columns = getColumns(db, table)
      expect(columns).not.toContain('notes')
    }
  })

  test('reputation_notes column is absent from organizations', () => {
    const columns = getColumns(db, 'organizations')
    expect(columns).not.toContain('reputation_notes')
  })

  test('user_notes and note_references tables still exist', () => {
    const tables = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user_notes','note_references')"
    ).all() as { name: string }[]
    const names = tables.map(r => r.name)
    expect(names).toContain('user_notes')
    expect(names).toContain('note_references')
  })

  test('note_references CHECK constraint includes all entity types', () => {
    const schema = db.query(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='note_references'"
    ).get() as { sql: string }

    for (const type of ['source', 'bullet', 'perspective', 'resume_entry',
      'resume', 'skill', 'organization', 'job_description', 'contact',
      'credential', 'certification']) {
      expect(schema.sql).toContain(`'${type}'`)
    }
  })

  test('indexes exist on rebuilt tables', () => {
    const indexes = db.query(
      "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string; tbl_name: string }[]
    const indexNames = indexes.map(r => r.name)

    expect(indexNames).toContain('idx_sources_status')
    expect(indexNames).toContain('idx_sources_source_type')
    expect(indexNames).toContain('idx_bullets_status')
    expect(indexNames).toContain('idx_perspectives_bullet')
    expect(indexNames).toContain('idx_resume_entries_section')
    expect(indexNames).toContain('idx_skills_category')
    expect(indexNames).toContain('idx_organizations_name')
    expect(indexNames).toContain('idx_job_descriptions_org')
  })

  test('jd_updated_at trigger exists on job_descriptions', () => {
    const triggers = db.query(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='job_descriptions'"
    ).all() as { name: string }[]
    expect(triggers.map(r => r.name)).toContain('jd_updated_at')
  })

  test('migration 048 is recorded', () => {
    const row = db.query(
      "SELECT name FROM _migrations WHERE name = '048_notes_normalization'"
    ).get() as { name: string } | null
    expect(row).not.toBeNull()
  })

  test('existing non-notes columns preserved in sources', () => {
    const columns = getColumns(db, 'sources')
    for (const col of ['id', 'title', 'description', 'source_type', 'start_date',
      'end_date', 'status', 'updated_by', 'last_derived_at', 'created_at', 'updated_at']) {
      expect(columns).toContain(col)
    }
  })

  test('existing non-notes columns preserved in organizations', () => {
    const columns = getColumns(db, 'organizations')
    for (const col of ['id', 'name', 'org_type', 'industry', 'size', 'worked',
      'employment_type', 'website', 'linkedin_url', 'glassdoor_url',
      'glassdoor_rating', 'status', 'created_at', 'updated_at', 'industry_id']) {
      expect(columns).toContain(col)
    }
  })

  test('contacts and summaries still have notes column', () => {
    const contactCols = getColumns(db, 'contacts')
    expect(contactCols).toContain('notes')

    const summaryCols = getColumns(db, 'summaries')
    expect(summaryCols).toContain('notes')
  })

  test('source_roles still has total_comp_notes column', () => {
    const columns = getColumns(db, 'source_roles')
    expect(columns).toContain('total_comp_notes')
  })
})
