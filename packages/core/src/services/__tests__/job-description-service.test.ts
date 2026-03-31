/**
 * Tests for JobDescriptionService -- business logic validation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization } from '../../db/__tests__/helpers'
import { JobDescriptionService } from '../job-description-service'

let db: Database
let service: JobDescriptionService

beforeEach(() => {
  db = createTestDb()
  service = new JobDescriptionService(db)
})

afterEach(() => {
  db.close()
})

describe('JobDescriptionService', () => {
  // ── create validation ───────────────────────────────────────────────

  test('create rejects empty title', () => {
    const result = service.create({ title: '', raw_text: 'text' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('Title')
    }
  })

  test('create rejects whitespace-only title', () => {
    const result = service.create({ title: '   ', raw_text: 'text' })
    expect(result.ok).toBe(false)
  })

  test('create rejects empty raw_text', () => {
    const result = service.create({ title: 'Valid', raw_text: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('raw_text')
    }
  })

  test('create rejects invalid status', () => {
    const result = service.create({
      title: 'Valid',
      raw_text: 'text',
      status: 'bogus' as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('status')
    }
  })

  test('create succeeds with valid input', () => {
    const result = service.create({
      title: 'Security Engineer',
      raw_text: 'We need someone who can...',
      status: 'interested',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Security Engineer')
      expect(result.data.status).toBe('interested')
    }
  })

  test('create succeeds with organization', () => {
    const orgId = seedOrganization(db, { name: 'Anthropic' })
    const result = service.create({
      title: 'ML Engineer',
      raw_text: 'text',
      organization_id: orgId,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.organization_name).toBe('Anthropic')
    }
  })

  // ── get ─────────────────────────────────────────────────────────────

  test('get returns NOT_FOUND for nonexistent id', () => {
    const result = service.get(crypto.randomUUID())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('get returns the job description', () => {
    const created = service.create({
      title: 'JD',
      raw_text: 'text',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('JD')
    }
  })

  // ── list ────────────────────────────────────────────────────────────

  test('list validates invalid status filter', () => {
    const result = service.list({ status: 'invalid' as any })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('list returns paginated results', () => {
    service.create({ title: 'A', raw_text: 'text' })
    service.create({ title: 'B', raw_text: 'text' })

    const result = service.list(undefined, 0, 50)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
    }
  })

  // ── update validation ───────────────────────────────────────────────

  test('update rejects empty title', () => {
    const created = service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = service.update(created.data.id, { title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update rejects empty raw_text', () => {
    const created = service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = service.update(created.data.id, { raw_text: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update rejects invalid status', () => {
    const created = service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = service.update(created.data.id, {
      status: 'bogus' as any,
    })
    expect(result.ok).toBe(false)
  })

  test('update returns NOT_FOUND for nonexistent id', () => {
    const result = service.update(crypto.randomUUID(), { title: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('update succeeds with valid input', () => {
    const created = service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = service.update(created.data.id, {
      title: 'Updated',
      status: 'applied',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Updated')
      expect(result.data.status).toBe('applied')
    }
  })

  // ── delete ──────────────────────────────────────────────────────────

  test('delete returns NOT_FOUND for nonexistent id', () => {
    const result = service.delete(crypto.randomUUID())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('delete succeeds', () => {
    const created = service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = service.delete(created.data.id)
    expect(result.ok).toBe(true)

    const fetched = service.get(created.data.id)
    expect(fetched.ok).toBe(false)
  })
})
