import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { createTestDb, seedEmployer, seedProject, seedSource, seedBullet } from '../../__tests__/helpers'
import * as SourceRepo from '../source-repository'

describe('SourceRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ── CRUD lifecycle ────────────────────────────────────────────────

  describe('create → get → update → delete', () => {
    test('create returns a Source with generated UUID and default fields', () => {
      const source = SourceRepo.create(db, {
        title: 'Cloud Migration',
        description: 'Led migration of forensics platform to AWS.',
      })

      expect(source.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(source.title).toBe('Cloud Migration')
      expect(source.description).toBe('Led migration of forensics platform to AWS.')
      expect(source.status).toBe('draft')
      expect(source.updated_by).toBe('human')
      expect(source.employer_id).toBeNull()
      expect(source.project_id).toBeNull()
      expect(source.start_date).toBeNull()
      expect(source.end_date).toBeNull()
      expect(source.last_derived_at).toBeNull()
      expect(source.created_at).toBeTruthy()
      expect(source.updated_at).toBeTruthy()
    })

    test('create with optional fields populates them', () => {
      const empId = seedEmployer(db)
      const projId = seedProject(db, 'Forensics', empId)

      const source = SourceRepo.create(db, {
        title: 'Cloud Migration',
        description: 'Description',
        employer_id: empId,
        project_id: projId,
        start_date: '2024-01-15',
        end_date: '2024-06-30',
      })

      expect(source.employer_id).toBe(empId)
      expect(source.project_id).toBe(projId)
      expect(source.start_date).toBe('2024-01-15')
      expect(source.end_date).toBe('2024-06-30')
    })

    test('get returns the source by ID', () => {
      const created = SourceRepo.create(db, {
        title: 'Test',
        description: 'Test description',
      })

      const fetched = SourceRepo.get(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('Test')
    })

    test('get returns null for nonexistent ID', () => {
      const result = SourceRepo.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('update changes specified fields and bumps updated_at', () => {
      const source = SourceRepo.create(db, {
        title: 'Original',
        description: 'Original description',
      })
      const originalUpdatedAt = source.updated_at

      // Small delay so updated_at differs
      const updated = SourceRepo.update(db, source.id, {
        title: 'Updated Title',
        description: 'New description',
      })

      expect(updated).not.toBeNull()
      expect(updated!.title).toBe('Updated Title')
      expect(updated!.description).toBe('New description')
      expect(updated!.updated_at).not.toBe(originalUpdatedAt)
    })

    test('update returns null for nonexistent ID', () => {
      const result = SourceRepo.update(db, crypto.randomUUID(), {
        title: 'Nope',
      })
      expect(result).toBeNull()
    })

    test('update can set nullable fields to null', () => {
      const empId = seedEmployer(db)
      const source = SourceRepo.create(db, {
        title: 'Test',
        description: 'Desc',
        employer_id: empId,
      })
      expect(source.employer_id).toBe(empId)

      const updated = SourceRepo.update(db, source.id, {
        employer_id: null,
      })
      expect(updated!.employer_id).toBeNull()
    })

    test('delete removes the source and returns true', () => {
      const source = SourceRepo.create(db, {
        title: 'To Delete',
        description: 'Going away',
      })

      const result = SourceRepo.del(db, source.id)
      expect(result).toBe(true)

      const after = SourceRepo.get(db, source.id)
      expect(after).toBeNull()
    })

    test('delete returns false for nonexistent ID', () => {
      const result = SourceRepo.del(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── List with filters ─────────────────────────────────────────────

  describe('list', () => {
    test('list returns all sources sorted by created_at DESC', () => {
      SourceRepo.create(db, { title: 'First', description: 'a' })
      SourceRepo.create(db, { title: 'Second', description: 'b' })
      SourceRepo.create(db, { title: 'Third', description: 'c' })

      const result = SourceRepo.list(db, {}, 0, 50)
      expect(result.total).toBe(3)
      expect(result.data).toHaveLength(3)
      // Most recent first
      expect(result.data[0].title).toBe('Third')
      expect(result.data[2].title).toBe('First')
    })

    test('list filters by status', () => {
      SourceRepo.create(db, { title: 'Draft', description: 'a' })
      // Seed an approved source directly to bypass default draft status
      seedSource(db, { title: 'Approved One', status: 'approved' })
      seedSource(db, { title: 'Approved Two', status: 'approved' })

      const result = SourceRepo.list(db, { status: 'approved' }, 0, 50)
      expect(result.total).toBe(2)
      expect(result.data).toHaveLength(2)
      for (const s of result.data) {
        expect(s.status).toBe('approved')
      }
    })

    test('list filters by employer_id', () => {
      const emp1 = seedEmployer(db, 'Acme')
      const emp2 = seedEmployer(db, 'Initech')

      SourceRepo.create(db, { title: 'Acme Source', description: 'a', employer_id: emp1 })
      SourceRepo.create(db, { title: 'Initech Source', description: 'b', employer_id: emp2 })
      SourceRepo.create(db, { title: 'No Employer', description: 'c' })

      const result = SourceRepo.list(db, { employer_id: emp1 }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].title).toBe('Acme Source')
    })

    test('list filters by project_id', () => {
      const projId = seedProject(db)

      SourceRepo.create(db, { title: 'With Project', description: 'a', project_id: projId })
      SourceRepo.create(db, { title: 'No Project', description: 'b' })

      const result = SourceRepo.list(db, { project_id: projId }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].title).toBe('With Project')
    })

    test('list with combined filters', () => {
      const empId = seedEmployer(db)
      seedSource(db, { title: 'Match', status: 'approved', employerId: empId })
      seedSource(db, { title: 'Wrong Status', status: 'draft', employerId: empId })
      seedSource(db, { title: 'Wrong Employer', status: 'approved' })

      const result = SourceRepo.list(db, { status: 'approved', employer_id: empId }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].title).toBe('Match')
    })
  })

  // ── List pagination ───────────────────────────────────────────────

  describe('list pagination', () => {
    test('limit restricts returned rows but total reflects all matches', () => {
      for (let i = 0; i < 5; i++) {
        SourceRepo.create(db, { title: `Source ${i}`, description: `desc ${i}` })
      }

      const result = SourceRepo.list(db, {}, 0, 2)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(5)
    })

    test('offset skips rows', () => {
      for (let i = 0; i < 5; i++) {
        SourceRepo.create(db, { title: `Source ${i}`, description: `desc ${i}` })
      }

      const page1 = SourceRepo.list(db, {}, 0, 2)
      const page2 = SourceRepo.list(db, {}, 2, 2)

      expect(page1.data).toHaveLength(2)
      expect(page2.data).toHaveLength(2)
      expect(page1.total).toBe(5)
      expect(page2.total).toBe(5)

      // Pages should not overlap
      const page1Ids = page1.data.map((s) => s.id)
      const page2Ids = page2.data.map((s) => s.id)
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id)
      }
    })

    test('offset beyond total returns empty data with correct total', () => {
      SourceRepo.create(db, { title: 'Only One', description: 'desc' })

      const result = SourceRepo.list(db, {}, 100, 50)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(1)
    })
  })

  // ── Delete with bullets → FK error ────────────────────────────────

  describe('delete with FK constraint', () => {
    test('delete throws when source has bullets (FK RESTRICT)', () => {
      const sourceId = seedSource(db)
      seedBullet(db, sourceId)

      expect(() => {
        SourceRepo.del(db, sourceId)
      }).toThrow()
    })
  })

  // ── acquireDerivingLock ───────────────────────────────────────────

  describe('acquireDerivingLock', () => {
    test('acquires lock on a non-deriving source', () => {
      const source = SourceRepo.create(db, {
        title: 'Lockable',
        description: 'desc',
      })
      expect(source.status).toBe('draft')

      const locked = SourceRepo.acquireDerivingLock(db, source.id)
      expect(locked).not.toBeNull()
      expect(locked!.status).toBe('deriving')
      expect(locked!.id).toBe(source.id)
    })

    test('acquires lock on an approved source', () => {
      const id = seedSource(db, { status: 'approved' })
      const locked = SourceRepo.acquireDerivingLock(db, id)
      expect(locked).not.toBeNull()
      expect(locked!.status).toBe('deriving')
    })

    test('returns null when source is already deriving', () => {
      const source = SourceRepo.create(db, {
        title: 'Already Locked',
        description: 'desc',
      })

      // First lock succeeds
      const first = SourceRepo.acquireDerivingLock(db, source.id)
      expect(first).not.toBeNull()

      // Second lock fails
      const second = SourceRepo.acquireDerivingLock(db, source.id)
      expect(second).toBeNull()
    })

    test('returns null for nonexistent source', () => {
      const result = SourceRepo.acquireDerivingLock(db, crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ── releaseDerivingLock ───────────────────────────────────────────

  describe('releaseDerivingLock', () => {
    test('restores status without setting last_derived_at when derived=false', () => {
      const source = SourceRepo.create(db, {
        title: 'Release Test',
        description: 'desc',
      })

      SourceRepo.acquireDerivingLock(db, source.id)
      SourceRepo.releaseDerivingLock(db, source.id, 'draft', false)

      const after = SourceRepo.get(db, source.id)
      expect(after!.status).toBe('draft')
      expect(after!.last_derived_at).toBeNull()
    })

    test('restores status and sets last_derived_at when derived=true', () => {
      const source = SourceRepo.create(db, {
        title: 'Derived Test',
        description: 'desc',
      })

      SourceRepo.acquireDerivingLock(db, source.id)
      SourceRepo.releaseDerivingLock(db, source.id, 'approved', true)

      const after = SourceRepo.get(db, source.id)
      expect(after!.status).toBe('approved')
      expect(after!.last_derived_at).not.toBeNull()
      // Verify it's an ISO 8601 string
      expect(after!.last_derived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('updates updated_at on release', () => {
      const source = SourceRepo.create(db, {
        title: 'Timestamp Test',
        description: 'desc',
      })
      const beforeLock = source.updated_at

      SourceRepo.acquireDerivingLock(db, source.id)
      SourceRepo.releaseDerivingLock(db, source.id, 'draft', false)

      const after = SourceRepo.get(db, source.id)
      expect(after!.updated_at).not.toBe(beforeLock)
    })
  })
})
