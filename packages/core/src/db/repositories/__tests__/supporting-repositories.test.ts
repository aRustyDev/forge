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
import { createTestDb, seedDomain } from '../../__tests__/helpers'
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
    // Phase 89: category defaults to 'other' when not specified (was nullable pre-migration 031)
    expect(skill.category).toBe('other')
  })

  test('create with category', () => {
    const skill = SkillRepo.create(db, {
      name: 'Kubernetes',
      category: 'tool',
    })

    expect(skill.category).toBe('tool')
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
    SkillRepo.create(db, { name: 'Docker', category: 'tool' })

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
      category: 'tool',
    })
    const second = SkillRepo.getOrCreate(db, {
      name: 'Terraform',
      category: 'tool',
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

  // Phase 89: skill ↔ domain junction (migration 031)
  describe('Skill ↔ Domain junction', () => {
    test('addDomain links a skill to a domain', () => {
      const skill = SkillRepo.create(db, { name: 'Terraform', category: 'tool' })
      const domainId = seedDomain(db, { name: 'cloud_ops' })

      SkillRepo.addDomain(db, skill.id, domainId)
      const domains = SkillRepo.getDomains(db, skill.id)

      expect(domains).toHaveLength(1)
      expect(domains[0].id).toBe(domainId)
      expect(domains[0].name).toBe('cloud_ops')
    })

    test('addDomain is idempotent', () => {
      const skill = SkillRepo.create(db, { name: 'Python' })
      const domainId = seedDomain(db, { name: 'data_sci' })

      SkillRepo.addDomain(db, skill.id, domainId)
      SkillRepo.addDomain(db, skill.id, domainId)
      SkillRepo.addDomain(db, skill.id, domainId)

      expect(SkillRepo.getDomains(db, skill.id)).toHaveLength(1)
    })

    test('removeDomain unlinks a skill from a domain', () => {
      const skill = SkillRepo.create(db, { name: 'Rust' })
      const domainId = seedDomain(db, { name: 'systems_test' })

      SkillRepo.addDomain(db, skill.id, domainId)
      expect(SkillRepo.getDomains(db, skill.id)).toHaveLength(1)

      SkillRepo.removeDomain(db, skill.id, domainId)
      expect(SkillRepo.getDomains(db, skill.id)).toHaveLength(0)
    })

    test('removeDomain is a no-op when the link does not exist', () => {
      const skill = SkillRepo.create(db, { name: 'Go' })
      const domainId = seedDomain(db, { name: 'no_link_domain' })

      // Should not throw even though no link exists
      SkillRepo.removeDomain(db, skill.id, domainId)
      expect(SkillRepo.getDomains(db, skill.id)).toHaveLength(0)
    })

    test('getDomains returns all linked domains ordered by name', () => {
      const skill = SkillRepo.create(db, { name: 'K8s' })
      const d1 = seedDomain(db, { name: 'zulu_ops' })
      const d2 = seedDomain(db, { name: 'alpha_ops' })
      const d3 = seedDomain(db, { name: 'mike_ops' })

      SkillRepo.addDomain(db, skill.id, d1)
      SkillRepo.addDomain(db, skill.id, d2)
      SkillRepo.addDomain(db, skill.id, d3)

      const domains = SkillRepo.getDomains(db, skill.id)
      expect(domains.map((d) => d.name)).toEqual(['alpha_ops', 'mike_ops', 'zulu_ops'])
    })

    test('getWithDomains returns the skill plus its linked domains', () => {
      const skill = SkillRepo.create(db, { name: 'Docker', category: 'tool' })
      const domainId = seedDomain(db, { name: 'containers_dom' })
      SkillRepo.addDomain(db, skill.id, domainId)

      const hydrated = SkillRepo.getWithDomains(db, skill.id)

      expect(hydrated).not.toBeNull()
      expect(hydrated!.id).toBe(skill.id)
      expect(hydrated!.name).toBe('Docker')
      expect(hydrated!.category).toBe('tool')
      expect(hydrated!.domains).toHaveLength(1)
      expect(hydrated!.domains[0].id).toBe(domainId)
    })

    test('getWithDomains returns null for nonexistent skill', () => {
      expect(SkillRepo.getWithDomains(db, crypto.randomUUID())).toBeNull()
    })

    test('listWithDomains returns all skills with their domains populated', () => {
      const s1 = SkillRepo.create(db, { name: 'TypeScript', category: 'language' })
      const s2 = SkillRepo.create(db, { name: 'Bash', category: 'language' })
      const d1 = seedDomain(db, { name: 'frontend_lwd' })
      const d2 = seedDomain(db, { name: 'shell_lwd' })

      SkillRepo.addDomain(db, s1.id, d1)
      SkillRepo.addDomain(db, s2.id, d2)

      const all = SkillRepo.listWithDomains(db)
      const bySkillName = new Map(all.map((s) => [s.name, s]))

      expect(bySkillName.get('TypeScript')!.domains).toHaveLength(1)
      expect(bySkillName.get('TypeScript')!.domains[0].name).toBe('frontend_lwd')
      expect(bySkillName.get('Bash')!.domains).toHaveLength(1)
      expect(bySkillName.get('Bash')!.domains[0].name).toBe('shell_lwd')
    })

    test('list with domain_id filter returns only skills linked to that domain', () => {
      const s1 = SkillRepo.create(db, { name: 'Postgres', category: 'platform' })
      const s2 = SkillRepo.create(db, { name: 'Redis', category: 'platform' })
      const s3 = SkillRepo.create(db, { name: 'Figma', category: 'tool' })
      const dbDomain = seedDomain(db, { name: 'database_eng' })
      const designDomain = seedDomain(db, { name: 'design_eng' })

      SkillRepo.addDomain(db, s1.id, dbDomain)
      SkillRepo.addDomain(db, s2.id, dbDomain)
      SkillRepo.addDomain(db, s3.id, designDomain)

      const dbSkills = SkillRepo.list(db, { domain_id: dbDomain })
      expect(dbSkills).toHaveLength(2)
      expect(dbSkills.map((s) => s.name).sort()).toEqual(['Postgres', 'Redis'])

      const designSkills = SkillRepo.list(db, { domain_id: designDomain })
      expect(designSkills).toHaveLength(1)
      expect(designSkills[0].name).toBe('Figma')
    })

    test('list combines category and domain_id filters', () => {
      const s1 = SkillRepo.create(db, { name: 'Ruby', category: 'language' })
      const s2 = SkillRepo.create(db, { name: 'Kafka', category: 'platform' })
      const s3 = SkillRepo.create(db, { name: 'SAS', category: 'language' })
      const domainId = seedDomain(db, { name: 'combined_dom' })

      SkillRepo.addDomain(db, s1.id, domainId)
      SkillRepo.addDomain(db, s2.id, domainId)
      SkillRepo.addDomain(db, s3.id, domainId)

      const languagesInDomain = SkillRepo.list(db, {
        category: 'language',
        domain_id: domainId,
      })
      expect(languagesInDomain).toHaveLength(2)
      expect(languagesInDomain.map((s) => s.name).sort()).toEqual(['Ruby', 'SAS'])
    })

    test('deleting a skill cascades and removes its domain links', () => {
      const skill = SkillRepo.create(db, { name: 'Ephemeral' })
      const domainId = seedDomain(db, { name: 'ephemeral_dom' })
      SkillRepo.addDomain(db, skill.id, domainId)

      expect(
        (db.query('SELECT COUNT(*) AS c FROM skill_domains WHERE skill_id = ?').get(skill.id) as { c: number }).c,
      ).toBe(1)

      SkillRepo.del(db, skill.id)

      expect(
        (db.query('SELECT COUNT(*) AS c FROM skill_domains WHERE skill_id = ?').get(skill.id) as { c: number }).c,
      ).toBe(0)
    })

    test('findByCategory returns only skills with the given category', () => {
      SkillRepo.create(db, { name: 'C', category: 'language' })
      SkillRepo.create(db, { name: 'Cpp', category: 'language' })
      SkillRepo.create(db, { name: 'Scrum', category: 'methodology' })

      const langs = SkillRepo.findByCategory(db, 'language')
      expect(langs).toHaveLength(2)
      expect(langs.every((s) => s.category === 'language')).toBe(true)
    })
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
