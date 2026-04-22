/**
 * Tests for OrganizationService — CRUD with validation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { OrganizationService } from '../organization-service'
import { createTestDb } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'

describe('OrganizationService', () => {
  let db: Database
  let service: OrganizationService

  beforeEach(() => {
    db = createTestDb()
    service = new OrganizationService(buildDefaultElm(db))
  })
  afterEach(() => db.close())

  // -- create -----------------------------------------------------------

  test('create with valid name succeeds', async () => {
    const result = await service.create({ name: 'Anthropic', org_type: 'company' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('Anthropic')
    expect(result.data.org_type).toBe('company')
    expect(result.data.id).toHaveLength(36)
  })

  test('create with empty name fails validation', async () => {
    const result = await service.create({ name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Name')
  })

  test('create with whitespace-only name fails validation', async () => {
    const result = await service.create({ name: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('create with invalid org_type fails validation', async () => {
    const result = await service.create({ name: 'Test', org_type: 'invalid_type' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('invalid_type')
  })

  test('create with valid org_type succeeds', async () => {
    const result = await service.create({ name: 'DoD', org_type: 'government' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.org_type).toBe('government')
  })

  test('create defaults org_type to company', async () => {
    const result = await service.create({ name: 'Startup Inc' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.org_type).toBe('company')
  })

  // -- get --------------------------------------------------------------

  test('get returns existing org', async () => {
    const created = await service.create({ name: 'Test Corp' })
    if (!created.ok) return
    const result = await service.get(created.data.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('Test Corp')
  })

  test('get returns NOT_FOUND for missing org', async () => {
    const result = await service.get('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- list -------------------------------------------------------------

  test('list returns all orgs with pagination', async () => {
    await service.create({ name: 'Org A' })
    await service.create({ name: 'Org B' })
    const result = await service.list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.pagination.total).toBe(2)
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.limit).toBe(50)
  })

  test('list filters by org_type', async () => {
    await service.create({ name: 'Company A', org_type: 'company' })
    await service.create({ name: 'School B', org_type: 'education' })
    await service.create({ name: 'Company C', org_type: 'company' })

    const result = await service.list({ org_type: 'education' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('School B')
  })

  test('list filters by worked', async () => {
    await service.create({ name: 'Worked Here', worked: 1 })
    await service.create({ name: 'Never Worked' })

    const result = await service.list({ worked: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Worked Here')
  })

  // -- update -----------------------------------------------------------

  test('update with valid input succeeds', async () => {
    const created = await service.create({ name: 'Old Name' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: 'New Name' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name).toBe('New Name')
  })

  test('update with empty name fails validation', async () => {
    const created = await service.create({ name: 'Test' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update with invalid org_type fails validation', async () => {
    const created = await service.create({ name: 'Test' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { org_type: 'nope' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('update returns NOT_FOUND for missing org', async () => {
    const result = await service.update('nonexistent-id', { name: 'Whatever' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- delete -----------------------------------------------------------

  test('delete removes org', async () => {
    const created = await service.create({ name: 'To Delete' })
    if (!created.ok) return
    const result = await service.delete(created.data.id)
    expect(result.ok).toBe(true)

    const check = await service.get(created.data.id)
    expect(check.ok).toBe(false)
  })

  test('delete returns NOT_FOUND for missing org', async () => {
    const result = await service.delete('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // -- status validation (Phase 38 — kanban statuses) -------------------------

  test('create with valid kanban status "backlog" succeeds', async () => {
    const result = await service.create({ name: 'Pipeline Corp', status: 'backlog' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('backlog')
  })

  test('create with valid kanban status "researching" succeeds', async () => {
    const result = await service.create({ name: 'Research Corp', status: 'researching' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('researching')
  })

  test('create with valid kanban status "exciting" succeeds', async () => {
    const result = await service.create({ name: 'Hot Startup', status: 'exciting' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('exciting')
  })

  test('create with valid kanban status "interested" succeeds', async () => {
    const result = await service.create({ name: 'Target Corp', status: 'interested' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('interested')
  })

  test('create with valid kanban status "acceptable" succeeds', async () => {
    const result = await service.create({ name: 'Fallback Inc', status: 'acceptable' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('acceptable')
  })

  test('create with valid kanban status "excluded" succeeds', async () => {
    const result = await service.create({ name: 'Red Flag LLC', status: 'excluded' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('excluded')
  })

  test('create with old status "review" fails validation', async () => {
    const result = await service.create({ name: 'Old Status', status: 'review' as any })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('review')
  })

  test('create with old status "targeting" fails validation', async () => {
    const result = await service.create({ name: 'Old Status', status: 'targeting' as any })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('targeting')
  })

  test('create with invalid status fails validation', async () => {
    const result = await service.create({ name: 'Bad Status', status: 'bogus' as any })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('bogus')
  })

  test('create without status defaults to null', async () => {
    const result = await service.create({ name: 'No Status' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBeNull()
  })

  test('update with valid kanban status succeeds', async () => {
    const created = await service.create({ name: 'Evolving' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { status: 'researching' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('researching')
  })

  test('update with status null removes from pipeline', async () => {
    const created = await service.create({ name: 'Leaving Pipeline', status: 'backlog' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { status: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBeNull()
  })

  test('update with old status "review" fails validation', async () => {
    const created = await service.create({ name: 'Test' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { status: 'review' as any })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('review')
  })

  test('update with invalid status fails validation', async () => {
    const created = await service.create({ name: 'Test' })
    if (!created.ok) return
    const result = await service.update(created.data.id, { status: 'invalid_status' as any })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('invalid_status')
  })

  test('list filters by kanban status', async () => {
    await service.create({ name: 'Org A', status: 'backlog' })
    await service.create({ name: 'Org B', status: 'researching' })
    await service.create({ name: 'Org C', status: 'backlog' })

    const result = await service.list({ status: 'backlog' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.data.every(o => o.status === 'backlog')).toBe(true)
  })
})
