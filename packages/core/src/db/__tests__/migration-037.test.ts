/**
 * Tests for Migration 037: qualifications (credentials + certifications)
 *
 * Covers all 10 acceptance scenarios from the Phase 84 plan (T84.5):
 *   1. Fresh database: migration creates all three new tables
 *   2. Database with clearance data: source_clearances migrates to credentials
 *   3. Access programs junction: multiple programs aggregate into JSON array
 *   4. Sponsor org linkage: organization_id preserved from source_clearances
 *   5. Source type CHECK: inserting source_type='clearance' fails after migration
 *   6. Profile clearance: user_profile no longer has clearance column
 *   7. Note references: entity_type accepts 'credential' + 'certification'
 *   8. Orphan cleanup: clearance source rows deleted; no dangling bullet_sources
 *   9. Certification skills: junction allows valid inserts, rejects invalid FKs
 *  10. CHECK / index integrity: credential_type CHECK, index presence, FKs
 *
 * These tests double as acceptance tests for T84.1, T84.2, T84.3, and T84.4.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { resolve } from 'path'
import { readdirSync, readFileSync } from 'node:fs'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../migrations')

/**
 * Apply migrations up to (and including) a named one, skipping any that are
 * already recorded in `_migrations`. Mirrors the helper used in
 * migration-031/033/035 tests so we can set up pre-037 state, seed data,
 * then apply just 037.
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

describe('Migration 037: qualifications (credentials + certifications)', () => {
  let db: Database

  afterEach(() => {
    if (db) db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 1: Fresh database — new tables created
  // Acceptance: T84.1 — all three tables created with correct CHECK
  //             constraints, FKs, and indices
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 1: fresh database creates new tables', () => {
    test('credentials table exists with correct columns', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const cols = db.query('PRAGMA table_info(credentials)').all() as Array<{
        name: string
        notnull: number
        dflt_value: string | null
      }>
      const colMap = new Map(cols.map((c) => [c.name, c]))

      // Required columns from spec section 1.1
      for (const required of [
        'id', 'credential_type', 'label', 'status', 'organization_id',
        'details', 'issued_date', 'expiry_date', 'created_at', 'updated_at',
      ]) {
        expect(colMap.has(required)).toBe(true)
      }

      // NOT NULL enforcement on the required fields
      expect(colMap.get('id')!.notnull).toBe(1)
      expect(colMap.get('credential_type')!.notnull).toBe(1)
      expect(colMap.get('label')!.notnull).toBe(1)
      expect(colMap.get('status')!.notnull).toBe(1)
      expect(colMap.get('details')!.notnull).toBe(1)

      // Defaults
      expect(colMap.get('status')!.dflt_value).toContain('active')
      expect(colMap.get('details')!.dflt_value).toContain('{}')
    })

    test('certifications table exists with correct columns', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const cols = db.query('PRAGMA table_info(certifications)').all() as Array<{
        name: string
      }>
      const names = cols.map((c) => c.name).sort()
      for (const required of [
        'id', 'short_name', 'long_name', 'cert_id', 'issuer_id',
        'date_earned', 'expiry_date', 'credential_id', 'credential_url',
        'credly_url', 'in_progress', 'created_at', 'updated_at',
      ]) {
        expect(names).toContain(required)
      }
    })

    test('certification_skills junction has composite PK', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const cols = db.query('PRAGMA table_info(certification_skills)').all() as Array<{
        name: string
        pk: number
      }>
      const pkCols = cols.filter((c) => c.pk > 0).map((c) => c.name).sort()
      expect(pkCols).toEqual(['certification_id', 'skill_id'])
    })

    test('expected indexes are created', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const indexes = db
        .query(
          "SELECT name FROM sqlite_master WHERE type='index' AND (tbl_name='credentials' OR tbl_name='certifications' OR tbl_name='certification_skills')",
        )
        .all() as Array<{ name: string }>
      const names = indexes.map((i) => i.name)

      expect(names).toContain('idx_credentials_type')
      expect(names).toContain('idx_credentials_org')
      expect(names).toContain('idx_certifications_issuer')
      expect(names).toContain('idx_certification_skills_skill')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 2: Data migration from source_clearances → credentials
  // Acceptance: T84.2 — all source_clearances rows migrate with correct
  //             details JSON, sponsor org linkage preserved, no data loss
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 2: source_clearances → credentials data migration', () => {
    test('basic clearance row migrates with packed details JSON', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      // Seed a clearance source + extension
      const sourceId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type, start_date) VALUES (?, ?, ?, 'clearance', ?)",
        [sourceId, 'TS Clearance', 'Top Secret holder', '2022-01-15'],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, polygraph, status, type) VALUES (?, 'top_secret', 'ci', 'active', 'personnel')",
        [sourceId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      // The migration should have produced a credentials row
      const credentials = db.query("SELECT * FROM credentials WHERE credential_type = 'clearance'").all() as Array<{
        id: string
        credential_type: string
        label: string
        status: string
        organization_id: string | null
        details: string
        issued_date: string | null
      }>
      expect(credentials).toHaveLength(1)

      const cred = credentials[0]
      expect(cred.credential_type).toBe('clearance')
      expect(cred.label).toBe('Top Secret')  // mapped from 'top_secret' enum
      expect(cred.status).toBe('active')
      expect(cred.issued_date).toBe('2022-01-15')

      const details = JSON.parse(cred.details)
      expect(details.level).toBe('top_secret')
      expect(details.polygraph).toBe('ci')
      expect(details.clearance_type).toBe('personnel')
      expect(details.access_programs).toEqual([])
    })

    test('label derivation covers every level enum value', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      const expectedLabels: Record<string, string> = {
        top_secret: 'Top Secret',
        secret: 'Secret',
        confidential: 'Confidential',
        public: 'Public Trust',
        q: 'DOE Q',
        l: 'DOE L',
      }

      for (const level of Object.keys(expectedLabels)) {
        const sourceId = crypto.randomUUID()
        db.run(
          "INSERT INTO sources (id, title, description, source_type) VALUES (?, ?, ?, 'clearance')",
          [sourceId, `Clearance ${level}`, 'desc'],
        )
        db.run(
          "INSERT INTO source_clearances (source_id, level, status, type) VALUES (?, ?, 'active', 'personnel')",
          [sourceId, level],
        )
      }

      applyMigrationsUpTo(db, '037_qualifications')

      const rows = db.query("SELECT label, json_extract(details, '$.level') AS level FROM credentials WHERE credential_type = 'clearance' ORDER BY label").all() as Array<{
        label: string
        level: string
      }>
      const byLevel = Object.fromEntries(rows.map((r) => [r.level, r.label]))
      for (const [level, expected] of Object.entries(expectedLabels)) {
        expect(byLevel[level]).toBe(expected)
      }
    })

    test('sponsor organization linkage preserved', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      // Seed an organization + clearance with sponsor
      const orgId = crypto.randomUUID()
      db.run(
        "INSERT INTO organizations (id, name, org_type) VALUES (?, 'DoD', 'government')",
        [orgId],
      )
      const sourceId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'TS/SCI', 'desc', 'clearance')",
        [sourceId],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, status, type, sponsor_organization_id) VALUES (?, 'top_secret', 'active', 'personnel', ?)",
        [sourceId, orgId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      const cred = db
        .query("SELECT organization_id FROM credentials WHERE credential_type = 'clearance'")
        .get() as { organization_id: string | null }
      expect(cred.organization_id).toBe(orgId)
    })

    test('no source_clearances data → no credentials migrated', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      // Do NOT seed any source_clearances. Apply 037.
      applyMigrationsUpTo(db, '037_qualifications')

      const count = db
        .query("SELECT COUNT(*) AS c FROM credentials WHERE credential_type = 'clearance'")
        .get() as { c: number }
      expect(count.c).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 3: Access programs junction → JSON array aggregation
  // Acceptance: T84.2 — access programs aggregated correctly
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 3: access_programs aggregation', () => {
    test('multiple access programs aggregate into JSON array', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      const sourceId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'TS/SCI/SAP', 'desc', 'clearance')",
        [sourceId],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, status, type) VALUES (?, 'top_secret', 'active', 'personnel')",
        [sourceId],
      )
      db.run(
        "INSERT INTO clearance_access_programs (source_id, program) VALUES (?, 'sci'), (?, 'sap'), (?, 'nato')",
        [sourceId, sourceId, sourceId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      const cred = db
        .query("SELECT details FROM credentials WHERE credential_type = 'clearance'")
        .get() as { details: string }
      const details = JSON.parse(cred.details)
      expect(details.access_programs).toBeInstanceOf(Array)
      expect(details.access_programs.sort()).toEqual(['nato', 'sap', 'sci'])
    })

    test('zero access programs aggregates to empty array', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      const sourceId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'Secret', 'desc', 'clearance')",
        [sourceId],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, status, type) VALUES (?, 'secret', 'active', 'personnel')",
        [sourceId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      const cred = db
        .query("SELECT details FROM credentials WHERE credential_type = 'clearance'")
        .get() as { details: string }
      const details = JSON.parse(cred.details)
      expect(details.access_programs).toEqual([])
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 4: source_type='clearance' CHECK rejection after migration
  // Acceptance: T84.3 — source_type='clearance' no longer valid
  // ────────────────────────────────────────────────────────────────

  describe("Scenario 4: sources CHECK no longer allows 'clearance'", () => {
    test("INSERT with source_type='clearance' fails", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      expect(() => {
        db.run(
          "INSERT INTO sources (id, title, description, source_type) VALUES (?, ?, ?, 'clearance')",
          [crypto.randomUUID(), 'Bad', 'desc'],
        )
      }).toThrow()
    })

    test("valid source_types still work", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      for (const type of ['role', 'project', 'education', 'general']) {
        expect(() => {
          db.run(
            "INSERT INTO sources (id, title, description, source_type) VALUES (?, ?, ?, ?)",
            [crypto.randomUUID(), `test-${type}`, 'desc', type],
          )
        }).not.toThrow()
      }
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 5: user_profile column removal
  // Acceptance: T84.3 — user_profile has no clearance column
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 5: user_profile.clearance column removed', () => {
    test('clearance column no longer exists', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const cols = db.query('PRAGMA table_info(user_profile)').all() as Array<{ name: string }>
      const names = cols.map((c) => c.name)
      expect(names).not.toContain('clearance')
    })

    test('all other user_profile columns preserved (including Phase 92 salary fields)', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const cols = db.query('PRAGMA table_info(user_profile)').all() as Array<{ name: string }>
      const names = cols.map((c) => c.name)
      for (const required of [
        'id', 'name', 'email', 'phone', 'location', 'linkedin', 'github',
        'website', 'salary_minimum', 'salary_target', 'salary_stretch',
        'created_at', 'updated_at',
      ]) {
        expect(names).toContain(required)
      }
    })

    test('existing profile data survives the rebuild', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      // Update the seeded profile with pre-037 data including clearance
      db.run(
        "UPDATE user_profile SET name = ?, email = ?, website = ?, salary_target = ?, clearance = ?",
        ['Adam', 'adam@test.com', 'adam.dev', 150000, 'TS/SCI'],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      const profile = db.query('SELECT * FROM user_profile').get() as {
        name: string
        email: string
        website: string
        salary_target: number
      }
      expect(profile.name).toBe('Adam')
      expect(profile.email).toBe('adam@test.com')
      expect(profile.website).toBe('adam.dev')
      expect(profile.salary_target).toBe(150000)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 6: note_references entity_type CHECK expanded
  // Acceptance: T84.3 — accepts 'credential' and 'certification'
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 6: note_references new entity types', () => {
    test("accepts entity_type='credential'", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const noteId = crypto.randomUUID()
      db.run("INSERT INTO user_notes (id, content) VALUES (?, ?)", [noteId, 'cred note'])

      expect(() => {
        db.run(
          "INSERT INTO note_references (note_id, entity_type, entity_id) VALUES (?, 'credential', ?)",
          [noteId, crypto.randomUUID()],
        )
      }).not.toThrow()
    })

    test("accepts entity_type='certification'", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const noteId = crypto.randomUUID()
      db.run("INSERT INTO user_notes (id, content) VALUES (?, ?)", [noteId, 'cert note'])

      expect(() => {
        db.run(
          "INSERT INTO note_references (note_id, entity_type, entity_id) VALUES (?, 'certification', ?)",
          [noteId, crypto.randomUUID()],
        )
      }).not.toThrow()
    })

    test("rejects unknown entity_type", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const noteId = crypto.randomUUID()
      db.run("INSERT INTO user_notes (id, content) VALUES (?, ?)", [noteId, 'bad note'])

      expect(() => {
        db.run(
          "INSERT INTO note_references (note_id, entity_type, entity_id) VALUES (?, 'wibble', ?)",
          [noteId, crypto.randomUUID()],
        )
      }).toThrow()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 7: Orphan cleanup — clearance source rows deleted
  // Acceptance: T84.2 — orphaned clearance sources cleaned up
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 7: orphaned clearance sources cleaned up', () => {
    test('all source_type=clearance rows are deleted post-migration', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      // Seed a clearance source
      const sourceId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'Clearance A', 'desc', 'clearance')",
        [sourceId],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, status, type) VALUES (?, 'secret', 'active', 'personnel')",
        [sourceId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      // The source row should be gone (along with the now-dropped source_clearances)
      const srcCount = db
        .query("SELECT COUNT(*) AS c FROM sources WHERE id = ?")
        .get(sourceId) as { c: number }
      expect(srcCount.c).toBe(0)

      // But the credential row should exist
      const credCount = db
        .query("SELECT COUNT(*) AS c FROM credentials WHERE credential_type = 'clearance'")
        .get() as { c: number }
      expect(credCount.c).toBe(1)
    })

    test('non-clearance sources are not affected', () => {
      db = getDatabase(':memory:')
      applyMigrationsUpTo(db, '036_null_auto_content_on_direct_source_entries')

      const roleId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'Role A', 'desc', 'role')",
        [roleId],
      )
      const eduId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'Edu A', 'desc', 'education')",
        [eduId],
      )
      const clrId = crypto.randomUUID()
      db.run(
        "INSERT INTO sources (id, title, description, source_type) VALUES (?, 'Clr A', 'desc', 'clearance')",
        [clrId],
      )
      db.run(
        "INSERT INTO source_clearances (source_id, level, status, type) VALUES (?, 'secret', 'active', 'personnel')",
        [clrId],
      )

      applyMigrationsUpTo(db, '037_qualifications')

      // Role and education survive; clearance is gone
      expect(
        (db.query('SELECT COUNT(*) AS c FROM sources WHERE id = ?').get(roleId) as { c: number }).c,
      ).toBe(1)
      expect(
        (db.query('SELECT COUNT(*) AS c FROM sources WHERE id = ?').get(eduId) as { c: number }).c,
      ).toBe(1)
      expect(
        (db.query('SELECT COUNT(*) AS c FROM sources WHERE id = ?').get(clrId) as { c: number }).c,
      ).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 8: certification_skills junction FK integrity
  // Acceptance: T84.1 — junction allows valid inserts, rejects invalid FKs
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 8: certification_skills junction integrity', () => {
    test('valid insert succeeds', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const certId = crypto.randomUUID()
      const skillId = crypto.randomUUID()
      db.run(
        "INSERT INTO certifications (id, short_name, long_name) VALUES (?, 'CISSP', 'Certified Information Systems Security Professional')",
        [certId],
      )
      db.run("INSERT INTO skills (id, name, category) VALUES (?, 'Security', 'other')", [skillId])

      expect(() => {
        db.run(
          'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
          [certId, skillId],
        )
      }).not.toThrow()
    })

    test('invalid certification_id FK fails', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const skillId = crypto.randomUUID()
      db.run("INSERT INTO skills (id, name, category) VALUES (?, 'AWS', 'platform')", [skillId])

      expect(() => {
        db.run(
          'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
          [crypto.randomUUID(), skillId],
        )
      }).toThrow()
    })

    test('invalid skill_id FK fails', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const certId = crypto.randomUUID()
      db.run("INSERT INTO certifications (id, short_name, long_name) VALUES (?, 'PMP', 'Project Management Professional')", [certId])

      expect(() => {
        db.run(
          'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
          [certId, crypto.randomUUID()],
        )
      }).toThrow()
    })

    test('composite PK rejects duplicate pair', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const certId = crypto.randomUUID()
      const skillId = crypto.randomUUID()
      db.run("INSERT INTO certifications (id, short_name, long_name) VALUES (?, 'PMP', 'Project Management Professional')", [certId])
      db.run("INSERT INTO skills (id, name, category) VALUES (?, 'PM', 'methodology')", [skillId])
      db.run(
        'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
        [certId, skillId],
      )

      expect(() => {
        db.run(
          'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
          [certId, skillId],
        )
      }).toThrow()
    })

    test('cascade delete: removing a certification removes its skill links', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const certId = crypto.randomUUID()
      const skillId = crypto.randomUUID()
      db.run("INSERT INTO certifications (id, short_name, long_name) VALUES (?, 'CISSP', 'Certified Information Systems Security Professional')", [certId])
      db.run("INSERT INTO skills (id, name, category) VALUES (?, 'Sec', 'methodology')", [skillId])
      db.run(
        'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
        [certId, skillId],
      )

      db.run('DELETE FROM certifications WHERE id = ?', [certId])

      const remaining = db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE certification_id = ?')
        .get(certId) as { c: number }
      expect(remaining.c).toBe(0)
    })

    test('cascade delete: removing a skill removes certification links', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const certId = crypto.randomUUID()
      const skillId = crypto.randomUUID()
      db.run("INSERT INTO certifications (id, short_name, long_name) VALUES (?, 'CISSP', 'Certified Information Systems Security Professional')", [certId])
      db.run("INSERT INTO skills (id, name, category) VALUES (?, 'Sec', 'methodology')", [skillId])
      db.run(
        'INSERT INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
        [certId, skillId],
      )

      db.run('DELETE FROM skills WHERE id = ?', [skillId])

      const remaining = db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE skill_id = ?')
        .get(skillId) as { c: number }
      expect(remaining.c).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 9: credentials CHECK / FK / index integrity
  // Acceptance: T84.1 — credential_type CHECK + status CHECK + FK behaviors
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 9: credentials CHECK + FK + index integrity', () => {
    test("credential_type CHECK rejects unknown values", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      expect(() => {
        db.run(
          "INSERT INTO credentials (id, credential_type, label) VALUES (?, 'bogus', 'X')",
          [crypto.randomUUID()],
        )
      }).toThrow()
    })

    test('credential_type CHECK accepts all 4 valid values', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      for (const type of ['clearance', 'drivers_license', 'bar_admission', 'medical_license']) {
        expect(() => {
          db.run(
            "INSERT INTO credentials (id, credential_type, label) VALUES (?, ?, 'Label')",
            [crypto.randomUUID(), type],
          )
        }).not.toThrow()
      }
    })

    test("status CHECK rejects unknown values", () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      expect(() => {
        db.run(
          "INSERT INTO credentials (id, credential_type, label, status) VALUES (?, 'clearance', 'X', 'wibble')",
          [crypto.randomUUID()],
        )
      }).toThrow()
    })

    test('organization_id FK SET NULL on org delete', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const orgId = crypto.randomUUID()
      db.run("INSERT INTO organizations (id, name, org_type) VALUES (?, 'DoD', 'government')", [orgId])

      const credId = crypto.randomUUID()
      db.run(
        "INSERT INTO credentials (id, credential_type, label, organization_id) VALUES (?, 'clearance', 'TS', ?)",
        [credId, orgId],
      )

      db.run('DELETE FROM organizations WHERE id = ?', [orgId])

      const cred = db
        .query('SELECT organization_id FROM credentials WHERE id = ?')
        .get(credId) as { organization_id: string | null }
      expect(cred.organization_id).toBeNull()
    })

    test('certifications.issuer_id FK SET NULL on org delete', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const orgId = crypto.randomUUID()
      db.run(
        "INSERT INTO organizations (id, name, org_type) VALUES (?, 'ISC2', 'company')",
        [orgId],
      )

      const certId = crypto.randomUUID()
      db.run(
        "INSERT INTO certifications (id, short_name, long_name, issuer_id) VALUES (?, 'CISSP', 'Certified Information Systems Security Professional', ?)",
        [certId, orgId],
      )

      db.run('DELETE FROM organizations WHERE id = ?', [orgId])

      const cert = db
        .query('SELECT issuer_id FROM certifications WHERE id = ?')
        .get(certId) as { issuer_id: string | null }
      expect(cert.issuer_id).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Scenario 10: Dropped tables — source_clearances + clearance_access_programs
  // Acceptance: T84.3 — old clearance tables no longer exist
  // ────────────────────────────────────────────────────────────────

  describe('Scenario 10: old clearance tables dropped', () => {
    test('source_clearances table no longer exists', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const rows = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='source_clearances'")
        .all()
      expect(rows).toHaveLength(0)
    })

    test('clearance_access_programs table no longer exists', () => {
      db = getDatabase(':memory:')
      runMigrations(db, MIGRATIONS_DIR)

      const rows = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='clearance_access_programs'")
        .all()
      expect(rows).toHaveLength(0)
    })
  })
})
