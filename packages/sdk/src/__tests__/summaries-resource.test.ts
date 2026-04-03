import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { ForgeClient } from '../client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function calledUrl(fetchMock: ReturnType<typeof mock>): string {
  return (fetchMock.mock.calls[0] as [string])[0]
}

function calledInit(fetchMock: ReturnType<typeof mock>): RequestInit {
  return (fetchMock.mock.calls[0] as [string, RequestInit])[1]
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SummariesResource', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof mock>
  let client: ForgeClient

  beforeEach(() => {
    fetchMock = mock(() => Promise.resolve(new Response()))
    globalThis.fetch = fetchMock as typeof fetch
    client = new ForgeClient({ baseUrl: 'http://localhost:3000' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('toggleTemplate sends POST to /api/summaries/:id/toggle-template', async () => {
    const summary = { id: 's1', title: 'Test', is_template: 1, linked_resume_count: 0 }
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: summary })),
    )

    await client.summaries.toggleTemplate('s1')

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/summaries/s1/toggle-template')
    expect(calledInit(fetchMock).method).toBe('POST')
  })

  it('linkedResumes sends GET with pagination params', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [], pagination: { total: 0, offset: 5, limit: 10 } })),
    )

    await client.summaries.linkedResumes('s1', { limit: 10, offset: 5 })

    expect(calledUrl(fetchMock)).toContain('/api/summaries/s1/linked-resumes')
    expect(calledUrl(fetchMock)).toContain('limit=10')
    expect(calledUrl(fetchMock)).toContain('offset=5')
  })

  it('list with is_template=true sends ?is_template=1', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [], pagination: { total: 0, offset: 0, limit: 50 } })),
    )

    await client.summaries.list({ is_template: true })

    expect(calledUrl(fetchMock)).toContain('is_template=1')
    expect(calledUrl(fetchMock)).not.toContain('is_template=true')
  })

  it('list with is_template=false sends ?is_template=0', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [], pagination: { total: 0, offset: 0, limit: 50 } })),
    )

    await client.summaries.list({ is_template: false })

    expect(calledUrl(fetchMock)).toContain('is_template=0')
  })

  it('list without filter sends no query params', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [], pagination: { total: 0, offset: 0, limit: 50 } })),
    )

    await client.summaries.list()

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/summaries')
  })

  it('clone sends POST to /api/summaries/:id/clone', async () => {
    const cloned = { id: 's2', title: 'Copy of Test', is_template: 0, linked_resume_count: 0 }
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: cloned }, { status: 201 })),
    )

    await client.summaries.clone('s1')

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/summaries/s1/clone')
    expect(calledInit(fetchMock).method).toBe('POST')
  })

  it('list with pagination sends offset and limit params', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [], pagination: { total: 0, offset: 10, limit: 5 } })),
    )

    await client.summaries.list({ limit: 5, offset: 10 })

    expect(calledUrl(fetchMock)).toContain('limit=5')
    expect(calledUrl(fetchMock)).toContain('offset=10')
  })
})
