import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'

describe('Extension routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // -- Config routes -------------------------------------------------------

  describe('GET /extension/config', () => {
    test('returns seeded defaults', async () => {
      const res = await apiRequest(ctx.app, 'GET', '/extension/config')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.baseUrl).toBe('http://localhost:3000')
      expect(body.data.devMode).toBe(false)
      expect(body.data.enabledPlugins).toEqual(['linkedin'])
      expect(body.data.enableServerLogging).toBe(true)
    })
  })

  describe('PUT /extension/config', () => {
    test('updates config keys', async () => {
      const res = await apiRequest(ctx.app, 'PUT', '/extension/config', {
        updates: { devMode: true, enableServerLogging: false },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.devMode).toBe(true)
      expect(body.data.enableServerLogging).toBe(false)
      expect(body.data.baseUrl).toBe('http://localhost:3000')
    })

    test('returns 400 for unknown keys', async () => {
      const res = await apiRequest(ctx.app, 'PUT', '/extension/config', {
        updates: { badKey: 'value' },
      })
      expect(res.status).toBe(400)
    })

    test('returns 400 for missing updates field', async () => {
      const res = await apiRequest(ctx.app, 'PUT', '/extension/config', {})
      expect(res.status).toBe(400)
    })
  })

  // -- Log routes ----------------------------------------------------------

  describe('POST /extension/log', () => {
    test('creates a log entry and returns 201', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/extension/log', {
        error_code: 'API_UNREACHABLE',
        message: 'Failed to fetch',
        layer: 'sdk',
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.error_code).toBe('API_UNREACHABLE')
      expect(body.data.id).toBeDefined()
    })

    test('stores optional fields', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/extension/log', {
        error_code: 'PLUGIN_THREW',
        message: 'parse error',
        layer: 'plugin',
        plugin: 'linkedin',
        url: 'https://linkedin.com/jobs/123',
        context: { step: 'extract_title' },
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.plugin).toBe('linkedin')
      expect(body.data.context).toEqual({ step: 'extract_title' })
    })

    test('returns 400 for missing error_code', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/extension/log', {
        message: 'test', layer: 'sdk',
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /extension/logs', () => {
    test('returns empty array initially', async () => {
      const res = await apiRequest(ctx.app, 'GET', '/extension/logs')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
    })

    test('returns logs with pagination', async () => {
      for (const code of ['A', 'B', 'C']) {
        await apiRequest(ctx.app, 'POST', '/extension/log', {
          error_code: code, message: `msg ${code}`, layer: 'sdk',
        })
      }
      const res = await apiRequest(ctx.app, 'GET', '/extension/logs?limit=2')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    test('filters by error_code', async () => {
      await apiRequest(ctx.app, 'POST', '/extension/log', {
        error_code: 'A', message: 'm', layer: 'sdk',
      })
      await apiRequest(ctx.app, 'POST', '/extension/log', {
        error_code: 'B', message: 'm', layer: 'plugin',
      })
      const res = await apiRequest(ctx.app, 'GET', '/extension/logs?error_code=A')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].error_code).toBe('A')
    })
  })

  describe('DELETE /extension/logs', () => {
    test('clears all logs and returns 204', async () => {
      await apiRequest(ctx.app, 'POST', '/extension/log', {
        error_code: 'A', message: 'm', layer: 'sdk',
      })
      const res = await apiRequest(ctx.app, 'DELETE', '/extension/logs')
      expect(res.status).toBe(204)

      const listRes = await apiRequest(ctx.app, 'GET', '/extension/logs')
      const body = await listRes.json()
      expect(body.data).toHaveLength(0)
    })
  })
})
