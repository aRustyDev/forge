/**
 * Tests for CampusRepository — CRUD operations for the org_campuses table.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../__tests__/helpers'
import * as CampusRepo from '../campus-repository'
import * as OrgRepo from '../organization-repository'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let db: Database

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

// ===========================================================================
// CampusRepository
// ===========================================================================

describe('CampusRepository', () => {
  describe('update()', () => {
    test('partially updates a campus — only specified fields change', () => {
      const org = OrgRepo.create(db, { name: 'Test Org' })
      const campus = CampusRepo.create(db, {
        organization_id: org.id,
        name: 'Main Campus',
        modality: 'in_person',
        city: 'Portland',
        state: 'OR',
      })

      const updated = CampusRepo.update(db, campus.id, { name: 'Renamed Campus' })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Renamed Campus')
      // Other fields unchanged
      expect(updated!.modality).toBe('in_person')
      expect(updated!.city).toBe('Portland')
      expect(updated!.state).toBe('OR')
      expect(updated!.organization_id).toBe(org.id)
    })

    test('returns null for nonexistent ID', () => {
      const result = CampusRepo.update(db, 'no-such-id', { name: 'X' })
      expect(result).toBeNull()
    })

    test('returns existing campus unchanged for empty input', () => {
      const org = OrgRepo.create(db, { name: 'Test Org' })
      const campus = CampusRepo.create(db, {
        organization_id: org.id,
        name: 'Main Campus',
        modality: 'in_person',
      })

      const same = CampusRepo.update(db, campus.id, {})

      expect(same).not.toBeNull()
      expect(same!.id).toBe(campus.id)
      expect(same!.name).toBe('Main Campus')
      expect(same!.modality).toBe('in_person')
    })

    test('sets a field to null', () => {
      const org = OrgRepo.create(db, { name: 'Test Org' })
      const campus = CampusRepo.create(db, {
        organization_id: org.id,
        name: 'Main Campus',
        modality: 'in_person',
        city: 'Portland',
        state: 'OR',
      })

      const updated = CampusRepo.update(db, campus.id, { city: null })

      expect(updated).not.toBeNull()
      expect(updated!.city).toBeNull()
      // Other fields unchanged
      expect(updated!.state).toBe('OR')
      expect(updated!.name).toBe('Main Campus')
    })

    test('updates multiple fields at once', () => {
      const org = OrgRepo.create(db, { name: 'Test Org' })
      const campus = CampusRepo.create(db, {
        organization_id: org.id,
        name: 'Old Name',
        modality: 'in_person',
        city: 'Portland',
      })

      const updated = CampusRepo.update(db, campus.id, {
        name: 'New Name',
        modality: 'remote',
        city: 'Austin',
        state: 'TX',
        is_headquarters: 1,
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('New Name')
      expect(updated!.modality).toBe('remote')
      expect(updated!.city).toBe('Austin')
      expect(updated!.state).toBe('TX')
      expect(updated!.is_headquarters).toBe(1)
    })
  })
})
