// packages/extension/tests/background/smoke.test.ts
//
// This test requires a running Forge server at http://localhost:3000.
// Run `bun run --watch src/index.ts` in packages/core/ before running this test.
//
// Skipped automatically if the server isn't reachable.

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { handleHealth } from '../../src/background/handlers/health'
import { handleOrgsList, handleOrgsCreate } from '../../src/background/handlers/orgs'
import { resetClient, getClient } from '../../src/background/client'

// Stub chrome.storage.local for the handlers
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

let serverReachable = false

// Track IDs of test-created resources for cleanup
const createdOrgIds: string[] = []
const createdJdIds: string[] = []

beforeAll(async () => {
  resetClient()
  try {
    const res = await fetch('http://localhost:3000/api/health')
    serverReachable = res.ok
  } catch {
    serverReachable = false
  }
})

afterAll(async () => {
  if (!serverReachable) return
  const client = await getClient()
  for (const id of createdJdIds) {
    await client.jobDescriptions.delete(id).catch(() => {})
  }
  for (const id of createdOrgIds) {
    await client.organizations.delete(id).catch(() => {})
  }
})

describe('smoke: extension <-> Forge roundtrip', () => {
  test('handleHealth returns ok against running server', async () => {
    if (!serverReachable) {
      console.warn('[smoke] Forge server not reachable — skipping. Start with: cd packages/core && bun run --watch src/index.ts')
      return
    }
    const response = await handleHealth()
    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(response.data.server).toBe('ok')
      expect(typeof response.data.version).toBe('string')
    }
  })

  test('handleOrgsList returns a list against running server', async () => {
    if (!serverReachable) return
    const response = await handleOrgsList(5)
    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(Array.isArray(response.data.orgs)).toBe(true)
      expect(typeof response.data.total).toBe('number')
    }
  })

  test('handleOrgsCreate creates an org against running server', async () => {
    if (!serverReachable) return
    const name = `Test Org ${Date.now()}`
    const response = await handleOrgsCreate({ name })
    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(response.data.name).toBe(name)
      expect(typeof response.data.id).toBe('string')
      expect(response.data.id).toHaveLength(36)
      createdOrgIds.push(response.data.id)
    }
  })

  test('sdk.jobDescriptions.create creates a JD against running server', async () => {
    if (!serverReachable) return
    const client = await getClient()
    const result = await client.jobDescriptions.create({
      title: 'Smoke Test JD ' + Date.now(),
      raw_text: 'This is a test job description created by the P4 smoke test.',
      url: 'https://www.linkedin.com/jobs/view/smoke-test-' + Date.now(),
      location: 'Remote',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toContain('Smoke Test JD')
      expect(typeof result.data.id).toBe('string')
      expect(result.data.id).toHaveLength(36)
      createdJdIds.push(result.data.id)
    }
  })

  test('sdk.jobDescriptions.lookupByUrl finds existing JD', async () => {
    if (!serverReachable) return
    const client = await getClient()
    const uniqueUrl = 'https://www.linkedin.com/jobs/view/smoke-dedup-' + Date.now() + '/'

    // Create a JD first
    const createResult = await client.jobDescriptions.create({
      title: 'Dedup Test JD',
      raw_text: 'Testing dedup flow.',
      url: uniqueUrl,
    })
    expect(createResult.ok).toBe(true)
    if (createResult.ok) createdJdIds.push(createResult.data.id)

    // Lookup should find it
    const lookupResult = await client.jobDescriptions.lookupByUrl(uniqueUrl)
    expect(lookupResult.ok).toBe(true)
    if (lookupResult.ok) {
      expect(lookupResult.data.title).toBe('Dedup Test JD')
    }
  })

  test('sdk.jobDescriptions.lookupByUrl returns not-found for unknown URL', async () => {
    if (!serverReachable) return
    const client = await getClient()
    const result = await client.jobDescriptions.lookupByUrl('https://example.com/nonexistent-' + Date.now())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  test('sdk.organizations.list with search finds org by name', async () => {
    if (!serverReachable) return
    const client = await getClient()
    const uniqueName = 'SmokeCorp ' + Date.now()

    // Create an org first
    const createResult = await client.organizations.create({ name: uniqueName })
    expect(createResult.ok).toBe(true)
    if (createResult.ok) createdOrgIds.push(createResult.data.id)

    // Search should find it
    const searchResult = await client.organizations.list({ search: uniqueName, limit: 5 })
    expect(searchResult.ok).toBe(true)
    if (searchResult.ok) {
      expect(searchResult.data.length).toBeGreaterThanOrEqual(1)
      expect(searchResult.data[0].name).toBe(uniqueName)
    }
  })

  test('sdk.profile.get returns user profile', async () => {
    if (!serverReachable) return
    const client = await getClient()
    const result = await client.profile.get()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(typeof result.data.name).toBe('string')
      expect(result.data.name.length).toBeGreaterThan(0)
    }
  })
})
