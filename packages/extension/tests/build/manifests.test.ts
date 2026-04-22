// packages/extension/tests/build/manifests.test.ts

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const extRoot = join(import.meta.dir, '..', '..')

const chrome = JSON.parse(readFileSync(join(extRoot, 'manifest.json'), 'utf-8'))
const firefox = JSON.parse(readFileSync(join(extRoot, 'manifest.firefox.json'), 'utf-8'))

describe('Chrome manifest (manifest.json)', () => {
  test('is MV3', () => {
    expect(chrome.manifest_version).toBe(3)
  })

  test('has service_worker background', () => {
    expect(chrome.background.service_worker).toBe('background.js')
    expect(chrome.background.type).toBe('module')
  })

  test('does not have background.scripts', () => {
    expect(chrome.background.scripts).toBeUndefined()
  })

  test('popup at popup/index.html', () => {
    expect(chrome.action.default_popup).toBe('popup/index.html')
  })

  test('has no gecko settings', () => {
    expect(chrome.browser_specific_settings).toBeUndefined()
  })

  test('has contextMenus permission', () => {
    expect(chrome.permissions).toContain('contextMenus')
  })
})

describe('Firefox manifest (manifest.firefox.json)', () => {
  test('is MV3', () => {
    expect(firefox.manifest_version).toBe(3)
  })

  test('has background.scripts (not service_worker)', () => {
    expect(firefox.background.scripts).toEqual(['background.js'])
    expect(firefox.background.service_worker).toBeUndefined()
  })

  test('has type: module for ESM background script', () => {
    expect(firefox.background.type).toBe('module')
  })

  test('popup at popup/index.html', () => {
    expect(firefox.action.default_popup).toBe('popup/index.html')
  })

  test('has gecko settings with ID and strict_min_version', () => {
    expect(firefox.browser_specific_settings.gecko.id).toBe('forge-extension@forge.local')
    expect(firefox.browser_specific_settings.gecko.strict_min_version).toBe('128.0')
  })
})

describe('Manifests share common fields', () => {
  test('same version', () => {
    expect(chrome.version).toBe(firefox.version)
  })

  test('same permissions', () => {
    expect(chrome.permissions).toEqual(firefox.permissions)
  })

  test('same host_permissions', () => {
    expect(chrome.host_permissions).toEqual(firefox.host_permissions)
  })

  test('same name', () => {
    expect(chrome.name).toBe(firefox.name)
  })

  test('same description', () => {
    expect(chrome.description).toBe(firefox.description)
  })
})
