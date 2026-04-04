/**
 * Tests for OrganizationRepository — CRUD operations for the organizations table.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb } from '../../__tests__/helpers'
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
// OrganizationRepository
// ===========================================================================

describe('OrganizationRepository', () => {
  test('create returns an organization with generated id', () => {
    const org = OrgRepo.create(db, { name: 'Acme Corp' })

    expect(org.id).toHaveLength(36)
    expect(org.name).toBe('Acme Corp')
    expect(org.org_type).toBe('company')
    expect(org.worked).toBe(0)
    expect(org.industry).toBeNull()
    expect(org.created_at).toBeTruthy()
    expect(org.updated_at).toBeTruthy()
  })

  test('create with all optional fields', () => {
    const org = OrgRepo.create(db, {
      name: 'SecureGov',
      org_type: 'government',
      industry: 'Defense',
      size: '10000+',
      worked: 1,
      employment_type: 'civilian',
      website: 'https://securegov.example.com',
      linkedin_url: 'https://linkedin.com/company/securegov',
      glassdoor_url: 'https://glassdoor.com/securegov',
      glassdoor_rating: 4.2,
      reputation_notes: 'Well-known agency',
      notes: 'Internal notes',
    })

    expect(org.org_type).toBe('government')
    expect(org.industry).toBe('Defense')
    expect(org.size).toBe('10000+')
    expect(org.worked).toBe(1)
    expect(org.employment_type).toBe('civilian')
    expect(org.website).toBe('https://securegov.example.com')
    expect(org.linkedin_url).toBe('https://linkedin.com/company/securegov')
    expect(org.glassdoor_url).toBe('https://glassdoor.com/securegov')
    expect(org.glassdoor_rating).toBe(4.2)
    expect(org.reputation_notes).toBe('Well-known agency')
    expect(org.notes).toBe('Internal notes')
  })

  test('get returns the organization by id', () => {
    const org = OrgRepo.create(db, { name: 'TestOrg' })
    const fetched = OrgRepo.get(db, org.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(org.id)
    expect(fetched!.name).toBe('TestOrg')
  })

  test('get returns null for nonexistent id', () => {
    expect(OrgRepo.get(db, crypto.randomUUID())).toBeNull()
  })

  test('list returns all organizations ordered by name', () => {
    OrgRepo.create(db, { name: 'Zebra Inc' })
    OrgRepo.create(db, { name: 'Alpha LLC' })
    OrgRepo.create(db, { name: 'Meta Corp' })

    const result = OrgRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(3)
    expect(result.data[0].name).toBe('Alpha LLC')
    expect(result.data[1].name).toBe('Meta Corp')
    expect(result.data[2].name).toBe('Zebra Inc')
  })

  test('list filters by org_type', () => {
    OrgRepo.create(db, { name: 'Acme', org_type: 'company' })
    OrgRepo.create(db, { name: 'DoD', org_type: 'government' })
    OrgRepo.create(db, { name: 'MIT', org_type: 'education' })

    const result = OrgRepo.list(db, { org_type: 'government' })
    expect(result.total).toBe(1)
    expect(result.data[0].name).toBe('DoD')
  })

  test('list filters by worked', () => {
    OrgRepo.create(db, { name: 'CurrentJob', worked: 1 })
    OrgRepo.create(db, { name: 'TargetCo', worked: 0 })

    const worked = OrgRepo.list(db, { worked: 1 })
    expect(worked.total).toBe(1)
    expect(worked.data[0].name).toBe('CurrentJob')

    const notWorked = OrgRepo.list(db, { worked: 0 })
    expect(notWorked.total).toBe(1)
    expect(notWorked.data[0].name).toBe('TargetCo')
  })

  test('list searches by name', () => {
    OrgRepo.create(db, { name: 'Anthropic' })
    OrgRepo.create(db, { name: 'Google DeepMind' })
    OrgRepo.create(db, { name: 'OpenAI' })

    const result = OrgRepo.list(db, { search: 'Deep' })
    expect(result.total).toBe(1)
    expect(result.data[0].name).toBe('Google DeepMind')
  })

  test('list supports pagination', () => {
    OrgRepo.create(db, { name: 'A' })
    OrgRepo.create(db, { name: 'B' })
    OrgRepo.create(db, { name: 'C' })

    const page1 = OrgRepo.list(db, undefined, 0, 2)
    expect(page1.data).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.data[0].name).toBe('A')
    expect(page1.data[1].name).toBe('B')

    const page2 = OrgRepo.list(db, undefined, 2, 2)
    expect(page2.data).toHaveLength(1)
    expect(page2.total).toBe(3)
    expect(page2.data[0].name).toBe('C')
  })

  test('update modifies specified fields and refreshes updated_at', () => {
    const org = OrgRepo.create(db, { name: 'OldName' })
    const updated = OrgRepo.update(db, org.id, {
      name: 'NewName',
      industry: 'Tech',
    })

    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('NewName')
    expect(updated!.industry).toBe('Tech')
    // org_type should be unchanged
    expect(updated!.org_type).toBe('company')
  })

  test('update returns null for nonexistent id', () => {
    expect(OrgRepo.update(db, crypto.randomUUID(), { name: 'X' })).toBeNull()
  })

  test('del removes the organization', () => {
    const org = OrgRepo.create(db, { name: 'Temp' })
    const deleted = OrgRepo.del(db, org.id)

    expect(deleted).toBe(true)
    expect(OrgRepo.get(db, org.id)).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    expect(OrgRepo.del(db, crypto.randomUUID())).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Status field tests (Phase 18)
  // ---------------------------------------------------------------------------

  test('create with status persists the value', () => {
    const org = OrgRepo.create(db, { name: 'StatusOrg', status: 'interested' })
    expect(org.status).toBe('interested')

    const fetched = OrgRepo.get(db, org.id)
    expect(fetched!.status).toBe('interested')
  })

  test('create without status defaults to null', () => {
    const org = OrgRepo.create(db, { name: 'NoStatusOrg' })
    expect(org.status).toBeNull()
  })

  test('list with status filter returns matching orgs only', () => {
    OrgRepo.create(db, { name: 'OrgA', status: 'backlog' })
    OrgRepo.create(db, { name: 'OrgB', status: 'researching' })
    OrgRepo.create(db, { name: 'OrgC', status: 'backlog' })
    OrgRepo.create(db, { name: 'OrgD' }) // null status

    const backlog = OrgRepo.list(db, { status: 'backlog' })
    expect(backlog.total).toBe(2)
    expect(backlog.data.map(o => o.name).sort()).toEqual(['OrgA', 'OrgC'])
  })

  test('list with status filter returns empty when none match', () => {
    OrgRepo.create(db, { name: 'OrgX', status: 'backlog' })
    OrgRepo.create(db, { name: 'OrgY' })

    const result = OrgRepo.list(db, { status: 'exciting' })
    expect(result.total).toBe(0)
    expect(result.data).toHaveLength(0)
  })

  test('list with status + org_type combined filter', () => {
    OrgRepo.create(db, { name: 'GovA', org_type: 'government', status: 'backlog' })
    OrgRepo.create(db, { name: 'GovB', org_type: 'government', status: 'researching' })
    OrgRepo.create(db, { name: 'CoA', org_type: 'company', status: 'backlog' })

    const result = OrgRepo.list(db, { org_type: 'government', status: 'backlog' })
    expect(result.total).toBe(1)
    expect(result.data[0].name).toBe('GovA')
  })

  test('update can change status', () => {
    const org = OrgRepo.create(db, { name: 'Evolving', status: 'backlog' })
    const updated = OrgRepo.update(db, org.id, { status: 'researching' })
    expect(updated!.status).toBe('researching')

    const updated2 = OrgRepo.update(db, updated!.id, { status: 'exciting' })
    expect(updated2!.status).toBe('exciting')
  })

  test('update can clear status to null', () => {
    const org = OrgRepo.create(db, { name: 'ResetMe', status: 'excluded' })
    expect(org.status).toBe('excluded')

    const updated = OrgRepo.update(db, org.id, { status: null as any })
    expect(updated!.status).toBeNull()
  })
})
