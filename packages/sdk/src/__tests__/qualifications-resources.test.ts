/**
 * SDK resource acceptance tests for Qualifications (Phase 86 T86.3 + T86.4).
 *
 * Acceptance criteria:
 *   T86.3 — All 5 CredentialsResource methods implemented following
 *           existing SDK resource patterns + return types match core types
 *   T86.4 — All 7 CertificationsResource methods implemented;
 *           list/get return the WithSkills variant
 *
 * Tests mock global fetch and assert that each SDK method:
 *   1. Hits the correct URL with the correct HTTP method
 *   2. Sends the correct body (where applicable)
 *   3. Unwraps the {data} envelope into Result<T>
 */

import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { ForgeClient } from '../client'

// ---------------------------------------------------------------------------
// Helpers (mirrors resources.test.ts)
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
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

describe('Qualifications SDK resources', () => {
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

  // ────────────────────────────────────────────────────────────────
  // T86.3 — CredentialsResource
  // ────────────────────────────────────────────────────────────────

  describe('credentials', () => {
    const sampleClearance = {
      id: 'cred-1',
      credential_type: 'clearance',
      label: 'TS/SCI',
      status: 'active',
      organization_id: null,
      details: {
        level: 'top_secret',
        polygraph: 'ci',
        clearance_type: 'personnel',
        access_programs: ['sci'],
      },
      issued_date: null,
      expiry_date: null,
      created_at: '2026-04-05T00:00:00Z',
      updated_at: '2026-04-05T00:00:00Z',
    }

    it('client exposes credentials as CredentialsResource', () => {
      expect(client.credentials).toBeDefined()
    })

    it('list() sends GET /api/credentials', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: [sampleClearance] })),
      )

      const result = await client.credentials.list()

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/credentials')
      expect(calledInit(fetchMock).method).toBe('GET')
      expect(result).toEqual({ ok: true, data: [sampleClearance] as any })
    })

    it('list({type}) appends ?type= query param', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: [sampleClearance] })),
      )

      await client.credentials.list({ type: 'clearance' })

      const url = calledUrl(fetchMock)
      expect(url).toContain('/api/credentials')
      expect(url).toContain('type=clearance')
    })

    it('get(id) sends GET /api/credentials/:id', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleClearance })),
      )

      const result = await client.credentials.get('cred-1')

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/credentials/cred-1')
      expect(calledInit(fetchMock).method).toBe('GET')
      expect(result).toEqual({ ok: true, data: sampleClearance as any })
    })

    it('create(input) sends POST /api/credentials with body', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleClearance }, { status: 201 })),
      )

      const result = await client.credentials.create({
        credential_type: 'clearance',
        label: 'TS/SCI',
        details: {
          level: 'top_secret',
          polygraph: 'ci',
          clearance_type: 'personnel',
          access_programs: ['sci'],
        },
      })

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/credentials')
      expect(calledInit(fetchMock).method).toBe('POST')
      const body = JSON.parse(calledInit(fetchMock).body as string)
      expect(body.credential_type).toBe('clearance')
      expect(body.label).toBe('TS/SCI')
      expect(body.details.level).toBe('top_secret')
      expect(result.ok).toBe(true)
    })

    it('update(id, input) sends PATCH /api/credentials/:id', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: { ...sampleClearance, label: 'Updated' } })),
      )

      await client.credentials.update('cred-1', { label: 'Updated' })

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/credentials/cred-1')
      expect(calledInit(fetchMock).method).toBe('PATCH')
      expect(JSON.parse(calledInit(fetchMock).body as string)).toEqual({ label: 'Updated' })
    })

    it('update(id, {details: partial}) sends partial details payload', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleClearance })),
      )

      await client.credentials.update('cred-1', {
        details: { polygraph: 'full_scope' } as any,
      })

      const body = JSON.parse(calledInit(fetchMock).body as string)
      expect(body.details).toEqual({ polygraph: 'full_scope' })
    })

    it('delete(id) sends DELETE /api/credentials/:id', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(noContentResponse()))

      const result = await client.credentials.delete('cred-1')

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/credentials/cred-1')
      expect(calledInit(fetchMock).method).toBe('DELETE')
      expect(result.ok).toBe(true)
    })

    it('propagates error envelope from server', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            { error: { code: 'NOT_FOUND', message: 'Credential cred-missing not found' } },
            { status: 404 },
          ),
        ),
      )

      const result = await client.credentials.get('cred-missing')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  // ────────────────────────────────────────────────────────────────
  // T86.4 — CertificationsResource
  // ────────────────────────────────────────────────────────────────

  describe('certifications', () => {
    const sampleCert = {
      id: 'cert-1',
      name: 'CISSP',
      issuer: 'ISC2',
      date_earned: '2024-01-15',
      expiry_date: '2027-01-15',
      credential_id: 'CISSP-123',
      credential_url: null,
      education_source_id: null,
      created_at: '2026-04-05T00:00:00Z',
      updated_at: '2026-04-05T00:00:00Z',
    }

    const sampleCertWithSkills = {
      ...sampleCert,
      skills: [
        {
          id: 'skill-1',
          name: 'Security',
          category: 'methodology',
          notes: null,
        },
      ],
    }

    it('client exposes certifications as CertificationsResource', () => {
      expect(client.certifications).toBeDefined()
    })

    it('list() sends GET /api/certifications and returns WithSkills', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: [sampleCertWithSkills] })),
      )

      const result = await client.certifications.list()

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications')
      expect(calledInit(fetchMock).method).toBe('GET')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].skills).toBeInstanceOf(Array)
        expect(result.data[0].skills[0].name).toBe('Security')
      }
    })

    it('get(id) sends GET /api/certifications/:id and returns WithSkills', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleCertWithSkills })),
      )

      const result = await client.certifications.get('cert-1')

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications/cert-1')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.skills).toBeInstanceOf(Array)
      }
    })

    it('create(input) sends POST /api/certifications with body', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleCert }, { status: 201 })),
      )

      await client.certifications.create({
        name: 'CISSP',
        issuer: 'ISC2',
        date_earned: '2024-01-15',
      })

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications')
      expect(calledInit(fetchMock).method).toBe('POST')
      const body = JSON.parse(calledInit(fetchMock).body as string)
      expect(body.name).toBe('CISSP')
      expect(body.issuer).toBe('ISC2')
    })

    it('update(id, input) sends PATCH /api/certifications/:id', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: { ...sampleCert, name: 'Updated' } })),
      )

      await client.certifications.update('cert-1', { name: 'Updated' })

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications/cert-1')
      expect(calledInit(fetchMock).method).toBe('PATCH')
      expect(JSON.parse(calledInit(fetchMock).body as string)).toEqual({ name: 'Updated' })
    })

    it('delete(id) sends DELETE /api/certifications/:id', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(noContentResponse()))

      const result = await client.certifications.delete('cert-1')

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications/cert-1')
      expect(calledInit(fetchMock).method).toBe('DELETE')
      expect(result.ok).toBe(true)
    })

    it('addSkill(certId, skillId) POSTs to /skills subresource with body', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: sampleCertWithSkills })),
      )

      const result = await client.certifications.addSkill('cert-1', 'skill-1')

      expect(calledUrl(fetchMock)).toBe('http://localhost:3000/api/certifications/cert-1/skills')
      expect(calledInit(fetchMock).method).toBe('POST')
      expect(JSON.parse(calledInit(fetchMock).body as string)).toEqual({ skill_id: 'skill-1' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.skills).toBeInstanceOf(Array)
      }
    })

    it('removeSkill(certId, skillId) DELETEs the junction path', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(noContentResponse()))

      const result = await client.certifications.removeSkill('cert-1', 'skill-1')

      expect(calledUrl(fetchMock)).toBe(
        'http://localhost:3000/api/certifications/cert-1/skills/skill-1',
      )
      expect(calledInit(fetchMock).method).toBe('DELETE')
      expect(result.ok).toBe(true)
    })

    it('propagates NOT_FOUND error from server', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            { error: { code: 'NOT_FOUND', message: 'Certification cert-missing not found' } },
            { status: 404 },
          ),
        ),
      )

      const result = await client.certifications.get('cert-missing')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })
})
