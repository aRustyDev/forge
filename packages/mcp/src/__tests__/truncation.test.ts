import { describe, test, expect } from 'bun:test'
import { truncateResponse } from '../utils/truncation'

describe('truncateResponse', () => {
  test('small response passes through unchanged', () => {
    const data = { id: '123', name: 'Test' }
    const result = truncateResponse(data)
    expect(result.truncated).toBe(false)
    expect(JSON.parse(result.text)).toEqual(data)
  })

  test('large array response truncated with metadata', () => {
    // Create an array with 1000 items, each ~100 bytes
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      content: 'x'.repeat(80),
    }))
    const result = truncateResponse(data)
    expect(result.truncated).toBe(true)
    const parsed = JSON.parse(result.text)
    expect(parsed._truncated).toBe(true)
    expect(parsed._total_items).toBe(1000)
    expect(parsed._message).toContain('truncated')
    expect(parsed.items.length).toBeLessThan(1000)
  })

  test('object with large nested array truncated', () => {
    const data = {
      summary: 'test',
      items: Array.from({ length: 500 }, (_, i) => ({
        id: `item-${i}`,
        content: 'x'.repeat(200),
      })),
    }
    const result = truncateResponse(data)
    expect(result.truncated).toBe(true)
    const parsed = JSON.parse(result.text)
    expect(parsed._truncated).toBe(true)
    expect(parsed._items_truncated).toBe(true)
    expect(parsed._items_total).toBe(500)
    expect(parsed.items.length).toBeLessThanOrEqual(20)
  })

  test('truncated result is valid JSON', () => {
    // Array case
    const arrayData = Array.from({ length: 2000 }, (_, i) => ({
      id: `item-${i}`,
      value: 'x'.repeat(100),
    }))
    const arrayResult = truncateResponse(arrayData)
    expect(() => JSON.parse(arrayResult.text)).not.toThrow()

    // Object case
    const objData = {
      results: Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        value: 'x'.repeat(100),
      })),
    }
    const objResult = truncateResponse(objData)
    expect(() => JSON.parse(objResult.text)).not.toThrow()
  })

  test('post-truncation binary reduction keeps result under 50KB', () => {
    // Create items that are each > 5KB so even 10 items would exceed 50KB
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      content: 'x'.repeat(10000),
    }))
    const result = truncateResponse(data)
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.text, 'utf8')).toBeLessThanOrEqual(50 * 1024)
  })

  test('small array passes through unchanged', () => {
    const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const result = truncateResponse(data)
    expect(result.truncated).toBe(false)
    expect(JSON.parse(result.text)).toEqual(data)
  })

  test('object with small arrays passes through unchanged', () => {
    const data = {
      items: Array.from({ length: 5 }, (_, i) => ({ id: `${i}` })),
      meta: 'test',
    }
    const result = truncateResponse(data)
    expect(result.truncated).toBe(false)
    expect(JSON.parse(result.text)).toEqual(data)
  })
})
