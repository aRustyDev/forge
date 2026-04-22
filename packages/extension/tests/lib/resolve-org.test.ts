import { describe, test, expect } from 'bun:test'
import { resolveOrganization } from '../../src/lib/resolve-org'

// Minimal mock types matching SDK shape
interface MockOrg { id: string; name: string }
type MockListFn = (search: string) => Promise<{ ok: true; data: MockOrg[] } | { ok: false }>
type MockCreateFn = (name: string) => Promise<{ ok: true; data: MockOrg } | { ok: false }>

function mockList(orgs: MockOrg[]): MockListFn {
  return async () => ({ ok: true as const, data: orgs })
}

function mockListFail(): MockListFn {
  return async () => ({ ok: false as const })
}

function mockCreate(id: string): MockCreateFn {
  return async (name) => ({ ok: true as const, data: { id, name } })
}

function mockCreateFail(): MockCreateFn {
  return async () => ({ ok: false as const })
}

describe('resolveOrganization', () => {
  test('returns null when companyName is null', async () => {
    const result = await resolveOrganization(null, mockList([]), mockCreate('new-id'))
    expect(result).toBeNull()
  })

  test('returns null when companyName is empty', async () => {
    const result = await resolveOrganization('', mockList([]), mockCreate('new-id'))
    expect(result).toBeNull()
  })

  test('returns org_id on exact name match (case-insensitive)', async () => {
    const orgs = [{ id: 'org-123', name: 'Anthropic' }]
    const result = await resolveOrganization('anthropic', mockList(orgs), mockCreate('new-id'))
    expect(result).toBe('org-123')
  })

  test('creates org when search returns no results', async () => {
    const result = await resolveOrganization('NewCorp', mockList([]), mockCreate('created-id'))
    expect(result).toBe('created-id')
  })

  test('returns first result when no exact match (prototype picks first)', async () => {
    const orgs = [
      { id: 'org-1', name: 'Anthropic AI' },
      { id: 'org-2', name: 'Anthropic Inc' },
    ]
    const result = await resolveOrganization('Anthropic', mockList(orgs), mockCreate('new-id'))
    expect(result).toBe('org-1')
  })

  test('returns null when search fails', async () => {
    const result = await resolveOrganization('Acme', mockListFail(), mockCreate('new-id'))
    expect(result).toBeNull()
  })

  test('returns null when create fails', async () => {
    const result = await resolveOrganization('NewCorp', mockList([]), mockCreateFail())
    expect(result).toBeNull()
  })

  test('passes linkedin_url to createOrg when provided', async () => {
    let capturedOpts: { linkedin_url?: string } | undefined
    const result = await resolveOrganization(
      'NewCorp',
      async () => ({ ok: true as const, data: [] }),
      async (name, opts) => {
        capturedOpts = opts
        return { ok: true as const, data: { id: 'new-id', name } }
      },
      { linkedin_url: 'https://www.linkedin.com/company/newcorp/' },
    )
    expect(result).toBe('new-id')
    expect(capturedOpts?.linkedin_url).toBe('https://www.linkedin.com/company/newcorp/')
  })
})
