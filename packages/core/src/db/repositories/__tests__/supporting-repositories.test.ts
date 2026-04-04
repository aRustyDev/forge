/**
 * Tests for the supporting repositories:
 *   - SkillRepository
 *   - PromptLogRepository
 *
 * EmployerRepository and ProjectRepository have been removed:
 *   - employers table was replaced by organizations in 002_schema_evolution.sql
 *   - projects table was dropped (subsumed by source_projects)
 *   - See OrganizationRepository for the replacement
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../__tests__/helpers'
import * as SkillRepo from '../skill-repository'
import * as PromptLogRepo from '../prompt-log-repository'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let db: Database

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

// ===========================================================================
// SkillRepository
// ===========================================================================

describe('SkillRepository', () => {
  test('create returns a skill with generated id', () => {
    const skill = SkillRepo.create(db, { name: 'TypeScript' })

    expect(skill.id).toHaveLength(36)
    expect(skill.name).toBe('TypeScript')
    expect(skill.category).toBeNull()
  })

  test('create with category', () => {
    const skill = SkillRepo.create(db, {
      name: 'Kubernetes',
      category: 'infrastructure',
    })

    expect(skill.category).toBe('infrastructure')
  })

  test('get returns the skill by id', () => {
    const skill = SkillRepo.create(db, { name: 'Go' })
    const fetched = SkillRepo.get(db, skill.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(skill.id)
    expect(fetched!.name).toBe('Go')
  })

  test('get returns null for nonexistent id', () => {
    expect(SkillRepo.get(db, crypto.randomUUID())).toBeNull()
  })

  test('list returns all skills ordered by name', () => {
    SkillRepo.create(db, { name: 'Zig' })
    SkillRepo.create(db, { name: 'Ada' })
    SkillRepo.create(db, { name: 'Rust' })

    const all = SkillRepo.list(db)
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Ada')
    expect(all[1].name).toBe('Rust')
    expect(all[2].name).toBe('Zig')
  })

  test('list with category filter returns only matching skills', () => {
    SkillRepo.create(db, { name: 'TypeScript', category: 'language' })
    SkillRepo.create(db, { name: 'Python', category: 'language' })
    SkillRepo.create(db, { name: 'Docker', category: 'infrastructure' })

    const languages = SkillRepo.list(db, { category: 'language' })
    expect(languages).toHaveLength(2)
    expect(languages.every((s) => s.name === 'TypeScript' || s.name === 'Python')).toBe(
      true,
    )
  })

  test('getOrCreate creates a new skill when name does not exist', () => {
    const skill = SkillRepo.getOrCreate(db, { name: 'Terraform' })

    expect(skill.id).toHaveLength(36)
    expect(skill.name).toBe('Terraform')
  })

  test('getOrCreate returns existing skill when name already exists (idempotent)', () => {
    const first = SkillRepo.getOrCreate(db, {
      name: 'Terraform',
      category: 'infrastructure',
    })
    const second = SkillRepo.getOrCreate(db, {
      name: 'Terraform',
      category: 'infrastructure',
    })

    expect(second.id).toBe(first.id)
    expect(second.name).toBe(first.name)
  })

  test('getOrCreate called twice with same name returns same id', () => {
    const a = SkillRepo.getOrCreate(db, { name: 'SQLite' })
    const b = SkillRepo.getOrCreate(db, { name: 'SQLite' })

    expect(a.id).toBe(b.id)
  })

  test('delete removes the skill', () => {
    const skill = SkillRepo.create(db, { name: 'Temp' })
    SkillRepo.del(db, skill.id)

    expect(SkillRepo.get(db, skill.id)).toBeNull()
  })
})

// ===========================================================================
// PromptLogRepository
// ===========================================================================

describe('PromptLogRepository', () => {
  test('create returns a prompt log with generated id and created_at', () => {
    const bulletId = crypto.randomUUID()
    const log = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: bulletId,
      prompt_template: 'derive-bullet-v1',
      prompt_input: 'Given this source...',
      raw_response: '{"content": "Led migration..."}',
    })

    expect(log.id).toHaveLength(36)
    expect(log.entity_type).toBe('bullet')
    expect(log.entity_id).toBe(bulletId)
    expect(log.prompt_template).toBe('derive-bullet-v1')
    expect(log.prompt_input).toBe('Given this source...')
    expect(log.raw_response).toBe('{"content": "Led migration..."}')
    expect(log.created_at).toBeTruthy()
  })

  test('getByEntity returns logs for the specified entity in chronological order', () => {
    const bulletId = crypto.randomUUID()

    // Create logs with slight delay markers in template to confirm ordering
    const log1 = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: bulletId,
      prompt_template: 'template-1',
      prompt_input: 'input-1',
      raw_response: 'response-1',
    })

    const log2 = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: bulletId,
      prompt_template: 'template-2',
      prompt_input: 'input-2',
      raw_response: 'response-2',
    })

    const logs = PromptLogRepo.getByEntity(db, 'bullet', bulletId)

    expect(logs).toHaveLength(2)
    expect(logs[0].id).toBe(log1.id)
    expect(logs[1].id).toBe(log2.id)
    expect(logs[0].prompt_template).toBe('template-1')
    expect(logs[1].prompt_template).toBe('template-2')
  })

  test('getByEntity returns empty array when no logs exist', () => {
    const logs = PromptLogRepo.getByEntity(db, 'bullet', crypto.randomUUID())
    expect(logs).toHaveLength(0)
  })

  test('getByEntity filters by entity_type and entity_id', () => {
    const bulletId = crypto.randomUUID()
    const perspectiveId = crypto.randomUUID()

    PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: bulletId,
      prompt_template: 'bullet-tpl',
      prompt_input: 'bullet-input',
      raw_response: 'bullet-response',
    })

    PromptLogRepo.create(db, {
      entity_type: 'perspective',
      entity_id: perspectiveId,
      prompt_template: 'perspective-tpl',
      prompt_input: 'perspective-input',
      raw_response: 'perspective-response',
    })

    const bulletLogs = PromptLogRepo.getByEntity(db, 'bullet', bulletId)
    expect(bulletLogs).toHaveLength(1)
    expect(bulletLogs[0].entity_type).toBe('bullet')

    const perspectiveLogs = PromptLogRepo.getByEntity(db, 'perspective', perspectiveId)
    expect(perspectiveLogs).toHaveLength(1)
    expect(perspectiveLogs[0].entity_type).toBe('perspective')
  })

  test('multiple logs for same entity are returned in chronological order', () => {
    const entityId = crypto.randomUUID()

    // Insert 3 logs for the same entity
    const log1 = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: entityId,
      prompt_template: 'v1',
      prompt_input: 'attempt-1',
      raw_response: 'response-1',
    })
    const log2 = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: entityId,
      prompt_template: 'v2',
      prompt_input: 'attempt-2',
      raw_response: 'response-2',
    })
    const log3 = PromptLogRepo.create(db, {
      entity_type: 'bullet',
      entity_id: entityId,
      prompt_template: 'v3',
      prompt_input: 'attempt-3',
      raw_response: 'response-3',
    })

    const logs = PromptLogRepo.getByEntity(db, 'bullet', entityId)

    expect(logs).toHaveLength(3)
    // Chronological: oldest first
    expect(logs[0].id).toBe(log1.id)
    expect(logs[1].id).toBe(log2.id)
    expect(logs[2].id).toBe(log3.id)
  })
})
