import { describe, test, expect } from 'bun:test'
import { mapResult, mapPaginatedResult } from '../utils/error-mapper'

describe('mapResult', () => {
  test('success: returns JSON-serialized data', () => {
    const result = mapResult({ ok: true, data: { id: '1', name: 'test' } })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.id).toBe('1')
  })

  test('NOT_FOUND: returns entity not found message', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'bullet abc-123' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Entity not found')
    expect(result.content[0].text).toContain('abc-123')
  })

  test('VALIDATION_ERROR: includes field details', () => {
    const result = mapResult({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { name: 'required' },
      },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation failed')
    expect(result.content[0].text).toContain('"name"')
  })

  test('CONFLICT: returns conflict message', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'CONFLICT', message: 'Source is locked for derivation' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Conflict')
    expect(result.content[0].text).toContain('locked')
  })

  test('AI_ERROR: returns AI-specific message', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'AI_ERROR', message: 'Claude CLI failed' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('AI derivation failed')
  })

  test('GATEWAY_TIMEOUT: returns timeout message', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'GATEWAY_TIMEOUT', message: '30s exceeded' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('timed out')
  })

  test('NETWORK_ERROR: suggests starting Forge server', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'Connection refused' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('is it running')
    expect(result.content[0].text).toContain('bun run')
  })

  test('SERVICE_UNAVAILABLE: mentions embedding service', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Embedding service unreachable' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Service unavailable')
    expect(result.content[0].text).toContain('embedding service')
  })

  test('unknown error code: returns generic format', () => {
    const result = mapResult({
      ok: false,
      error: { code: 'WEIRD_ERROR', message: 'something broke' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('[WEIRD_ERROR]')
  })
})

describe('mapPaginatedResult', () => {
  test('success: includes data and pagination', () => {
    const result = mapPaginatedResult({
      ok: true,
      data: [{ id: '1' }, { id: '2' }],
      pagination: { total: 50, offset: 0, limit: 20 },
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data).toHaveLength(2)
    expect(parsed.pagination.total).toBe(50)
  })

  test('error: maps through formatError', () => {
    const result = mapPaginatedResult({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'timeout' },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('is it running')
  })
})
