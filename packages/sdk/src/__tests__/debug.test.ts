import { describe, expect, it, beforeEach } from 'bun:test'
import { DebugStore, isDevMode } from '../debug'
import type { SDKLogEntry } from '../debug'

function makeEntry(overrides: Partial<SDKLogEntry> = {}): SDKLogEntry {
  return {
    timestamp: new Date().toISOString(),
    direction: 'response',
    method: 'GET',
    path: '/api/resumes',
    status: 200,
    duration_ms: 10,
    ok: true,
    ...overrides,
  }
}

describe('DebugStore', () => {
  let store: DebugStore

  beforeEach(() => {
    store = new DebugStore(true)
  })

  it('push + getAll returns entries in chronological order', () => {
    store.push(makeEntry({ path: '/api/a' }))
    store.push(makeEntry({ path: '/api/b' }))
    const all = store.getAll()
    expect(all).toHaveLength(2)
    expect(all[0].path).toBe('/api/a')
    expect(all[1].path).toBe('/api/b')
  })

  it('ring buffer overflow evicts oldest entries (FIFO)', () => {
    const small = new DebugStore({ storeSize: 100, logToConsole: false })
    for (let i = 0; i < 105; i++) {
      small.push(makeEntry({ path: `/api/item-${i}` }))
    }
    const all = small.getAll()
    expect(all).toHaveLength(100)
    // First 5 should be gone
    expect(all[0].path).toBe('/api/item-5')
    expect(all[99].path).toBe('/api/item-104')
  })

  it('clear empties the buffer', () => {
    store.push(makeEntry())
    store.push(makeEntry())
    store.clear()
    expect(store.getAll()).toHaveLength(0)
  })

  it('getErrors returns only entries with ok === false', () => {
    store.push(makeEntry({ ok: true }))
    store.push(makeEntry({ ok: false, error_code: 'NOT_FOUND' }))
    store.push(makeEntry({ ok: true }))
    store.push(makeEntry({ ok: false, error_code: 'NETWORK_ERROR' }))
    const errors = store.getErrors()
    expect(errors).toHaveLength(2)
    expect(errors[0].error_code).toBe('NOT_FOUND')
    expect(errors[1].error_code).toBe('NETWORK_ERROR')
  })

  it('getByPath filters by path prefix', () => {
    store.push(makeEntry({ path: '/api/resumes/abc' }))
    store.push(makeEntry({ path: '/api/bullets/def' }))
    store.push(makeEntry({ path: '/api/resumes/xyz' }))
    const resumes = store.getByPath('/api/resumes')
    expect(resumes).toHaveLength(2)
    expect(resumes[0].path).toBe('/api/resumes/abc')
    expect(resumes[1].path).toBe('/api/resumes/xyz')
  })

  it('getSlow returns entries above threshold', () => {
    store.push(makeEntry({ duration_ms: 10 }))
    store.push(makeEntry({ duration_ms: 600 }))
    store.push(makeEntry({ duration_ms: 200 }))
    store.push(makeEntry({ duration_ms: 501 }))
    const slow = store.getSlow(500)
    expect(slow).toHaveLength(2)
    expect(slow[0].duration_ms).toBe(600)
    expect(slow[1].duration_ms).toBe(501)
  })

  it('push is a no-op when disabled', () => {
    const disabled = new DebugStore(false)
    disabled.push(makeEntry())
    expect(disabled.getAll()).toHaveLength(0)
  })

  it('getAll returns a copy, not the internal array', () => {
    store.push(makeEntry())
    const all = store.getAll()
    all.length = 0
    expect(store.getAll()).toHaveLength(1)
  })

  it('auto-detect mode when no options provided', () => {
    // In Bun test environment, isDevMode() likely returns true (NODE_ENV != production)
    const autoStore = new DebugStore()
    expect(autoStore.enabled).toBe(true)
  })

  it('boolean constructor (false) disables the store', () => {
    const disabled = new DebugStore(false)
    expect(disabled.enabled).toBe(false)
    expect(disabled.logToConsole).toBe(false)
  })

  it('boolean constructor (true) enables the store', () => {
    const enabled = new DebugStore(true)
    expect(enabled.enabled).toBe(true)
    expect(enabled.logToConsole).toBe(true)
  })
})

describe('isDevMode', () => {
  it('returns true when NODE_ENV is not production', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    expect(isDevMode()).toBe(true)
    process.env.NODE_ENV = original
  })

  it('returns false when NODE_ENV is production and FORGE_DEBUG is not set', () => {
    const origNode = process.env.NODE_ENV
    const origDebug = process.env.FORGE_DEBUG
    process.env.NODE_ENV = 'production'
    delete process.env.FORGE_DEBUG
    expect(isDevMode()).toBe(false)
    process.env.NODE_ENV = origNode
    if (origDebug !== undefined) process.env.FORGE_DEBUG = origDebug
  })

  it('returns true when NODE_ENV is production but FORGE_DEBUG=true', () => {
    const origNode = process.env.NODE_ENV
    const origDebug = process.env.FORGE_DEBUG
    process.env.NODE_ENV = 'production'
    process.env.FORGE_DEBUG = 'true'
    expect(isDevMode()).toBe(true)
    process.env.NODE_ENV = origNode
    if (origDebug !== undefined) {
      process.env.FORGE_DEBUG = origDebug
    } else {
      delete process.env.FORGE_DEBUG
    }
  })

  it('returns a boolean without crashing', () => {
    const result = isDevMode()
    expect(typeof result).toBe('boolean')
  })
})
