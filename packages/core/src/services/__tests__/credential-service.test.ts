/**
 * CredentialService tests (Phase 85 T85.4).
 *
 * Acceptance criteria from the phase plan:
 *   [x] Type-specific details validation for all 4 credential types
 *   [x] Invalid details rejected with clear error messages
 *   [x] Org FK validated against repository
 *
 * Each describe block maps to one acceptance criterion or service method.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization, testUuid } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { CredentialService } from '../credential-service'

describe('CredentialService', () => {
  let db: Database
  let service: CredentialService

  beforeEach(() => {
    db = createTestDb()
    service = new CredentialService(buildDefaultElm(db))
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Type-specific details validation for all 4 types
  // ────────────────────────────────────────────────────────────────

  describe('clearance details validation', () => {
    test('accepts clearance with required level + clearance_type', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(true)
    })

    test('rejects clearance missing level', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Missing Level',
        details: {
          // level absent
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('level')
      }
    })

    test('rejects clearance missing clearance_type', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Missing Type',
        details: {
          level: 'secret',
          polygraph: null,
          access_programs: [],
        } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('clearance_type')
      }
    })

    test('accepts clearance with polygraph=null (polygraph is optional)', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Secret no poly',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(true)
    })

    test('accepts clearance with empty access_programs array', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Secret',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('drivers_license details validation', () => {
    test('accepts with required class + state', async () => {
      const result = await service.create({
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      expect(result.ok).toBe(true)
    })

    test('rejects missing class', async () => {
      const result = await service.create({
        credential_type: 'drivers_license',
        label: 'No Class',
        details: { state: 'VA', endorsements: [] } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('class')
    })

    test('rejects missing state', async () => {
      const result = await service.create({
        credential_type: 'drivers_license',
        label: 'No State',
        details: { class: 'A', endorsements: [] } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('state')
    })

    test('rejects empty class string', async () => {
      const result = await service.create({
        credential_type: 'drivers_license',
        label: 'Empty Class',
        details: { class: '   ', state: 'VA', endorsements: [] },
      })
      expect(result.ok).toBe(false)
    })
  })

  describe('bar_admission details validation', () => {
    test('accepts with required jurisdiction', async () => {
      const result = await service.create({
        credential_type: 'bar_admission',
        label: 'VA Bar',
        details: { jurisdiction: 'Virginia', bar_number: null },
      })
      expect(result.ok).toBe(true)
    })

    test('rejects missing jurisdiction', async () => {
      const result = await service.create({
        credential_type: 'bar_admission',
        label: 'No Jurisdiction',
        details: { bar_number: '12345' } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('jurisdiction')
    })

    test('accepts null bar_number (optional field)', async () => {
      const result = await service.create({
        credential_type: 'bar_admission',
        label: 'Bar no number',
        details: { jurisdiction: 'CA', bar_number: null },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('medical_license details validation', () => {
    test('accepts with required license_type + state', async () => {
      const result = await service.create({
        credential_type: 'medical_license',
        label: 'VA MD',
        details: { license_type: 'MD', state: 'VA', license_number: null },
      })
      expect(result.ok).toBe(true)
    })

    test('rejects missing license_type', async () => {
      const result = await service.create({
        credential_type: 'medical_license',
        label: 'No Type',
        details: { state: 'VA', license_number: null } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('license_type')
    })

    test('rejects missing state', async () => {
      const result = await service.create({
        credential_type: 'medical_license',
        label: 'No State',
        details: { license_type: 'MD', license_number: null } as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('state')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Invalid details rejected with clear error messages
  // ────────────────────────────────────────────────────────────────

  describe('enum + basic field validation', () => {
    test('rejects unknown credential_type', async () => {
      const result = await service.create({
        credential_type: 'bogus' as any,
        label: 'Bogus',
        details: {} as any,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('credential_type')
      }
    })

    test('rejects unknown status', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Bad Status',
        status: 'wibble' as any,
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('status')
    })

    test('rejects empty label', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: '',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('label')
    })

    test('rejects whitespace-only label', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: '   ',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(false)
    })

    test('rejects missing details', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'X',
      } as any)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('details')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Org FK validated against repository
  // ────────────────────────────────────────────────────────────────

  describe('organization_id FK validation', () => {
    test('accepts valid organization_id', async () => {
      const orgId = seedOrganization(db, { name: 'DoD', orgType: 'government' })
      const result = await service.create({
        credential_type: 'clearance',
        label: 'DoD TS',
        organization_id: orgId,
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.organization_id).toBe(orgId)
    })

    test('rejects unknown organization_id with NOT_FOUND', async () => {
      const result = await service.create({
        credential_type: 'clearance',
        label: 'Ghost Org',
        organization_id: testUuid(),
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toContain('Organization')
      }
    })

    test('update rejects unknown organization_id', async () => {
      const created = await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.update(created.data.id, { organization_id: testUuid() })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })

    test('update accepts null organization_id to clear', async () => {
      const orgId = seedOrganization(db, { name: 'DoD', orgType: 'government' })
      const created = await service.create({
        credential_type: 'clearance',
        label: 'TS',
        organization_id: orgId,
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.update(created.data.id, { organization_id: null })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.organization_id).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Service methods: get/list/findByType/update/delete
  // ────────────────────────────────────────────────────────────────

  describe('get()', () => {
    test('returns found credential in ok envelope', async () => {
      const created = await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.get(created.data.id)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.id).toBe(created.data.id)
    })

    test('returns NOT_FOUND for unknown id', async () => {
      const result = await service.get(testUuid())
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('list()', () => {
    test('returns empty list initially', async () => {
      const result = await service.list()
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toEqual([])
    })

    test('returns all credentials', async () => {
      await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      await service.create({
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })

      const result = await service.list()
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toHaveLength(2)
    })
  })

  describe('findByType()', () => {
    test('filters by type', async () => {
      await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      await service.create({
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })

      const result = await service.findByType('clearance')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].credential_type).toBe('clearance')
      }
    })

    test('rejects unknown type', async () => {
      const result = await service.findByType('bogus')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('update()', () => {
    test('partial details merge preserves unmentioned fields', async () => {
      const created = await service.create({
        credential_type: 'clearance',
        label: 'TS/SCI',
        details: {
          level: 'top_secret',
          polygraph: 'ci',
          clearance_type: 'personnel',
          access_programs: ['sci'],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.update(created.data.id, {
        details: { polygraph: 'full_scope' },
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const d = result.data.details as any
        expect(d.polygraph).toBe('full_scope')
        expect(d.level).toBe('top_secret') // preserved
        expect(d.access_programs).toEqual(['sci']) // preserved
      }
    })

    test('rejects update that would leave required field absent', async () => {
      const created = await service.create({
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      // Try to blank the class field — merge validation catches it
      const result = await service.update(created.data.id, {
        details: { class: '' } as any,
      })
      expect(result.ok).toBe(false)
    })

    test('rejects empty label on update', async () => {
      const created = await service.create({
        credential_type: 'clearance',
        label: 'TS',
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.update(created.data.id, { label: '   ' })
      expect(result.ok).toBe(false)
    })

    test('returns NOT_FOUND for unknown id on update', async () => {
      const result = await service.update(testUuid(), { label: 'Ghost' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('delete()', () => {
    test('deletes existing credential', async () => {
      const created = await service.create({
        credential_type: 'clearance',
        label: 'Temp',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const result = await service.delete(created.data.id)
      expect(result.ok).toBe(true)
      const fetched = await service.get(created.data.id)
      expect(fetched.ok).toBe(false)
    })

    test('returns NOT_FOUND for unknown id', async () => {
      const result = await service.delete(testUuid())
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })
  })
})
