// packages/extension/tests/background/client.test.ts

import { describe, test, expect, beforeEach } from 'bun:test'
import { getClient, resetClient } from '../../src/background/client'

// Mock chrome.storage.local for this unit test
const storage = new Map<string, unknown>()
;(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string) => {
        const value = storage.get(key)
        return value !== undefined ? { [key]: value } : {}
      },
      set: async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) storage.set(k, v)
      },
    },
  },
}

describe('ForgeClient singleton', () => {
  beforeEach(() => {
    storage.clear()
    resetClient()
  })

  test('returns a ForgeClient instance', async () => {
    const client = await getClient()
    expect(client).toBeDefined()
    expect(typeof client.health).toBe('function')
  })

  test('returns the same instance on repeat calls with same config', async () => {
    const a = await getClient()
    const b = await getClient()
    expect(a).toBe(b)
  })

  test('re-instantiates when baseUrl changes', async () => {
    const a = await getClient()
    await (globalThis as any).chrome.storage.local.set({
      forge_ext_config: { baseUrl: 'http://localhost:9999', devMode: true, enabledPlugins: [] },
    })
    const b = await getClient()
    expect(a).not.toBe(b)
  })
})
