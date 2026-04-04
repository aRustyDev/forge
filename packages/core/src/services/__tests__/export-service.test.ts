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

describe('ExportService', () => {
  let db: Database
  let service: ExportService

  beforeEach(() => {
    db = createTestDb()
    service = new ExportService(db, ':memory:')
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

  test('getMarkdown returns markdown_override when set', () => {
    const resumeId = seedResume(db)
    db.run(
      `UPDATE resumes SET markdown_override = ? WHERE id = ?`,
      ['# My Custom Resume', resumeId],
    )

    const result = service.getMarkdown(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toBe('# My Custom Resume')
  })

  test('getMarkdown compiles from IR when no override', () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = service.getMarkdown(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.data).toBe('string')
    expect(result.data.length).toBeGreaterThan(0)
  })

  test('getMarkdown returns NOT_FOUND for missing resume', () => {
    const result = service.getMarkdown('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── getLatex ──────────────────────────────────────────────────────

  test('getLatex returns latex_override when set', () => {
    const resumeId = seedResume(db)
    db.run(
      `UPDATE resumes SET latex_override = ? WHERE id = ?`,
      ['\\documentclass{article}', resumeId],
    )

    const result = service.getLatex(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toBe('\\documentclass{article}')
  })

  test('getLatex compiles from IR when no override', () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const result = service.getLatex(resumeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.data).toBe('string')
    expect(result.data.length).toBeGreaterThan(0)
  })

  test('getLatex returns NOT_FOUND for missing resume', () => {
    const result = service.getLatex('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── exportData ────────────────────────────────────────────────────

  test('exportData returns sources', () => {
    seedSource(db)
    seedSource(db, { title: 'Source 2' })

    const result = service.exportData(['sources'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.sources).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['sources'])
  })

  test('exportData returns bullets', () => {
    const sourceId = seedSource(db)
    seedBullet(db, [{ id: sourceId }])

    const result = service.exportData(['bullets'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.bullets).toHaveLength(1)
    expect(result.data.forge_export.entities).toEqual(['bullets'])
  })

  test('exportData returns perspectives', () => {
    const sourceId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: sourceId }])
    seedPerspective(db, bulletId)

    const result = service.exportData(['perspectives'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.perspectives).toHaveLength(1)
    expect(result.data.forge_export.entities).toEqual(['perspectives'])
  })

  test('exportData returns skills', () => {
    db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, ?)", [
      crypto.randomUUID(), 'TypeScript', 'language',
    ])
    db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, ?)", [
      crypto.randomUUID(), 'Python', 'language',
    ])

    const result = service.exportData(['skills'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.skills).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['skills'])
  })

  test('exportData returns organizations', () => {
    seedOrganization(db, { name: 'Org 1' })
    seedOrganization(db, { name: 'Org 2' })

    const result = service.exportData(['organizations'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.organizations).toHaveLength(2)
    expect(result.data.forge_export.entities).toEqual(['organizations'])
  })

  test('exportData ignores unknown entity names', () => {
    const result = service.exportData(['bogus'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.entities).toEqual([])
  })

  test('exportData resolved entities reflects actual content', () => {
    seedSource(db)
    const result = service.exportData(['sources', 'bogus'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.entities).toEqual(['sources'])
    expect(result.data.sources).toHaveLength(1)
  })

  test('exportData handles missing summaries table gracefully', () => {
    // summaries table may or may not exist depending on migrations
    // Either way, calling with 'summaries' should not throw
    const result = service.exportData(['summaries'])
    expect(result.ok).toBe(true)
  })

  test('exportData handles missing job_descriptions table gracefully', () => {
    // job_descriptions table may or may not exist depending on migrations
    // Either way, calling with 'job_descriptions' should not throw
    const result = service.exportData(['job_descriptions'])
    expect(result.ok).toBe(true)
  })

  test('exportData metadata envelope has version and timestamp', () => {
    const result = service.exportData([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.forge_export.version).toBe('1.0')
    expect(result.data.forge_export.exported_at).toBeTruthy()
    expect(result.data.forge_export.entities).toEqual([])
  })
})
