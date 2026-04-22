import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { ExportService } from '../export-service'
import {
  createTestDb,
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
  seedResumeSection,
  seedResumeEntry,
  seedOrganization,
} from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('ExportService', () => {
  let db: Database
  let service: ExportService

  beforeEach(() => {
    db = createTestDb()
    service = new ExportService(db, ':memory:', buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── getJSON ───────────────────────────────────────────────────────

  test('getJSON returns IR for existing resume', () => {
    const resumeId = seedResume(db, { name: 'Test Resume' })
    // Need a section + entry for the IR compiler (use 'experience' as valid entry_type)
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = service.getJSON(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.resume_id).toBe(resumeId)
  })

  test('getJSON returns NOT_FOUND for missing resume', () => {
    const result = service.getJSON('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── getMarkdown ───────────────────────────────────────────────────

  test('getMarkdown returns markdown_override when set', async () => {
    const resumeId = seedResume(db)
    db.run(
      `UPDATE resumes SET markdown_override = ? WHERE id = ?`,
      ['# My Custom Resume', resumeId],
    )

    const result = await service.getMarkdown(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toBe('# My Custom Resume')
  })

  test('getMarkdown compiles from IR when no override', async () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = await service.getMarkdown(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.data).toBe('string')
    expect(result.data.length).toBeGreaterThan(0)
  })

  test('getMarkdown returns NOT_FOUND for missing resume', async () => {
    const result = await service.getMarkdown('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── getLatex ──────────────────────────────────────────────────────

  test('getLatex returns latex_override when set', async () => {
    const resumeId = seedResume(db)
    db.run(
      `UPDATE resumes SET latex_override = ? WHERE id = ?`,
      ['\\documentclass{article}', resumeId],
    )

    const result = await service.getLatex(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toBe('\\documentclass{article}')
  })

  test('getLatex compiles from IR when no override', async () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = await service.getLatex(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.data).toBe('string')
    expect(result.data.length).toBeGreaterThan(0)
  })

  test('getLatex returns NOT_FOUND for missing resume', async () => {
    const result = await service.getLatex('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── exportData ────────────────────────────────────────────────────

  test('exportData returns sources', async () => {
    seedSource(db)
    seedSource(db, { title: 'Source 2' })

    const result = await service.exportData(['sources'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.sources).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['sources'])
  })

  test('exportData returns bullets', async () => {
    const sourceId = seedSource(db)
    seedBullet(db, [{ id: sourceId }])

    const result = await service.exportData(['bullets'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets).toHaveLength(1)
    expect(result.data.forge_export.entities).toEqual(['bullets'])
  })

  test('exportData returns perspectives', async () => {
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId)

    const result = await service.exportData(['perspectives'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspectives).toHaveLength(1)
    expect(result.data.forge_export.entities).toEqual(['perspectives'])
  })

  test('exportData returns skills', async () => {
    db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, ?)", [
      crypto.randomUUID(), 'TypeScript', 'language',
    ])
    db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, ?)", [
      crypto.randomUUID(), 'Python', 'language',
    ])

    const result = await service.exportData(['skills'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.skills).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['skills'])
  })

  test('exportData returns organizations', async () => {
    seedOrganization(db, { name: 'Org 1' })
    seedOrganization(db, { name: 'Org 2' })

    const result = await service.exportData(['organizations'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.organizations).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['organizations'])
  })

  test('exportData ignores unknown entity names', async () => {
    const result = await service.exportData(['bogus'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.entities).toEqual([])
  })

  test('exportData resolved entities reflects actual content', async () => {
    seedSource(db)
    const result = await service.exportData(['sources', 'bogus'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.entities).toEqual(['sources'])
    expect(result.data.sources).toHaveLength(1)
  })

  test('exportData handles missing summaries table gracefully', async () => {
    // summaries table may or may not exist depending on migrations
    // Either way, calling with 'summaries' should not throw
    const result = await service.exportData(['summaries'])
    expect(result.ok).toBe(true)
  })

  test('exportData handles missing job_descriptions table gracefully', async () => {
    // job_descriptions table may or may not exist depending on migrations
    // Either way, calling with 'job_descriptions' should not throw
    const result = await service.exportData(['job_descriptions'])
    expect(result.ok).toBe(true)
  })

  test('exportData metadata envelope has version and timestamp', async () => {
    const result = await service.exportData([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.version).toBe('1.0')
    expect(result.data.forge_export.exported_at).toBeTruthy()
    expect(result.data.forge_export.entities).toEqual([])
  })
})
