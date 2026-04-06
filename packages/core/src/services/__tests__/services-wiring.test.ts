/**
 * Services interface wiring tests (Phase 85 T85.7).
 *
 * Acceptance criteria from the phase plan:
 *   [x] Both services accessible via `services.credentials` and
 *       `services.certifications`
 *   [x] Full test suite passes (covered by the rest of the test files)
 *
 * This file only tests the wiring — it doesn't re-test credential /
 * certification behavior (that's in credential-service.test.ts and
 * certification-service.test.ts). It exists so that if a future refactor
 * forgets to include a service in createServices(), we get a fast
 * structural failure at this layer rather than discovering it via a
 * route test.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../db/__tests__/helpers'
import { createServices, CredentialService, CertificationService } from '../index'
import type { Services } from '../index'

describe('Services wiring (Phase 85 T85.7)', () => {
  let db: Database
  let services: Services

  beforeEach(() => {
    db = createTestDb()
    services = createServices(db, ':memory:')
  })

  afterEach(() => {
    db.close()
  })

  test('services.credentials is a CredentialService instance', () => {
    expect(services.credentials).toBeDefined()
    expect(services.credentials).toBeInstanceOf(CredentialService)
  })

  test('services.certifications is a CertificationService instance', () => {
    expect(services.certifications).toBeDefined()
    expect(services.certifications).toBeInstanceOf(CertificationService)
  })

  test('services.credentials.list() returns an ok Result', () => {
    const result = services.credentials.list()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual([])
  })

  test('services.certifications.list() returns an ok Result', () => {
    const result = services.certifications.list()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual([])
  })

  test('services.credentials can create and retrieve a credential', () => {
    const create = services.credentials.create({
      credential_type: 'clearance',
      label: 'Test TS',
      details: {
        level: 'top_secret',
        polygraph: null,
        clearance_type: 'personnel',
        access_programs: [],
      },
    })
    expect(create.ok).toBe(true)
    if (!create.ok) return

    const get = services.credentials.get(create.data.id)
    expect(get.ok).toBe(true)
    if (get.ok) expect(get.data.id).toBe(create.data.id)
  })

  test('services.certifications can create and retrieve a certification', () => {
    const create = services.certifications.create({ short_name: 'Test', long_name: 'Test Cert' })
    expect(create.ok).toBe(true)
    if (!create.ok) return

    const get = services.certifications.get(create.data.id)
    expect(get.ok).toBe(true)
    if (get.ok) expect(get.data.short_name).toBe('Test')
  })

  test('all Phase 85 services are independent instances per createServices call', () => {
    const services2 = createServices(db, ':memory:')
    expect(services.credentials).not.toBe(services2.credentials)
    expect(services.certifications).not.toBe(services2.certifications)
  })
})
