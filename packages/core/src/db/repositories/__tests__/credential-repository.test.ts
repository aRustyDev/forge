/**
 * CredentialRepository tests (Phase 85 T85.2).
 *
 * Acceptance criteria from the phase plan:
 *   [x] All 6 methods implemented and tested
 *   [x] JSON details serialize/deserialize correctly for all 4 credential types
 *   [x] Partial details update merges correctly (doesn't clobber unmentioned fields)
 *
 * Each describe block maps to one acceptance criterion; each test inside
 * asserts a specific behavior needed to satisfy the criterion.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization, testUuid } from '../../__tests__/helpers'
import * as CredentialRepo from '../credential-repository'
import type {
  ClearanceDetails,
  DriversLicenseDetails,
  BarAdmissionDetails,
  MedicalLicenseDetails,
} from '../../../types'

describe('CredentialRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: All 6 methods implemented and tested
  // (create, findById, findAll, findByType, update, del)
  // ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    test('inserts a credential with a generated UUID', () => {
      const details: ClearanceDetails = {
        level: 'top_secret',
        polygraph: 'ci',
        clearance_type: 'personnel',
        access_programs: ['sci'],
      }

      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Top Secret / SCI',
        details,
      })

      expect(cred.id).toHaveLength(36)
      expect(cred.credential_type).toBe('clearance')
      expect(cred.label).toBe('Top Secret / SCI')
      expect(cred.status).toBe('active') // default
      expect(cred.created_at).toBeTruthy()
      expect(cred.updated_at).toBeTruthy()
    })

    test('defaults status to active when not specified', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'bar_admission',
        label: 'VA Bar',
        details: { jurisdiction: 'Virginia', bar_number: null },
      })
      expect(cred.status).toBe('active')
    })

    test('honors explicit status', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Old Clearance',
        status: 'inactive',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      expect(cred.status).toBe('inactive')
    })

    test('preserves organization_id when provided', () => {
      const orgId = seedOrganization(db, { name: 'DoD', orgType: 'government' })
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'DoD-Sponsored TS',
        organization_id: orgId,
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      expect(cred.organization_id).toBe(orgId)
    })

    test('honors issued_date and expiry_date when provided', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL',
        issued_date: '2020-03-15',
        expiry_date: '2028-03-15',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      expect(cred.issued_date).toBe('2020-03-15')
      expect(cred.expiry_date).toBe('2028-03-15')
    })
  })

  describe('findById()', () => {
    test('returns the credential with parsed details', () => {
      const created = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: 'ci', clearance_type: 'personnel', access_programs: ['sci'] },
      })

      const found = CredentialRepo.findById(db, created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect((found!.details as ClearanceDetails).level).toBe('top_secret')
      expect((found!.details as ClearanceDetails).access_programs).toEqual(['sci'])
    })

    test('returns null for unknown id', () => {
      expect(CredentialRepo.findById(db, testUuid())).toBeNull()
    })
  })

  describe('findAll()', () => {
    test('returns empty array when no credentials exist', () => {
      expect(CredentialRepo.findAll(db)).toEqual([])
    })

    test('returns all credentials ordered by (credential_type, label)', () => {
      CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Secret',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })

      const all = CredentialRepo.findAll(db)
      expect(all).toHaveLength(3)
      // bar_admission < clearance < drivers_license < medical_license alphabetically
      expect(all[0].credential_type).toBe('clearance')
      expect(all[0].label).toBe('Secret') // alphabetical within the type
      expect(all[1].credential_type).toBe('clearance')
      expect(all[1].label).toBe('TS')
      expect(all[2].credential_type).toBe('drivers_license')
    })
  })

  describe('findByType()', () => {
    beforeEach(() => {
      CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Secret',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      CredentialRepo.create(db, {
        credential_type: 'bar_admission',
        label: 'VA Bar',
        details: { jurisdiction: 'Virginia', bar_number: null },
      })
      CredentialRepo.create(db, {
        credential_type: 'medical_license',
        label: 'VA Medical',
        details: { license_type: 'MD', state: 'VA', license_number: null },
      })
    })

    test('filters by clearance', () => {
      const clearances = CredentialRepo.findByType(db, 'clearance')
      expect(clearances).toHaveLength(2)
      expect(clearances.every((c) => c.credential_type === 'clearance')).toBe(true)
      // ordered by label
      expect(clearances[0].label).toBe('Secret')
      expect(clearances[1].label).toBe('TS')
    })

    test('filters by drivers_license', () => {
      const rows = CredentialRepo.findByType(db, 'drivers_license')
      expect(rows).toHaveLength(1)
      expect(rows[0].credential_type).toBe('drivers_license')
    })

    test('filters by bar_admission', () => {
      const rows = CredentialRepo.findByType(db, 'bar_admission')
      expect(rows).toHaveLength(1)
      expect(rows[0].credential_type).toBe('bar_admission')
    })

    test('filters by medical_license', () => {
      const rows = CredentialRepo.findByType(db, 'medical_license')
      expect(rows).toHaveLength(1)
      expect(rows[0].credential_type).toBe('medical_license')
    })

    test('returns empty array when no credentials of that type exist', () => {
      // Delete all clearances
      const clearances = CredentialRepo.findByType(db, 'clearance')
      for (const c of clearances) CredentialRepo.del(db, c.id)

      expect(CredentialRepo.findByType(db, 'clearance')).toEqual([])
    })
  })

  describe('update()', () => {
    test('updates label', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Old Label',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      const updated = CredentialRepo.update(db, cred.id, { label: 'New Label' })
      expect(updated).not.toBeNull()
      expect(updated!.label).toBe('New Label')
    })

    test('updates status', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      const updated = CredentialRepo.update(db, cred.id, { status: 'expired' })
      expect(updated!.status).toBe('expired')
    })

    test('updates organization_id (including setting to null)', () => {
      const orgId = seedOrganization(db, { name: 'DoD', orgType: 'government' })
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'DoD TS',
        organization_id: orgId,
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      const cleared = CredentialRepo.update(db, cred.id, { organization_id: null })
      expect(cleared!.organization_id).toBeNull()
    })

    test('updates issued_date and expiry_date', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })
      const updated = CredentialRepo.update(db, cred.id, {
        issued_date: '2023-01-01',
        expiry_date: '2031-01-01',
      })
      expect(updated!.issued_date).toBe('2023-01-01')
      expect(updated!.expiry_date).toBe('2031-01-01')
    })

    test('returns null for nonexistent id', () => {
      const result = CredentialRepo.update(db, testUuid(), { label: 'nope' })
      expect(result).toBeNull()
    })

    test('refreshes updated_at on every update', async () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: { level: 'top_secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      // Sleep >1s so the ISO-second-precision timestamp changes
      await new Promise((r) => setTimeout(r, 1100))
      const updated = CredentialRepo.update(db, cred.id, { label: 'TS updated' })
      expect(updated!.updated_at > cred.updated_at).toBe(true)
    })
  })

  describe('del()', () => {
    test('deletes an existing credential and returns true', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Temp',
        details: { level: 'secret', polygraph: null, clearance_type: 'personnel', access_programs: [] },
      })
      expect(CredentialRepo.del(db, cred.id)).toBe(true)
      expect(CredentialRepo.findById(db, cred.id)).toBeNull()
    })

    test('returns false for nonexistent id', () => {
      expect(CredentialRepo.del(db, testUuid())).toBe(false)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: JSON details serialize/deserialize correctly for all
  //            4 credential types
  // ────────────────────────────────────────────────────────────────

  describe('JSON details round-trip', () => {
    test('clearance details: level + polygraph + clearance_type + access_programs', () => {
      const details: ClearanceDetails = {
        level: 'top_secret',
        polygraph: 'full_scope',
        clearance_type: 'facility',
        access_programs: ['sci', 'sap', 'nato'],
      }
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Full Monty',
        details,
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect(fetched.details).toEqual(details)
    })

    test('drivers_license details: class + state + endorsements array', () => {
      const details: DriversLicenseDetails = {
        class: 'A',
        state: 'VA',
        endorsements: ['hazmat', 'motorcycle'],
      }
      const cred = CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL A',
        details,
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect(fetched.details).toEqual(details)
    })

    test('bar_admission details: jurisdiction + bar_number (nullable)', () => {
      const details: BarAdmissionDetails = {
        jurisdiction: 'Virginia',
        bar_number: '12345',
      }
      const cred = CredentialRepo.create(db, {
        credential_type: 'bar_admission',
        label: 'VA Bar',
        details,
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect(fetched.details).toEqual(details)
    })

    test('medical_license details: license_type + state + license_number (nullable)', () => {
      const details: MedicalLicenseDetails = {
        license_type: 'MD',
        state: 'VA',
        license_number: 'ML-99999',
      }
      const cred = CredentialRepo.create(db, {
        credential_type: 'medical_license',
        label: 'VA MD',
        details,
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect(fetched.details).toEqual(details)
    })

    test('empty access_programs array survives round-trip', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Secret',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect((fetched.details as ClearanceDetails).access_programs).toEqual([])
    })

    test('null polygraph survives round-trip', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Secret no poly',
        details: {
          level: 'secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: [],
        },
      })
      const fetched = CredentialRepo.findById(db, cred.id)!
      expect((fetched.details as ClearanceDetails).polygraph).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Criterion: Partial details update merges correctly (doesn't
  //            clobber unmentioned fields)
  // ────────────────────────────────────────────────────────────────

  describe('partial details update (merge semantics)', () => {
    test('updating one field preserves the others', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS/SCI',
        details: {
          level: 'top_secret',
          polygraph: 'ci',
          clearance_type: 'personnel',
          access_programs: ['sci'],
        },
      })

      // Update only polygraph — level, clearance_type, and access_programs
      // must survive.
      const updated = CredentialRepo.update(db, cred.id, {
        details: { polygraph: 'full_scope' },
      })

      const d = updated!.details as ClearanceDetails
      expect(d.polygraph).toBe('full_scope') // updated
      expect(d.level).toBe('top_secret')     // preserved
      expect(d.clearance_type).toBe('personnel') // preserved
      expect(d.access_programs).toEqual(['sci']) // preserved
    })

    test('updating access_programs replaces the array (not merges)', () => {
      // Arrays are replaced wholesale (standard shallow merge semantics).
      // This prevents the "ghost element" trap where an update looks like
      // it adds one program but actually leaves old ones behind.
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'TS',
        details: {
          level: 'top_secret',
          polygraph: null,
          clearance_type: 'personnel',
          access_programs: ['sci', 'sap'],
        },
      })

      const updated = CredentialRepo.update(db, cred.id, {
        details: { access_programs: ['nato'] },
      })

      const d = updated!.details as ClearanceDetails
      expect(d.access_programs).toEqual(['nato'])
    })

    test('empty details update is a no-op for details (other columns still update)', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'clearance',
        label: 'Original',
        details: {
          level: 'secret',
          polygraph: 'ci',
          clearance_type: 'personnel',
          access_programs: [],
        },
      })

      const updated = CredentialRepo.update(db, cred.id, {
        label: 'Renamed',
        details: {},
      })

      expect(updated!.label).toBe('Renamed')
      // Original details intact since no keys were provided
      const d = updated!.details as ClearanceDetails
      expect(d.level).toBe('secret')
      expect(d.polygraph).toBe('ci')
    })

    test('updating drivers_license endorsements preserves class and state', () => {
      const cred = CredentialRepo.create(db, {
        credential_type: 'drivers_license',
        label: 'VA CDL',
        details: { class: 'A', state: 'VA', endorsements: [] },
      })

      const updated = CredentialRepo.update(db, cred.id, {
        details: { endorsements: ['hazmat'] },
      })

      const d = updated!.details as DriversLicenseDetails
      expect(d.class).toBe('A')       // preserved
      expect(d.state).toBe('VA')      // preserved
      expect(d.endorsements).toEqual(['hazmat'])
    })
  })
})
