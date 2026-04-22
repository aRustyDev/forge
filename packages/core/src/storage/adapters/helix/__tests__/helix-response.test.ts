import { describe, expect, test } from 'bun:test'
import { normalizeNodeResponse, normalizeEdgeResponse, normalizeListResponse } from '../helix-response'

describe('normalizeNodeResponse', () => {
  test('returns null for empty/missing result', () => {
    expect(normalizeNodeResponse(null)).toBeNull()
    expect(normalizeNodeResponse(undefined)).toBeNull()
    expect(normalizeNodeResponse([])).toBeNull()
  })

  test('extracts single node from array result', () => {
    const raw = [{ id: 'abc', name: 'Test', status: 'draft' }]
    const result = normalizeNodeResponse(raw)
    expect(result).toEqual({ id: 'abc', name: 'Test', status: 'draft' })
  })

  test('passes through object result', () => {
    const raw = { id: 'abc', name: 'Test' }
    const result = normalizeNodeResponse(raw)
    expect(result).toEqual({ id: 'abc', name: 'Test' })
  })
})

describe('normalizeEdgeResponse', () => {
  test('flattens edge to junction row shape', () => {
    const raw = {
      from: { id: 'bullet-1' },
      to: { id: 'skill-1' },
      properties: { is_primary: true },
    }
    const result = normalizeEdgeResponse(raw, 'bullet_id', 'skill_id')
    expect(result).toEqual({
      bullet_id: 'bullet-1',
      skill_id: 'skill-1',
      is_primary: true,
    })
  })

  test('handles edge with no properties', () => {
    const raw = { from: { id: 'a' }, to: { id: 'b' } }
    const result = normalizeEdgeResponse(raw, 'source_id', 'skill_id')
    expect(result).toEqual({ source_id: 'a', skill_id: 'b' })
  })
})

describe('normalizeListResponse', () => {
  test('wraps array in ListResult shape', () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const result = normalizeListResponse(rows, 10)
    expect(result).toEqual({ rows, total: 10 })
  })

  test('handles null/undefined as empty', () => {
    const result = normalizeListResponse(null, 0)
    expect(result).toEqual({ rows: [], total: 0 })
  })

  test('uses array length as total when total not provided', () => {
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const result = normalizeListResponse(rows)
    expect(result).toEqual({ rows, total: 3 })
  })
})
