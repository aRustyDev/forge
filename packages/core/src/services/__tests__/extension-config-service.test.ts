import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../db/__tests__/helpers'
import { ExtensionConfigService } from '../extension-config-service'

describe('ExtensionConfigService', () => {
  let db: Database
  let svc: ExtensionConfigService

  beforeEach(() => {
    db = createTestDb()
    svc = new ExtensionConfigService(db)
  })

  afterEach(() => {
    db.close()
  })

  test('getAll() returns seeded defaults', () => {
    const result = svc.getAll()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.baseUrl).toBe('http://localhost:3000')
    expect(result.data.devMode).toBe(false)
    expect(result.data.enabledPlugins).toEqual(['linkedin'])
    expect(result.data.enableServerLogging).toBe(true)
  })

  test('get() returns a single parsed value', () => {
    const result = svc.get('devMode')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toBe(false)
  })

  test('get() returns NOT_FOUND for unknown key', () => {
    const result = svc.get('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('set() updates a boolean key', () => {
    const result = svc.set('devMode', true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.devMode).toBe(true)
  })

  test('set() updates a string key', () => {
    const result = svc.set('baseUrl', 'http://192.168.1.100:3000')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.baseUrl).toBe('http://192.168.1.100:3000')
  })

  test('set() updates an array key', () => {
    const result = svc.set('enabledPlugins', ['linkedin', 'workday'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.enabledPlugins).toEqual(['linkedin', 'workday'])
  })

  test('set() rejects unknown keys', () => {
    const result = svc.set('unknownKey', 'value')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('setMany() updates multiple keys at once', () => {
    const result = svc.setMany({ devMode: true, enableServerLogging: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.devMode).toBe(true)
    expect(result.data.enableServerLogging).toBe(false)
    expect(result.data.baseUrl).toBe('http://localhost:3000')
  })

  test('setMany() rejects if any key is unknown', () => {
    const result = svc.setMany({ devMode: true, badKey: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('getAll() merges missing keys over defaults', () => {
    db.run("DELETE FROM extension_config WHERE key = 'enableServerLogging'")
    const result = svc.getAll()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.enableServerLogging).toBe(true)
  })
})
