import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { ExtensionLogService } from '../extension-log-service'

describe('ExtensionLogService', () => {
  let db: Database
  let svc: ExtensionLogService

  beforeEach(() => {
    db = createTestDb()
    const elm = buildDefaultElm(db)
    svc = new ExtensionLogService(elm)
  })

  afterEach(() => {
    db.close()
  })

  test('list() returns empty array initially', async () => {
    const result = await svc.list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual([])
  })

  test('append() creates a log entry', async () => {
    const result = await svc.append({
      error_code: 'API_UNREACHABLE',
      message: 'Failed to fetch',
      layer: 'sdk',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.error_code).toBe('API_UNREACHABLE')
    expect(result.data.message).toBe('Failed to fetch')
    expect(result.data.layer).toBe('sdk')
    expect(result.data.id).toBeDefined()
    expect(result.data.created_at).toBeDefined()
  })

  test('append() stores optional fields', async () => {
    const result = await svc.append({
      error_code: 'PLUGIN_THREW',
      message: 'LinkedIn extractor failed',
      layer: 'plugin',
      plugin: 'linkedin',
      url: 'https://linkedin.com/jobs/123',
      context: { selector: '.jobs-description' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.plugin).toBe('linkedin')
    expect(result.data.url).toBe('https://linkedin.com/jobs/123')
    expect(result.data.context).toEqual({ selector: '.jobs-description' })
  })

  test('list() returns entries in descending order', async () => {
    await svc.append({ error_code: 'A', message: 'first', layer: 'sdk' })
    await svc.append({ error_code: 'B', message: 'second', layer: 'sdk' })
    await svc.append({ error_code: 'C', message: 'third', layer: 'sdk' })

    const result = await svc.list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0].error_code).toBe('C')
    expect(result.data[2].error_code).toBe('A')
  })

  test('list() supports limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await svc.append({ error_code: `E${i}`, message: `msg ${i}`, layer: 'sdk' })
    }
    const result = await svc.list({ limit: 2, offset: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.data[0].error_code).toBe('E3')
  })

  test('list() filters by error_code', async () => {
    await svc.append({ error_code: 'API_UNREACHABLE', message: 'a', layer: 'sdk' })
    await svc.append({ error_code: 'PLUGIN_THREW', message: 'b', layer: 'plugin' })
    await svc.append({ error_code: 'API_UNREACHABLE', message: 'c', layer: 'sdk' })

    const result = await svc.list({ error_code: 'API_UNREACHABLE' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.data.every(e => e.error_code === 'API_UNREACHABLE')).toBe(true)
  })

  test('list() filters by layer', async () => {
    await svc.append({ error_code: 'A', message: 'a', layer: 'sdk' })
    await svc.append({ error_code: 'B', message: 'b', layer: 'plugin' })

    const result = await svc.list({ layer: 'plugin' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].layer).toBe('plugin')
  })

  test('clear() deletes all logs', async () => {
    await svc.append({ error_code: 'A', message: 'a', layer: 'sdk' })
    await svc.append({ error_code: 'B', message: 'b', layer: 'sdk' })

    const clearResult = await svc.clear()
    expect(clearResult.ok).toBe(true)
    if (!clearResult.ok) return
    expect(clearResult.data.deleted).toBe(2)

    const listResult = await svc.list()
    expect(listResult.ok).toBe(true)
    if (!listResult.ok) return
    expect(listResult.data).toHaveLength(0)
  })

  test('append() validates required fields', async () => {
    const result = await svc.append({ error_code: '', message: 'a', layer: 'sdk' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})
