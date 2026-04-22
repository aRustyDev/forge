/**
 * Integration tests for the full storage stack:
 * SqliteAdapter → EntityLifecycleManager → real SQLite schema.
 *
 * Proves that the integrity layer correctly enforces constraints and
 * runs cascade/restrict/setNull on the actual Forge tables.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

import { runMigrations } from '../../db/migrate'
import { SqliteAdapter } from '../adapters/sqlite-adapter'
import { EntityLifecycleManager } from '../lifecycle-manager'
import { buildEntityMap } from '../entity-map.data'

function freshStack(): {
  db: Database
  adapter: SqliteAdapter
  elm: EntityLifecycleManager
} {
  const db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const migrationsDir = join(import.meta.dir, '..', '..', 'db', 'migrations')
  runMigrations(db, migrationsDir)
  const adapter = new SqliteAdapter(db)
  const elm = new EntityLifecycleManager(adapter, buildEntityMap({}))
  return { db, adapter, elm }
}

// ══════════════════════════════════════════════════════════════════════
// Basic CRUD
// ══════════════════════════════════════════════════════════════════════

describe('EntityLifecycleManager CRUD', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('create auto-generates id and applies defaults', async () => {
    const result = await stack.elm.create('sources', {
      title: 'Senior Engineer @ Acme',
      description: 'Did lots of stuff',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toMatch(/^[0-9a-f]{8}-/)

    const get = await stack.elm.get('sources', result.value.id)
    expect(get.ok).toBe(true)
    if (!get.ok) return
    expect(get.value.title).toBe('Senior Engineer @ Acme')
    expect(get.value.source_type).toBe('general') // default applied
    expect(get.value.status).toBe('draft') // default applied
    expect(get.value.updated_by).toBe('human') // default applied
    expect(typeof get.value.created_at).toBe('string')
  })

  test('create rejects missing required fields', async () => {
    const result = await stack.elm.create('sources', { title: 'No description' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('REQUIRED_VIOLATION')
    expect(result.error.field).toBe('description')
  })

  test('create rejects unknown fields', async () => {
    const result = await stack.elm.create('sources', {
      title: 't',
      description: 'd',
      bogus_field: 'x',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create rejects invalid enum', async () => {
    const result = await stack.elm.create('sources', {
      title: 't',
      description: 'd',
      status: 'not_a_valid_status',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ENUM_VIOLATION')
    expect(result.error.field).toBe('status')
  })

  test('create rejects invalid FK reference', async () => {
    const result = await stack.elm.create('skills', {
      name: 'TestSkill',
      category: 'not_a_real_category',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FK_VIOLATION')
  })

  test('create enforces uniqueness', async () => {
    const r1 = await stack.elm.create('skills', {
      name: 'Python',
      category: 'language',
    })
    expect(r1.ok).toBe(true)

    const r2 = await stack.elm.create('skills', {
      name: 'Python',
      category: 'language',
    })
    expect(r2.ok).toBe(false)
    if (r2.ok) return
    expect(r2.error.code).toBe('UNIQUE_VIOLATION')
    expect(r2.error.field).toBe('name')
  })

  test('update rejects unknown entity id', async () => {
    const result = await stack.elm.update(
      'sources',
      '00000000-0000-0000-0000-000000000000',
      { title: 'new' },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('update runs setUpdatedAt hook', async () => {
    const src = await stack.elm.create('sources', { title: 't', description: 'd' })
    expect(src.ok).toBe(true)
    if (!src.ok) return

    // Grab the initial updated_at
    const before = await stack.elm.get('sources', src.value.id)
    expect(before.ok).toBe(true)
    if (!before.ok) return
    const beforeAt = before.value.updated_at as string

    // Wait a tick so the timestamp differs
    await new Promise((r) => setTimeout(r, 1100))

    // Update any field
    const up = await stack.elm.update('sources', src.value.id, { title: 't2' })
    expect(up.ok).toBe(true)

    const after = await stack.elm.get('sources', src.value.id)
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.value.updated_at).not.toBe(beforeAt)
  })

  test('list returns rows with deserialized types', async () => {
    await stack.elm.create('skills', { name: 'Go', category: 'language' })
    await stack.elm.create('skills', { name: 'Rust', category: 'language' })

    const result = await stack.elm.list('skills', {
      where: { category: 'language' },
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.total).toBe(2)
    expect(result.value.rows[0]!.name).toBe('Go')
    expect(result.value.rows[1]!.name).toBe('Rust')
  })
})

// ══════════════════════════════════════════════════════════════════════
// Cascade deletes
// ══════════════════════════════════════════════════════════════════════

describe('Cascade deletes', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('deleting a bullet cascades bullet_sources and bullet_skills', async () => {
    // Set up: source, skill, bullet, and both junctions
    const src = await stack.elm.create('sources', {
      title: 'Source',
      description: 'desc',
    })
    expect(src.ok).toBe(true)
    if (!src.ok) return

    const skill = await stack.elm.create('skills', {
      name: 'TypeScript',
      category: 'language',
    })
    expect(skill.ok).toBe(true)
    if (!skill.ok) return

    const bullet = await stack.elm.create('bullets', {
      content: 'Built stuff',
      source_content_snapshot: 'desc',
    })
    expect(bullet.ok).toBe(true)
    if (!bullet.ok) return

    await stack.elm.create('bullet_sources', {
      bullet_id: bullet.value.id,
      source_id: src.value.id,
      is_primary: true,
    })
    await stack.elm.create('bullet_skills', {
      bullet_id: bullet.value.id,
      skill_id: skill.value.id,
    })

    // Verify both junctions exist
    const bs1 = await stack.elm.count('bullet_sources', { bullet_id: bullet.value.id })
    expect(bs1.ok && bs1.value).toBe(1)
    const bk1 = await stack.elm.count('bullet_skills', { bullet_id: bullet.value.id })
    expect(bk1.ok && bk1.value).toBe(1)

    // Delete the bullet
    const del = await stack.elm.delete('bullets', bullet.value.id)
    expect(del.ok).toBe(true)

    // Both junctions should be gone
    const bs2 = await stack.elm.count('bullet_sources', { bullet_id: bullet.value.id })
    expect(bs2.ok && bs2.value).toBe(0)
    const bk2 = await stack.elm.count('bullet_skills', { bullet_id: bullet.value.id })
    expect(bk2.ok && bk2.value).toBe(0)
  })

  test('deleting a skill cascades ALL skill junction tables', async () => {
    const skill = await stack.elm.create('skills', {
      name: 'Kubernetes',
      category: 'tool',
    })
    expect(skill.ok).toBe(true)
    if (!skill.ok) return

    // Add some references
    const src = await stack.elm.create('sources', { title: 't', description: 'd' })
    if (!src.ok) return
    await stack.elm.create('source_skills', {
      source_id: src.value.id,
      skill_id: skill.value.id,
    })

    const b = await stack.elm.create('bullets', {
      content: 'c',
      source_content_snapshot: 'd',
    })
    if (!b.ok) return
    await stack.elm.create('bullet_skills', {
      bullet_id: b.value.id,
      skill_id: skill.value.id,
    })

    // Delete the skill
    const del = await stack.elm.delete('skills', skill.value.id)
    expect(del.ok).toBe(true)

    // Junctions cascaded
    const s = await stack.elm.count('source_skills', { skill_id: skill.value.id })
    expect(s.ok && s.value).toBe(0)
    const bk = await stack.elm.count('bullet_skills', { skill_id: skill.value.id })
    expect(bk.ok && bk.value).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Restrict
// ══════════════════════════════════════════════════════════════════════

describe('Restrict deletes', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('cannot delete bullet while perspectives exist', async () => {
    const b = await stack.elm.create('bullets', {
      content: 'c',
      source_content_snapshot: 'd',
    })
    expect(b.ok).toBe(true)
    if (!b.ok) return

    const p = await stack.elm.create('perspectives', {
      bullet_id: b.value.id,
      content: 'p content',
      bullet_content_snapshot: 'c',
      framing: 'accomplishment',
    })
    expect(p.ok).toBe(true)

    const del = await stack.elm.delete('bullets', b.value.id)
    expect(del.ok).toBe(false)
    if (del.ok) return
    expect(del.error.code).toBe('RESTRICT_VIOLATION')
    expect(del.error.message).toContain('perspective')

    // Bullet should still exist
    const still = await stack.elm.get('bullets', b.value.id)
    expect(still.ok).toBe(true)
  })

  test('can delete bullet after perspectives are removed', async () => {
    const b = await stack.elm.create('bullets', {
      content: 'c',
      source_content_snapshot: 'd',
    })
    if (!b.ok) return
    const p = await stack.elm.create('perspectives', {
      bullet_id: b.value.id,
      content: 'p',
      bullet_content_snapshot: 'c',
      framing: 'accomplishment',
    })
    if (!p.ok) return

    await stack.elm.delete('perspectives', p.value.id)
    const del = await stack.elm.delete('bullets', b.value.id)
    expect(del.ok).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Set null
// ══════════════════════════════════════════════════════════════════════

describe('Set null on delete', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('deleting org nulls out source_roles.organization_id', async () => {
    const org = await stack.elm.create('organizations', { name: 'Acme Corp' })
    expect(org.ok).toBe(true)
    if (!org.ok) return

    const src = await stack.elm.create('sources', {
      title: 'Senior Engineer',
      description: 'Worked there',
      source_type: 'role',
    })
    expect(src.ok).toBe(true)
    if (!src.ok) return

    await stack.elm.create('source_roles', {
      source_id: src.value.id,
      organization_id: org.value.id,
      is_current: false,
    })

    // Delete the org
    const del = await stack.elm.delete('organizations', org.value.id)
    expect(del.ok).toBe(true)

    // source_roles row should still exist but organization_id nulled
    const role = await stack.elm.get('source_roles', src.value.id)
    // Note: source_roles uses source_id as PK, not id, so get-by-id won't work.
    // Use list instead.
    void role

    const roles = await stack.elm.list('source_roles', {
      where: { source_id: src.value.id },
    })
    expect(roles.ok).toBe(true)
    if (!roles.ok) return
    expect(roles.value.total).toBe(1)
    expect(roles.value.rows[0]!.organization_id).toBe(null)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Junction table operations (no get-by-id)
// ══════════════════════════════════════════════════════════════════════

describe('Junction tables', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('junction create/count/deleteWhere', async () => {
    const s1 = await stack.elm.create('skills', {
      name: 'Docker',
      category: 'tool',
    })
    const s2 = await stack.elm.create('skills', {
      name: 'Podman',
      category: 'tool',
    })
    const d = await stack.elm.create('domains', { name: 'devops_test' })
    if (!s1.ok || !s2.ok || !d.ok) return

    await stack.elm.create('skill_domains', {
      skill_id: s1.value.id,
      domain_id: d.value.id,
    })
    await stack.elm.create('skill_domains', {
      skill_id: s2.value.id,
      domain_id: d.value.id,
    })

    const count = await stack.elm.count('skill_domains', { domain_id: d.value.id })
    expect(count.ok && count.value).toBe(2)

    const removed = await stack.elm.deleteWhere('skill_domains', {
      skill_id: s1.value.id,
    })
    expect(removed.ok && removed.value).toBe(1)

    const after = await stack.elm.count('skill_domains', { domain_id: d.value.id })
    expect(after.ok && after.value).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Hooks
// ══════════════════════════════════════════════════════════════════════

describe('Lifecycle hooks', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('captureBulletSnapshotHook populates bullet_content_snapshot', async () => {
    const b = await stack.elm.create('bullets', {
      content: 'original bullet text',
      source_content_snapshot: 'src',
    })
    if (!b.ok) return

    // Don't pass bullet_content_snapshot; hook should fill it in
    const p = await stack.elm.create('perspectives', {
      bullet_id: b.value.id,
      content: 'perspective text',
      framing: 'responsibility',
    })
    expect(p.ok).toBe(true)
    if (!p.ok) return

    const got = await stack.elm.get('perspectives', p.value.id)
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(got.value.bullet_content_snapshot).toBe('original bullet text')
  })

  test('captureSnapshotHook on resume_entries fills perspective_content_snapshot', async () => {
    // Full chain: resume → section → entry referring to perspective
    const resume = await stack.elm.create('resumes', {
      name: 'Test Resume',
      target_role: 'SWE',
      target_employer: 'Acme',
      archetype: 'swe',
    })
    if (!resume.ok) return

    const section = await stack.elm.create('resume_sections', {
      resume_id: resume.value.id,
      title: 'Experience',
      entry_type: 'experience',
      position: 0,
    })
    if (!section.ok) return

    const b = await stack.elm.create('bullets', {
      content: 'bullet text',
      source_content_snapshot: 'src',
    })
    if (!b.ok) return

    const p = await stack.elm.create('perspectives', {
      bullet_id: b.value.id,
      content: 'perspective content here',
      bullet_content_snapshot: 'bullet text',
      framing: 'accomplishment',
    })
    if (!p.ok) return

    // Create entry without providing snapshot; hook should populate from perspective
    const entry = await stack.elm.create('resume_entries', {
      resume_id: resume.value.id,
      section_id: section.value.id,
      perspective_id: p.value.id,
      position: 0,
    })
    expect(entry.ok).toBe(true)
    if (!entry.ok) return

    const got = await stack.elm.get('resume_entries', entry.value.id)
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(got.value.perspective_content_snapshot).toBe('perspective content here')
  })
})

// ══════════════════════════════════════════════════════════════════════
// Transaction scope
// ══════════════════════════════════════════════════════════════════════

describe('Transaction scope', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('transaction commits multiple operations atomically', async () => {
    const result = await stack.elm.transaction(async (tx) => {
      const s1 = await tx.create('skills', {
        id: crypto.randomUUID(),
        name: 'Alpha',
        category: 'tool',
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      })
      const s2 = await tx.create('skills', {
        id: crypto.randomUUID(),
        name: 'Beta',
        category: 'tool',
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      })
      return [s1.id, s2.id]
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const count = await stack.elm.count('skills', {})
    expect(count.ok && count.value).toBe(2)
  })

  test('transaction rolls back on error', async () => {
    const result = await stack.elm.transaction(async (tx) => {
      await tx.create('skills', {
        id: crypto.randomUUID(),
        name: 'Gamma',
        category: 'tool',
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      })
      throw new Error('intentional failure')
    })
    expect(result.ok).toBe(false)

    const count = await stack.elm.count('skills', { name: 'Gamma' })
    expect(count.ok && count.value).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Lazy field handling
// ══════════════════════════════════════════════════════════════════════

describe('Lazy fields', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('lazy fields omitted by default, included with opts', async () => {
    const cred = await stack.elm.create('credentials', {
      credential_type: 'clearance',
      label: 'Secret',
      details: { level: 'secret', clearance_type: 'personnel' },
    })
    expect(cred.ok).toBe(true)
    if (!cred.ok) return

    // Default read: details is lazy → omitted
    const noLazy = await stack.elm.get('credentials', cred.value.id)
    expect(noLazy.ok).toBe(true)
    if (!noLazy.ok) return
    expect('details' in noLazy.value).toBe(false)

    // Opt-in: details included
    const withLazy = await stack.elm.get('credentials', cred.value.id, {
      includeLazy: true,
    })
    expect(withLazy.ok).toBe(true)
    if (!withLazy.ok) return
    expect(withLazy.value.details).toEqual({
      level: 'secret',
      clearance_type: 'personnel',
    })
  })
})
