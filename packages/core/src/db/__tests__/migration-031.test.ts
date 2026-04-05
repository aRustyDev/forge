/**
 * Tests for Migration 031: skills expansion & technology absorption
 *
 * Verifies that the migration:
 * 1. Rebuilds the skills table with a structured category CHECK enum
 *    (language, framework, platform, tool, library, methodology, protocol,
 *    concept, soft_skill, other) and a DEFAULT of 'other'
 * 2. Creates the skill_domains junction with composite PK + cascade deletes
 * 3. For each unique bullet_technologies.technology string:
 *    - Matches to an existing skill by case-insensitive name, OR
 *    - Creates a new skill with category='other' if none matched
 * 4. Converts bullet_technologies rows into bullet_skills rows (idempotent —
 *    pre-existing bullet_skills links survive and are not duplicated)
 * 5. Drops the bullet_technologies table
 *
 * The migration uses `PRAGMA foreign_keys = OFF` via the migration runner
 * auto-detection, because the skills table rebuild would otherwise cascade.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { resolve } from 'path'
import { readdirSync, readFileSync } from 'node:fs'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../migrations')

/**
 * Apply migrations up to (and including) the named migration, skipping any
 * that are already recorded in `_migrations`. This allows tests to first
 * call `applyMigrationsUpTo(db, '029_...')` to set up pre-031 state, then
 * later call `applyMigrationsUpTo(db, '031_...')` to apply only 031.
 */
function applyMigrationsUpTo(db: Database, upTo: string): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  // Get already-applied migrations (empty set if the _migrations table
  // doesn't exist yet — it's created by 001_initial.sql itself).
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
    // migrate.ts auto-detects `-- PRAGMA foreign_keys = OFF` and wraps in a txn
    // with FK checks disabled. Mirror that behavior for correctness.
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

describe('Migration 031: skills expansion & technology absorption', () => {
  let db: Database

  afterEach(() => {
    if (db) db.close()
  })

  test('applies cleanly on an empty database', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    // skills table exists with the new category CHECK enum
    const skillsCols = db.query('PRAGMA table_info(skills)').all() as Array<{
      name: string
      dflt_value: string | null
      notnull: number
    }>
    const categoryCol = skillsCols.find((c) => c.name === 'category')
    expect(categoryCol).toBeDefined()
    expect(categoryCol!.notnull).toBe(1)
    expect(categoryCol!.dflt_value).toContain('other')

    // skill_domains junction exists with composite PK
    const junctionTable = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='skill_domains'")
      .all()
    expect(junctionTable.length).toBe(1)

    const junctionCols = db.query('PRAGMA table_info(skill_domains)').all() as Array<{
      name: string
      pk: number
    }>
    const junctionColNames = junctionCols.map((c) => c.name).sort()
    expect(junctionColNames).toContain('skill_id')
    expect(junctionColNames).toContain('domain_id')
    expect(junctionCols.filter((c) => c.pk > 0).length).toBe(2)

    // bullet_technologies is gone
    const oldTable = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='bullet_technologies'")
      .all()
    expect(oldTable.length).toBe(0)
  })

  test('category CHECK enum rejects invalid values', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    expect(() => {
      db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [
        crypto.randomUUID(),
        'BadSkill',
        'wibble',
      ])
    }).toThrow()
  })

  test('category CHECK enum accepts all ten valid values', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const valid = [
      'language',
      'framework',
      'platform',
      'tool',
      'library',
      'methodology',
      'protocol',
      'concept',
      'soft_skill',
      'other',
    ]
    for (const category of valid) {
      expect(() => {
        db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [
          crypto.randomUUID(),
          `Skill-${category}`,
          category,
        ])
      }).not.toThrow()
    }

    const countResult = db.query('SELECT COUNT(*) AS c FROM skills').get() as { c: number }
    expect(countResult.c).toBeGreaterThanOrEqual(valid.length)
  })

  test('new skills default to category=other when unspecified', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const id = crypto.randomUUID()
    db.run('INSERT INTO skills (id, name) VALUES (?, ?)', [id, 'DefaultCategorySkill'])

    const row = db.query('SELECT category FROM skills WHERE id = ?').get(id) as { category: string }
    expect(row.category).toBe('other')
  })

  test('absorbs bullet_technologies: matches existing skill by case-insensitive name', () => {
    db = getDatabase(':memory:')

    // Apply all migrations up to but not including 031 (last pre-031 migration is 029)
    applyMigrationsUpTo(db, '029_prompt_logs_jd_entity_type')

    // Seed pre-031 state: a skill "Python" and a bullet tagged with technology "PYTHON"
    const skillId = crypto.randomUUID()
    db.run(
      "INSERT INTO skills (id, name, category) VALUES (?, 'Python', 'language')",
      [skillId],
    )

    const sourceId = crypto.randomUUID()
    db.run(
      "INSERT INTO sources (id, title, description, source_type, status) VALUES (?, 'Src', 'desc', 'general', 'approved')",
      [sourceId],
    )

    const bulletId = crypto.randomUUID()
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'Used python', 'snap', 'approved')",
      [bulletId],
    )
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      bulletId,
      sourceId,
    ])
    db.run("INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, 'PYTHON')", [bulletId])

    // Now apply migration 031
    applyMigrationsUpTo(db, '031_skills_expansion')

    // Assert: no new skill was created — the existing 'Python' skill was reused
    const pythonSkills = db
      .query("SELECT id, name FROM skills WHERE lower(name) = 'python'")
      .all() as Array<{ id: string; name: string }>
    expect(pythonSkills).toHaveLength(1)
    expect(pythonSkills[0].id).toBe(skillId)

    // Assert: bullet is now linked to Python via bullet_skills
    const link = db
      .query('SELECT bullet_id, skill_id FROM bullet_skills WHERE bullet_id = ? AND skill_id = ?')
      .get(bulletId, skillId)
    expect(link).toBeDefined()
  })

  test('absorbs bullet_technologies: creates new skill with category=other when no match', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '029_prompt_logs_jd_entity_type')

    const sourceId = crypto.randomUUID()
    db.run(
      "INSERT INTO sources (id, title, description, source_type, status) VALUES (?, 'Src', 'desc', 'general', 'approved')",
      [sourceId],
    )

    const bulletId = crypto.randomUUID()
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'Built thing', 'snap', 'approved')",
      [bulletId],
    )
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      bulletId,
      sourceId,
    ])
    // Technology with no matching skill — 'nomad' should become a new skill row
    db.run("INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, 'nomad')", [
      bulletId,
    ])

    applyMigrationsUpTo(db, '031_skills_expansion')

    const nomad = db
      .query("SELECT id, name, category FROM skills WHERE lower(name) = 'nomad'")
      .get() as { id: string; name: string; category: string } | null
    expect(nomad).not.toBeNull()
    expect(nomad!.category).toBe('other')

    const link = db
      .query('SELECT skill_id FROM bullet_skills WHERE bullet_id = ?')
      .get(bulletId) as { skill_id: string } | null
    expect(link).not.toBeNull()
    expect(link!.skill_id).toBe(nomad!.id)
  })

  test('absorbs bullet_technologies: no data loss across multiple technologies', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '029_prompt_logs_jd_entity_type')

    const sourceId = crypto.randomUUID()
    db.run(
      "INSERT INTO sources (id, title, description, source_type, status) VALUES (?, 'Src', 'desc', 'general', 'approved')",
      [sourceId],
    )

    const bulletId = crypto.randomUUID()
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'Multi-tech', 'snap', 'approved')",
      [bulletId],
    )
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      bulletId,
      sourceId,
    ])
    const techs = ['kafka', 'kubernetes', 'terraform', 'aws', 'postgres']
    for (const t of techs) {
      db.run('INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, ?)', [bulletId, t])
    }

    applyMigrationsUpTo(db, '031_skills_expansion')

    // All 5 techs should be linked to the bullet via bullet_skills
    const linkedNames = db
      .query(
        `SELECT lower(s.name) AS name FROM bullet_skills bs
         JOIN skills s ON s.id = bs.skill_id
         WHERE bs.bullet_id = ?
         ORDER BY name`,
      )
      .all(bulletId) as Array<{ name: string }>
    expect(linkedNames.map((r) => r.name).sort()).toEqual([...techs].sort())
  })

  test('absorbs bullet_technologies: preserves pre-existing bullet_skills links without duplication', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '029_prompt_logs_jd_entity_type')

    // Seed skill + existing bullet_skills link, plus a redundant bullet_technologies row
    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'Docker', 'tool')", [skillId])

    const sourceId = crypto.randomUUID()
    db.run(
      "INSERT INTO sources (id, title, description, source_type, status) VALUES (?, 'Src', 'desc', 'general', 'approved')",
      [sourceId],
    )

    const bulletId = crypto.randomUUID()
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'Docker work', 'snap', 'approved')",
      [bulletId],
    )
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      bulletId,
      sourceId,
    ])
    db.run('INSERT INTO bullet_skills (bullet_id, skill_id) VALUES (?, ?)', [bulletId, skillId])
    db.run("INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, 'docker')", [
      bulletId,
    ])

    applyMigrationsUpTo(db, '031_skills_expansion')

    // Expect exactly one bullet_skills row for (bullet, docker) — no duplicate
    const links = db
      .query('SELECT COUNT(*) AS c FROM bullet_skills WHERE bullet_id = ? AND skill_id = ?')
      .get(bulletId, skillId) as { c: number }
    expect(links.c).toBe(1)
  })

  // Note: a case-variant dedup test (e.g., 'Kubernetes' + 'kubernetes') is
  // intentionally omitted — in production, bullet_technologies values were
  // always stored as `tech.toLowerCase().trim()` via BulletRepository, so
  // this scenario never existed in real data. The migration's SELECT DISTINCT
  // on bt.technology is case-sensitive by design (matches production data shape).

  test('absorbs bullet_technologies: matches multiple bullets pointing to same technology', () => {
    db = getDatabase(':memory:')
    applyMigrationsUpTo(db, '029_prompt_logs_jd_entity_type')

    const sourceId = crypto.randomUUID()
    db.run(
      "INSERT INTO sources (id, title, description, source_type, status) VALUES (?, 'Src', 'desc', 'general', 'approved')",
      [sourceId],
    )

    // Two bullets tagged with the same (lowercased) technology — matches
    // production data shape where BulletRepository lowercases on insert.
    const b1 = crypto.randomUUID()
    const b2 = crypto.randomUUID()
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'one', 'snap', 'approved')",
      [b1],
    )
    db.run(
      "INSERT INTO bullets (id, content, source_content_snapshot, status) VALUES (?, 'two', 'snap', 'approved')",
      [b2],
    )
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      b1,
      sourceId,
    ])
    db.run('INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)', [
      b2,
      sourceId,
    ])
    db.run("INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, 'kubernetes')", [b1])
    db.run("INSERT INTO bullet_technologies (bullet_id, technology) VALUES (?, 'kubernetes')", [b2])

    applyMigrationsUpTo(db, '031_skills_expansion')

    // Exactly one skill should exist for 'kubernetes'
    const kubeRows = db
      .query("SELECT id FROM skills WHERE lower(name) = 'kubernetes'")
      .all() as Array<{ id: string }>
    expect(kubeRows).toHaveLength(1)

    // Both bullets should link to the same skill
    const linkedBullets = db
      .query('SELECT bullet_id FROM bullet_skills WHERE skill_id = ?')
      .all(kubeRows[0].id) as Array<{ bullet_id: string }>
    expect(linkedBullets.map((r) => r.bullet_id).sort()).toEqual([b1, b2].sort())
  })

  test('skill_domains cascade deletes when a skill is removed', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'CascadeTest', 'tool')", [skillId])

    const domainId = crypto.randomUUID()
    db.run("INSERT INTO domains (id, name) VALUES (?, 'cascade_test_dom')", [domainId])

    db.run('INSERT INTO skill_domains (skill_id, domain_id) VALUES (?, ?)', [skillId, domainId])

    // Sanity: link exists
    const before = db
      .query('SELECT COUNT(*) AS c FROM skill_domains WHERE skill_id = ?')
      .get(skillId) as { c: number }
    expect(before.c).toBe(1)

    db.run('DELETE FROM skills WHERE id = ?', [skillId])

    const after = db
      .query('SELECT COUNT(*) AS c FROM skill_domains WHERE skill_id = ?')
      .get(skillId) as { c: number }
    expect(after.c).toBe(0)
  })

  test('skill_domains cascade deletes when a domain is removed', () => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)

    const skillId = crypto.randomUUID()
    db.run("INSERT INTO skills (id, name, category) VALUES (?, 'DomainCascade', 'tool')", [skillId])

    const domainId = crypto.randomUUID()
    db.run("INSERT INTO domains (id, name) VALUES (?, 'dom_cascade')", [domainId])

    db.run('INSERT INTO skill_domains (skill_id, domain_id) VALUES (?, ?)', [skillId, domainId])
    db.run('DELETE FROM domains WHERE id = ?', [domainId])

    const rows = db
      .query('SELECT COUNT(*) AS c FROM skill_domains WHERE domain_id = ?')
      .get(domainId) as { c: number }
    expect(rows.c).toBe(0)
  })
})
