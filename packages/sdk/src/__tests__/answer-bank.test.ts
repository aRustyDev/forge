import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { ForgeClient } from '../client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: unknown,
  init: { status?: number } = {},
): Response {
  const status = init.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 })
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

describe('AnswerBankResource', () => {
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

  it('list sends GET /api/profile/answers', async () => {
    const entries = [
      { id: 'a1', field_kind: 'gender', label: 'Gender', value: 'Male', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: entries })),
    )

    const result = await client.answerBank.list()

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/profile/answers')
    expect(calledInit(fetchMock).method).toBe('GET')
    expect(result).toEqual({ ok: true, data: entries })
  })

  it('upsert sends PUT /api/profile/answers with body', async () => {
    const entry = {
      id: 'a1', field_kind: 'work_authorization', label: 'Work Auth', value: 'US Citizen',
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: entry })),
    )

    const result = await client.answerBank.upsert({
      field_kind: 'work_authorization',
      label: 'Work Auth',
      value: 'US Citizen',
    })

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/profile/answers')
    expect(calledInit(fetchMock).method).toBe('PUT')
    expect(JSON.parse(calledInit(fetchMock).body as string)).toEqual({
      field_kind: 'work_authorization',
      label: 'Work Auth',
      value: 'US Citizen',
    })
    expect(result).toEqual({ ok: true, data: entry })
  })

  it('delete sends DELETE /api/profile/answers/:field_kind', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(noContentResponse()),
    )

    const result = await client.answerBank.delete('gender')

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/profile/answers/gender')
    expect(calledInit(fetchMock).method).toBe('DELETE')
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('delete encodes field_kind with special characters', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(noContentResponse()),
    )

    await client.answerBank.delete('race/ethnicity')

    expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/profile/answers/race%2Fethnicity')
  })

  it('resource is accessible on the client', () => {
    expect(client.answerBank).toBeDefined()
    expect(typeof client.answerBank.list).toBe('function')
    expect(typeof client.answerBank.upsert).toBe('function')
    expect(typeof client.answerBank.delete).toBe('function')
  })
})
