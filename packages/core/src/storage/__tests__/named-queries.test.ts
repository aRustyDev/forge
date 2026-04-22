/**
 * Named queries integration test — exercises the SQLite implementations
 * through the EntityLifecycleManager.query() path.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

import { runMigrations } from '../../db/migrate'
import { SqliteAdapter } from '../adapters/sqlite-adapter'
import { SQLITE_NAMED_QUERIES } from '../adapters/sqlite-named-queries'
import { EntityLifecycleManager } from '../lifecycle-manager'
import { buildEntityMap } from '../entity-map.data'
import type {
  GetResumeWithSectionsResult,
  ListBulletsFilteredResult,
  ListDriftedBulletsResult,
  ListDriftedPerspectivesResult,
  TraceChainResult,
} from '../named-queries'

function freshStack() {
  const db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db, join(import.meta.dir, '..', '..', 'db', 'migrations'))
  const adapter = new SqliteAdapter(db, { namedQueries: SQLITE_NAMED_QUERIES })
  const elm = new EntityLifecycleManager(adapter, buildEntityMap({}))
  return { db, adapter, elm }
}

describe('Named queries', () => {
  let stack: ReturnType<typeof freshStack>
  beforeEach(() => {
    stack = freshStack()
  })

  test('traceChain returns null for unknown id', async () => {
    const r = await stack.elm.query<{ perspectiveId: string }, TraceChainResult | null>(
      'traceChain',
      { perspectiveId: 'nonexistent' },
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toBe(null)
  })

  test('traceChain returns full chain for valid perspective', async () => {
    // Build the chain: source → bullet → perspective
    const src = await stack.elm.create('sources', {
      title: 'Eng @ Co',
      description: 'Did things',
      source_type: 'role',
    })
    if (!src.ok) throw new Error('source failed')

    const bullet = await stack.elm.create('bullets', {
      content: 'Built X',
      source_content_snapshot: 'Did things',
    })
    if (!bullet.ok) throw new Error('bullet failed')

    await stack.elm.create('bullet_sources', {
      bullet_id: bullet.value.id,
      source_id: src.value.id,
      is_primary: true,
    })

    const p = await stack.elm.create('perspectives', {
      bullet_id: bullet.value.id,
      content: 'Delivered outcome X',
      framing: 'accomplishment',
    })
    if (!p.ok) throw new Error('perspective failed')

    const r = await stack.elm.query<{ perspectiveId: string }, TraceChainResult | null>(
      'traceChain',
      { perspectiveId: p.value.id },
    )
    expect(r.ok).toBe(true)
    if (!r.ok || !r.value) throw new Error('expected chain')

    expect(r.value.perspective.id).toBe(p.value.id)
    expect(r.value.perspective.framing).toBe('accomplishment')
    expect(r.value.bullet.id).toBe(bullet.value.id)
    expect(r.value.bullet.content).toBe('Built X')
    expect(r.value.sources).toHaveLength(1)
    expect(r.value.sources[0]!.id).toBe(src.value.id)
    expect(r.value.sources[0]!.is_primary).toBe(true)
  })

  test('listBulletsFiltered filters by status', async () => {
    await stack.elm.create('bullets', {
      content: 'a',
      source_content_snapshot: 's',
      status: 'in_review',
    })
    await stack.elm.create('bullets', {
      content: 'b',
      source_content_snapshot: 's',
      status: 'approved',
    })
    await stack.elm.create('bullets', {
      content: 'c',
      source_content_snapshot: 's',
      status: 'approved',
    })

    const r = await stack.elm.query<
      { status: string },
      ListBulletsFilteredResult
    >('listBulletsFiltered', { status: 'approved' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.total).toBe(2)
    expect(r.value.rows.every((b) => b.status === 'approved')).toBe(true)
  })

  test('listBulletsFiltered filters by sourceId via junction join', async () => {
    const src1 = await stack.elm.create('sources', { title: 't1', description: 'd1' })
    const src2 = await stack.elm.create('sources', { title: 't2', description: 'd2' })
    if (!src1.ok || !src2.ok) throw new Error('sources failed')

    const b1 = await stack.elm.create('bullets', {
      content: 'b1', source_content_snapshot: 'd1',
    })
    const b2 = await stack.elm.create('bullets', {
      content: 'b2', source_content_snapshot: 'd2',
    })
    const b3 = await stack.elm.create('bullets', {
      content: 'b3', source_content_snapshot: 'd1',
    })
    if (!b1.ok || !b2.ok || !b3.ok) throw new Error('bullets failed')

    await stack.elm.create('bullet_sources', { bullet_id: b1.value.id, source_id: src1.value.id })
    await stack.elm.create('bullet_sources', { bullet_id: b3.value.id, source_id: src1.value.id })
    await stack.elm.create('bullet_sources', { bullet_id: b2.value.id, source_id: src2.value.id })

    const r = await stack.elm.query<
      { sourceId: string },
      ListBulletsFilteredResult
    >('listBulletsFiltered', { sourceId: src1.value.id })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.total).toBe(2)
    const ids = r.value.rows.map((b) => b.id).sort()
    expect(ids).toEqual([b1.value.id, b3.value.id].sort())
  })

  test('listDriftedBullets finds bullets with stale source snapshots', async () => {
    const src = await stack.elm.create('sources', {
      title: 'Eng',
      description: 'Original desc',
      source_type: 'role',
    })
    if (!src.ok) throw new Error('source failed')

    const b = await stack.elm.create('bullets', {
      content: 'Did X',
      source_content_snapshot: 'Original desc',
    })
    if (!b.ok) throw new Error('bullet failed')

    await stack.elm.create('bullet_sources', {
      bullet_id: b.value.id,
      source_id: src.value.id,
      is_primary: true,
    })

    // No drift yet
    const r1 = await stack.elm.query<Record<string, unknown>, ListDriftedBulletsResult>(
      'listDriftedBullets', {},
    )
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.value.rows).toHaveLength(0)

    // Create drift by updating source
    await stack.elm.update('sources', src.value.id, { description: 'Changed desc' })

    const r2 = await stack.elm.query<Record<string, unknown>, ListDriftedBulletsResult>(
      'listDriftedBullets', {},
    )
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.value.rows).toHaveLength(1)
    expect(r2.value.rows[0].bullet_id).toBe(b.value.id)
    expect(r2.value.rows[0].source_content_snapshot).toBe('Original desc')
    expect(r2.value.rows[0].current_description).toBe('Changed desc')
  })

  test('listDriftedPerspectives finds perspectives with stale bullet snapshots', async () => {
    const src = await stack.elm.create('sources', {
      title: 'Eng',
      description: 'd',
      source_type: 'role',
    })
    if (!src.ok) throw new Error('source failed')

    const b = await stack.elm.create('bullets', {
      content: 'Original content',
      source_content_snapshot: 'd',
    })
    if (!b.ok) throw new Error('bullet failed')

    await stack.elm.create('bullet_sources', {
      bullet_id: b.value.id,
      source_id: src.value.id,
      is_primary: true,
    })

    const p = await stack.elm.create('perspectives', {
      bullet_id: b.value.id,
      content: 'Perspective',
      framing: 'accomplishment',
    })
    if (!p.ok) throw new Error('perspective failed')

    // No drift yet — perspective's bullet_content_snapshot should match bullet content
    // Note: the hook may set bullet_content_snapshot automatically
    // Update bullet to create drift
    await stack.elm.update('bullets', b.value.id, { content: 'Changed content' })

    const r = await stack.elm.query<Record<string, unknown>, ListDriftedPerspectivesResult>(
      'listDriftedPerspectives', {},
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.rows).toHaveLength(1)
    expect(r.value.rows[0].perspective_id).toBe(p.value.id)
    expect(r.value.rows[0].current_content).toBe('Changed content')
  })

  test('getResumeWithSections builds nested shape', async () => {
    const resume = await stack.elm.create('resumes', {
      name: 'Test',
      target_role: 'SWE',
      target_employer: 'Acme',
      archetype: 'swe',
    })
    if (!resume.ok) throw new Error('resume failed')

    const section1 = await stack.elm.create('resume_sections', {
      resume_id: resume.value.id,
      title: 'Experience',
      entry_type: 'experience',
      position: 0,
    })
    const section2 = await stack.elm.create('resume_sections', {
      resume_id: resume.value.id,
      title: 'Skills',
      entry_type: 'skills',
      position: 1,
    })
    if (!section1.ok || !section2.ok) throw new Error('sections failed')

    // Add an entry to section1 — a freeform entry without perspective
    await stack.elm.create('resume_entries', {
      resume_id: resume.value.id,
      section_id: section1.value.id,
      content: 'Built platform X',
      position: 0,
    })

    const r = await stack.elm.query<
      { resumeId: string },
      GetResumeWithSectionsResult | null
    >('getResumeWithSections', { resumeId: resume.value.id })
    expect(r.ok).toBe(true)
    if (!r.ok || !r.value) throw new Error('expected result')

    expect(r.value.sections).toHaveLength(2)
    expect(r.value.sections[0]!.title).toBe('Experience')
    expect(r.value.sections[0]!.entries).toHaveLength(1)
    expect(r.value.sections[0]!.entries[0]!.content).toBe('Built platform X')
    expect(r.value.sections[1]!.title).toBe('Skills')
    expect(r.value.sections[1]!.entries).toHaveLength(0)
  })
})
