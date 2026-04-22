// packages/extension/tests/plugins/registry.test.ts

import { describe, test, expect } from 'bun:test'
import { matchPluginForHost } from '../../src/plugin/registry'
import type { JobBoardPlugin } from '../../src/plugin/types'

const fakePlugin: JobBoardPlugin = {
  name: 'test',
  matches: ['example.com', '*.example.com'],
  capabilities: {},
}

describe('matchPluginForHost', () => {
  test('matches exact hostname', () => {
    expect(matchPluginForHost('example.com', [fakePlugin])).toBe(fakePlugin)
  })

  test('matches subdomain via wildcard', () => {
    expect(matchPluginForHost('www.example.com', [fakePlugin])).toBe(fakePlugin)
    expect(matchPluginForHost('jobs.example.com', [fakePlugin])).toBe(fakePlugin)
  })

  test('returns null for unmatched host', () => {
    expect(matchPluginForHost('other.com', [fakePlugin])).toBeNull()
  })

  test('does not match wildcard as literal', () => {
    // "*.example.com" should not match "example.com" (bare domain)
    const subOnly: JobBoardPlugin = { ...fakePlugin, matches: ['*.example.com'] }
    expect(matchPluginForHost('example.com', [subOnly])).toBeNull()
    expect(matchPluginForHost('www.example.com', [subOnly])).toBe(subOnly)
  })

  test('returns first matching plugin', () => {
    const p1: JobBoardPlugin = { ...fakePlugin, name: 'first' }
    const p2: JobBoardPlugin = { ...fakePlugin, name: 'second' }
    expect(matchPluginForHost('example.com', [p1, p2])?.name).toBe('first')
  })
})
