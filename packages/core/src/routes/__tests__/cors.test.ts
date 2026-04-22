// packages/core/src/routes/__tests__/cors.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, type TestContext } from './helpers'

describe('CORS', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('allows localhost:5173 origin (webui)', async () => {
    const res = await ctx.app.request('/api/health', {
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  test('allows chrome-extension://<id> origin', async () => {
    const extOrigin = 'chrome-extension://abcdef1234567890abcdef1234567890'
    const res = await ctx.app.request('/api/health', {
      method: 'GET',
      headers: { Origin: extOrigin },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(extOrigin)
  })

  test('allows moz-extension://<id> origin', async () => {
    const extOrigin = 'moz-extension://12345678-1234-1234-1234-123456789abc'
    const res = await ctx.app.request('/api/health', {
      method: 'GET',
      headers: { Origin: extOrigin },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(extOrigin)
  })

  test('allows 127.0.0.1:5173 origin (webui alternate)', async () => {
    const res = await ctx.app.request('/api/health', {
      method: 'GET',
      headers: { Origin: 'http://127.0.0.1:5173' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
  })

  test('allows chrome-extension://<id> preflight', async () => {
    const extOrigin = 'chrome-extension://abcdef1234567890abcdef1234567890'
    const res = await ctx.app.request('/api/organizations', {
      method: 'OPTIONS',
      headers: {
        Origin: extOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(extOrigin)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })

  test('rejects unknown cross-origin', async () => {
    const res = await ctx.app.request('/api/health', {
      method: 'GET',
      headers: { Origin: 'http://evil.example.com' },
    })
    // Hono cors() without matching origin sends request through but omits
    // the Allow-Origin header, so browser blocks it client-side.
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
