/**
 * Tests for JobDescriptionService -- business logic validation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { JobDescriptionService } from '../job-description-service'

let db: Database
let service: JobDescriptionService

beforeEach(() => {
  db = createTestDb()
  service = new JobDescriptionService(buildDefaultElm(db))
})

afterEach(() => {
  db.close()
})

describe('JobDescriptionService', () => {
  // ── create validation ───────────────────────────────────────────────

  test('create rejects empty title', async () => {
    const result = await service.create({ title: '', raw_text: 'text' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('Title')
    }
  })

  test('create rejects whitespace-only title', async () => {
    const result = await service.create({ title: '   ', raw_text: 'text' })
    expect(result.ok).toBe(false)
  })

  test('create rejects empty raw_text', async () => {
    const result = await service.create({ title: 'Valid', raw_text: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('raw_text')
    }
  })

  test('create rejects invalid status', async () => {
    const result = await service.create({
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

  test('create succeeds with valid input', async () => {
    const result = await service.create({
      title: 'Security Engineer',
      raw_text: 'We need someone who can...',
      status: 'discovered',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Security Engineer')
      expect(result.data.status).toBe('discovered')
    }
  })

  test('create succeeds with organization', async () => {
    const orgId = seedOrganization(db, { name: 'Anthropic' })
    const result = await service.create({
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

  test('get returns NOT_FOUND for nonexistent id', async () => {
    const result = await service.get(crypto.randomUUID())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('get returns the job description', async () => {
    const created = await service.create({
      title: 'JD',
      raw_text: 'text',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('JD')
    }
  })

  // ── list ────────────────────────────────────────────────────────────

  test('list validates invalid status filter', async () => {
    const result = await service.list({ status: 'invalid' as any })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('list returns paginated results', async () => {
    await service.create({ title: 'A', raw_text: 'text' })
    await service.create({ title: 'B', raw_text: 'text' })

    const result = await service.list(undefined, 0, 50)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
    }
  })

  // ── update validation ───────────────────────────────────────────────

  test('update rejects empty title', async () => {
    const created = await service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = await service.update(created.data.id, { title: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update rejects empty raw_text', async () => {
    const created = await service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = await service.update(created.data.id, { raw_text: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('update rejects invalid status', async () => {
    const created = await service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = await service.update(created.data.id, {
      status: 'bogus' as any,
    })
    expect(result.ok).toBe(false)
  })

  test('update returns NOT_FOUND for nonexistent id', async () => {
    const result = await service.update(crypto.randomUUID(), { title: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('update succeeds with valid input', async () => {
    const created = await service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = await service.update(created.data.id, {
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

  test('delete returns NOT_FOUND for nonexistent id', async () => {
    const result = await service.delete(crypto.randomUUID())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('delete succeeds', async () => {
    const created = await service.create({ title: 'JD', raw_text: 'text' })
    if (!created.ok) return

    const result = await service.delete(created.data.id)
    expect(result.ok).toBe(true)

    const fetched = await service.get(created.data.id)
    expect(fetched.ok).toBe(false)
  })
})
