import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import * as SourceRepo from '../source-repository'
import { createTestDb, seedSource, seedOrganization } from '../../__tests__/helpers'
import type { SourceRole, SourceProject, SourceEducation, SourceClearance } from '../../../types'

describe('SourceRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    test('creates a general source with no extension', () => {
      const source = SourceRepo.create(db, {
        title: 'General Note',
        description: 'A general source.',
      })

      expect(source.id).toHaveLength(36)
      expect(source.title).toBe('General Note')
      expect(source.description).toBe('A general source.')
      expect(source.source_type).toBe('general')
      expect(source.status).toBe('draft')
      expect(source.extension).toBeNull()
      expect(source.created_at).toBeTruthy()
      expect(source.updated_at).toBeTruthy()
    })

    test('creates a role source with extension', () => {
      const orgId = seedOrganization(db)
      const source = SourceRepo.create(db, {
        title: 'Senior Engineer',
        description: 'Led cloud migration.',
        source_type: 'role',
        organization_id: orgId,
        is_current: 1,
        start_date: '2024-01-01',
      })

      expect(source.source_type).toBe('role')
      expect(source.extension).not.toBeNull()
      const ext = source.extension as SourceRole
      expect(ext.organization_id).toBe(orgId)
      expect(ext.is_current).toBe(1)
      expect(ext.start_date).toBe('2024-01-01')
    })

    test('creates a project source with extension', () => {
      const source = SourceRepo.create(db, {
        title: 'Open Source Tool',
        description: 'Built a CLI tool.',
        source_type: 'project',
        is_personal: 1,
        url: 'https://github.com/test/tool',
      })

      expect(source.source_type).toBe('project')
      expect(source.extension).not.toBeNull()
      const ext = source.extension as SourceProject
      expect(ext.is_personal).toBe(1)
      expect(ext.url).toBe('https://github.com/test/tool')
    })

    test('creates an education source with extension', () => {
      const source = SourceRepo.create(db, {
        title: 'AWS Solutions Architect',
        description: 'Cloud certification.',
        source_type: 'education',
        education_type: 'certificate',
        institution: 'AWS',
        issuing_body: 'Amazon Web Services',
      })

      expect(source.source_type).toBe('education')
      expect(source.extension).not.toBeNull()
      const ext = source.extension as SourceEducation
      expect(ext.education_type).toBe('certificate')
      expect(ext.institution).toBe('AWS')
      expect(ext.issuing_body).toBe('Amazon Web Services')
    })

    test('creates a clearance source with extension', () => {
      const source = SourceRepo.create(db, {
        title: 'TS/SCI',
        description: 'Top Secret clearance.',
        source_type: 'clearance',
        level: 'TS/SCI',
        polygraph: 'CI',
      })

      expect(source.source_type).toBe('clearance')
      expect(source.extension).not.toBeNull()
      const ext = source.extension as SourceClearance
      expect(ext.level).toBe('TS/SCI')
      expect(ext.polygraph).toBe('CI')
    })

    test('sets default source_type to general when not specified', () => {
      const source = SourceRepo.create(db, {
        title: 'Test',
        description: 'Test desc.',
      })
      expect(source.source_type).toBe('general')
    })

    test('creates a degree education source with sub-type fields', () => {
      const source = SourceRepo.create(db, {
        title: 'MS Computer Science',
        description: 'Graduate degree in CS.',
        source_type: 'education',
        education_type: 'degree',
        degree_level: 'masters',
        degree_type: 'MS',
        institution: 'MIT',
        field: 'Computer Science',
        gpa: '3.9/4.0',
        location: 'Cambridge, MA',
        edu_description: 'Focus on distributed systems.',
        start_date: '2020-08-01',
        end_date: '2022-05-15',
      })

      expect(source.source_type).toBe('education')
      const ext = source.extension as SourceEducation
      expect(ext.education_type).toBe('degree')
      expect(ext.degree_level).toBe('masters')
      expect(ext.degree_type).toBe('MS')
      expect(ext.gpa).toBe('3.9/4.0')
      expect(ext.location).toBe('Cambridge, MA')
      expect(ext.edu_description).toBe('Focus on distributed systems.')
    })

    test('creates a certificate source with certificate_subtype', () => {
      const source = SourceRepo.create(db, {
        title: 'AWS SAA',
        description: 'Cloud cert.',
        source_type: 'education',
        education_type: 'certificate',
        certificate_subtype: 'vendor',
        issuing_body: 'Amazon Web Services',
        credential_id: 'ABC-123',
      })

      const ext = source.extension as SourceEducation
      expect(ext.certificate_subtype).toBe('vendor')
      expect(ext.issuing_body).toBe('Amazon Web Services')
      expect(ext.credential_id).toBe('ABC-123')
    })

    test('creates a course source with location', () => {
      const source = SourceRepo.create(db, {
        title: 'SANS SEC504',
        description: 'Hacker Tools.',
        source_type: 'education',
        education_type: 'course',
        institution: 'SANS Institute',
        location: 'Las Vegas, NV',
        edu_description: 'Hands-on incident response training.',
      })

      const ext = source.extension as SourceEducation
      expect(ext.education_type).toBe('course')
      expect(ext.location).toBe('Las Vegas, NV')
      expect(ext.edu_description).toBe('Hands-on incident response training.')
    })

    test('creates a self_taught source with edu_description', () => {
      const source = SourceRepo.create(db, {
        title: 'Rust Programming',
        description: 'Self-taught Rust.',
        source_type: 'education',
        education_type: 'self_taught',
        edu_description: 'Learned Rust through the Book and open-source contributions.',
        url: 'https://github.com/my-rust-projects',
      })

      const ext = source.extension as SourceEducation
      expect(ext.education_type).toBe('self_taught')
      expect(ext.edu_description).toBe('Learned Rust through the Book and open-source contributions.')
      expect(ext.url).toBe('https://github.com/my-rust-projects')
      // degree-specific fields should be null
      expect(ext.degree_level).toBeNull()
      expect(ext.degree_type).toBeNull()
      expect(ext.gpa).toBeNull()
    })

    test('new education fields default to null when omitted', () => {
      const source = SourceRepo.create(db, {
        title: 'Legacy Cert',
        description: 'Old cert without sub-type.',
        source_type: 'education',
        education_type: 'certificate',
      })

      const ext = source.extension as SourceEducation
      expect(ext.degree_level).toBeNull()
      expect(ext.degree_type).toBeNull()
      expect(ext.certificate_subtype).toBeNull()
      expect(ext.gpa).toBeNull()
      expect(ext.location).toBeNull()
      expect(ext.edu_description).toBeNull()
    })
  })

  // ── get ─────────────────────────────────────────────────────────────

  describe('get', () => {
    test('returns source with extension', () => {
      const orgId = seedOrganization(db)
      const created = SourceRepo.create(db, {
        title: 'SRE',
        description: 'Site Reliability Engineering.',
        source_type: 'role',
        organization_id: orgId,
      })

      const fetched = SourceRepo.get(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.extension).not.toBeNull()
      expect((fetched!.extension as SourceRole).organization_id).toBe(orgId)
    })

    test('returns null for nonexistent ID', () => {
      const result = SourceRepo.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    test('returns all sources with empty filter', () => {
      SourceRepo.create(db, { title: 'A', description: 'a' })
      SourceRepo.create(db, { title: 'B', description: 'b' })

      const result = SourceRepo.list(db, {}, 0, 50)
      expect(result.total).toBe(2)
      expect(result.data).toHaveLength(2)
    })

    test('filters by source_type', () => {
      SourceRepo.create(db, { title: 'Role', description: 'r', source_type: 'role' })
      SourceRepo.create(db, { title: 'Edu', description: 'e', source_type: 'education' })
      SourceRepo.create(db, { title: 'Gen', description: 'g' })

      const result = SourceRepo.list(db, { source_type: 'role' }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].source_type).toBe('role')
    })

    test('filters by status', () => {
      SourceRepo.create(db, { title: 'Draft', description: 'draft' })
      // Seed an approved source directly
      seedSource(db, { title: 'Approved', status: 'approved' })

      const result = SourceRepo.list(db, { status: 'draft' }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].title).toBe('Draft')
    })

    test('filters by organization_id via extension JOIN', () => {
      const orgId = seedOrganization(db)
      SourceRepo.create(db, {
        title: 'Role at Org',
        description: 'role',
        source_type: 'role',
        organization_id: orgId,
      })
      SourceRepo.create(db, {
        title: 'Role no Org',
        description: 'role',
        source_type: 'role',
      })

      const result = SourceRepo.list(db, { organization_id: orgId }, 0, 50)
      expect(result.total).toBe(1)
      expect(result.data[0].title).toBe('Role at Org')
    })

    test('pagination works', () => {
      for (let i = 0; i < 5; i++) {
        SourceRepo.create(db, { title: `Source ${i}`, description: `desc ${i}` })
      }

      const page1 = SourceRepo.list(db, {}, 0, 2)
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(5)

      const page3 = SourceRepo.list(db, {}, 4, 2)
      expect(page3.data).toHaveLength(1)
      expect(page3.total).toBe(5)
    })
  })

  // ── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    test('updates base fields', () => {
      const source = SourceRepo.create(db, { title: 'Old', description: 'old' })
      const updated = SourceRepo.update(db, source.id, {
        title: 'New Title',
        description: 'New description',
      })

      expect(updated).not.toBeNull()
      expect(updated!.title).toBe('New Title')
      expect(updated!.description).toBe('New description')
    })

    test('updates extension fields for role', () => {
      const orgId = seedOrganization(db)
      const source = SourceRepo.create(db, {
        title: 'Role',
        description: 'r',
        source_type: 'role',
        organization_id: orgId,
      })

      const newOrgId = seedOrganization(db, { name: 'New Corp' })
      const updated = SourceRepo.update(db, source.id, {
        organization_id: newOrgId,
        is_current: 1,
      })

      expect(updated).not.toBeNull()
      const ext = updated!.extension as SourceRole
      expect(ext.organization_id).toBe(newOrgId)
      expect(ext.is_current).toBe(1)
    })

    test('updates notes field', () => {
      const source = SourceRepo.create(db, { title: 'Test', description: 'test' })
      const updated = SourceRepo.update(db, source.id, { notes: 'some notes' })

      expect(updated).not.toBeNull()
      expect(updated!.notes).toBe('some notes')
    })

    test('updates education degree_level', () => {
      const source = SourceRepo.create(db, {
        title: 'Degree',
        description: 'A degree.',
        source_type: 'education',
        education_type: 'degree',
        degree_level: 'bachelors',
      })

      const updated = SourceRepo.update(db, source.id, { degree_level: 'masters' })
      const ext = updated!.extension as SourceEducation
      expect(ext.degree_level).toBe('masters')
    })

    test('updates gpa with free text format', () => {
      const source = SourceRepo.create(db, {
        title: 'Degree',
        description: 'A degree.',
        source_type: 'education',
        education_type: 'degree',
      })

      const updated = SourceRepo.update(db, source.id, { gpa: '3.8/4.0' })
      const ext = updated!.extension as SourceEducation
      expect(ext.gpa).toBe('3.8/4.0')
    })

    test('clears edu_description to null', () => {
      const source = SourceRepo.create(db, {
        title: 'Self-study',
        description: 'Self-taught.',
        source_type: 'education',
        education_type: 'self_taught',
        edu_description: 'Original description.',
      })

      const updated = SourceRepo.update(db, source.id, { edu_description: null })
      const ext = updated!.extension as SourceEducation
      expect(ext.edu_description).toBeNull()
    })

    test('returns null for nonexistent ID', () => {
      const result = SourceRepo.update(db, crypto.randomUUID(), { title: 'nope' })
      expect(result).toBeNull()
    })
  })

  // ── delete ──────────────────────────────────────────────────────────

  describe('delete', () => {
    test('deletes a source and its extension', () => {
      const source = SourceRepo.create(db, {
        title: 'Role',
        description: 'r',
        source_type: 'role',
      })

      const deleted = SourceRepo.del(db, source.id)
      expect(deleted).toBe(true)
      expect(SourceRepo.get(db, source.id)).toBeNull()
    })

    test('returns false for nonexistent ID', () => {
      const result = SourceRepo.del(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── deriving lock ───────────────────────────────────────────────────

  describe('deriving lock', () => {
    test('acquireDerivingLock sets status to deriving', () => {
      const source = SourceRepo.create(db, { title: 'Test', description: 'test' })

      const locked = SourceRepo.acquireDerivingLock(db, source.id)
      expect(locked).not.toBeNull()
      expect(locked!.status).toBe('deriving')
    })

    test('acquireDerivingLock returns null if already deriving', () => {
      const source = SourceRepo.create(db, { title: 'Test', description: 'test' })

      SourceRepo.acquireDerivingLock(db, source.id)
      const second = SourceRepo.acquireDerivingLock(db, source.id)
      expect(second).toBeNull()
    })

    test('releaseDerivingLock restores status and sets last_derived_at', () => {
      const source = SourceRepo.create(db, { title: 'Test', description: 'test' })

      SourceRepo.acquireDerivingLock(db, source.id)
      SourceRepo.releaseDerivingLock(db, source.id, 'draft', true)

      const fetched = SourceRepo.get(db, source.id)
      expect(fetched!.status).toBe('draft')
      expect(fetched!.last_derived_at).toBeTruthy()
    })

    test('releaseDerivingLock without derived does not set last_derived_at', () => {
      const source = SourceRepo.create(db, { title: 'Test', description: 'test' })

      SourceRepo.acquireDerivingLock(db, source.id)
      SourceRepo.releaseDerivingLock(db, source.id, 'draft', false)

      const fetched = SourceRepo.get(db, source.id)
      expect(fetched!.status).toBe('draft')
      expect(fetched!.last_derived_at).toBeNull()
    })
  })
})
