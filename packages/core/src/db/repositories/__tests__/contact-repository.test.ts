/**
 * Tests for ContactRepository -- CRUD operations, relationship management,
 * and reverse lookups for the contacts table and junction tables.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization, seedJobDescription, seedResume } from '../../__tests__/helpers'
import * as ContactRepo from '../contact-repository'

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
// ContactRepository -- CRUD
// ===========================================================================

describe('ContactRepository', () => {
  test('create returns a contact with generated id and org name', () => {
    const orgId = seedOrganization(db, { name: 'Acme Corp' })
    const contact = ContactRepo.create(db, {
      name: 'Jane Smith',
      title: 'Engineering Manager',
      email: 'jane@acme.com',
      organization_id: orgId,
    })

    expect(contact.id).toHaveLength(36)
    expect(contact.name).toBe('Jane Smith')
    expect(contact.title).toBe('Engineering Manager')
    expect(contact.email).toBe('jane@acme.com')
    expect(contact.organization_name).toBe('Acme Corp')
    expect(contact.phone).toBeNull()
    expect(contact.linkedin).toBeNull()
    expect(contact.team).toBeNull()
    expect(contact.dept).toBeNull()
    expect(contact.notes).toBeNull()
    expect(contact.created_at).toBeTruthy()
    expect(contact.updated_at).toBeTruthy()
  })

  test('create with minimal fields', () => {
    const contact = ContactRepo.create(db, { name: 'John Doe' })

    expect(contact.name).toBe('John Doe')
    expect(contact.organization_id).toBeNull()
    expect(contact.organization_name).toBeNull()
  })

  test('get returns contact with organization_name', () => {
    const orgId = seedOrganization(db, { name: 'TechCo' })
    const created = ContactRepo.create(db, {
      name: 'Alice',
      organization_id: orgId,
    })

    const fetched = ContactRepo.get(db, created.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe('Alice')
    expect(fetched!.organization_name).toBe('TechCo')
  })

  test('get returns null for non-existent id', () => {
    const result = ContactRepo.get(db, crypto.randomUUID())
    expect(result).toBeNull()
  })

  test('list returns contacts sorted by name ASC', () => {
    ContactRepo.create(db, { name: 'Charlie' })
    ContactRepo.create(db, { name: 'Alice' })
    ContactRepo.create(db, { name: 'Bob' })

    const result = ContactRepo.list(db)

    expect(result.total).toBe(3)
    expect(result.data.length).toBe(3)
    expect(result.data[0].name).toBe('Alice')
    expect(result.data[1].name).toBe('Bob')
    expect(result.data[2].name).toBe('Charlie')
  })

  test('list with search filter matches on name, title, email (case-insensitive)', () => {
    ContactRepo.create(db, { name: 'Jane Smith', title: 'Manager' })
    ContactRepo.create(db, { name: 'Bob Jones', email: 'bjones@smith.com' })
    ContactRepo.create(db, { name: 'Alice', title: 'Smith Team Lead' })
    ContactRepo.create(db, { name: 'No Match' })

    const result = ContactRepo.list(db, { search: 'smith' })

    expect(result.total).toBe(3)
    expect(result.data.map(c => c.name).sort()).toEqual(
      ['Alice', 'Bob Jones', 'Jane Smith'],
    )
  })

  test('list with organization_id filter returns only that org contacts', () => {
    const orgA = seedOrganization(db, { name: 'Org A' })
    const orgB = seedOrganization(db, { name: 'Org B' })
    ContactRepo.create(db, { name: 'At A', organization_id: orgA })
    ContactRepo.create(db, { name: 'At B', organization_id: orgB })
    ContactRepo.create(db, { name: 'No Org' })

    const result = ContactRepo.list(db, { organization_id: orgA })

    expect(result.total).toBe(1)
    expect(result.data[0].name).toBe('At A')
  })

  test('list with pagination', () => {
    for (let i = 0; i < 5; i++) {
      ContactRepo.create(db, { name: `Contact ${String.fromCharCode(65 + i)}` })
    }

    const page1 = ContactRepo.list(db, undefined, 0, 2)
    expect(page1.total).toBe(5)
    expect(page1.data.length).toBe(2)
    expect(page1.data[0].name).toBe('Contact A')
    expect(page1.data[1].name).toBe('Contact B')

    const page2 = ContactRepo.list(db, undefined, 2, 2)
    expect(page2.data.length).toBe(2)
    expect(page2.data[0].name).toBe('Contact C')
  })

  test('update updates specified fields and leaves others unchanged', () => {
    const orgId = seedOrganization(db, { name: 'OrigOrg' })
    const contact = ContactRepo.create(db, {
      name: 'Original',
      title: 'Dev',
      email: 'orig@test.com',
      organization_id: orgId,
    })

    const updated = ContactRepo.update(db, contact.id, {
      title: 'Senior Dev',
      team: 'Platform',
    })

    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Original') // unchanged
    expect(updated!.title).toBe('Senior Dev') // changed
    expect(updated!.email).toBe('orig@test.com') // unchanged
    expect(updated!.team).toBe('Platform') // changed
    expect(updated!.organization_name).toBe('OrigOrg') // unchanged
  })

  test('update can set fields to null', () => {
    const contact = ContactRepo.create(db, {
      name: 'Test',
      email: 'test@test.com',
    })

    const updated = ContactRepo.update(db, contact.id, { email: null })

    expect(updated!.email).toBeNull()
  })

  test('update returns null for non-existent id', () => {
    const result = ContactRepo.update(db, crypto.randomUUID(), { name: 'New' })
    expect(result).toBeNull()
  })

  test('del removes contact and returns true', () => {
    const contact = ContactRepo.create(db, { name: 'ToDelete' })
    const deleted = ContactRepo.del(db, contact.id)

    expect(deleted).toBe(true)
    expect(ContactRepo.get(db, contact.id)).toBeNull()
  })

  test('del returns false for non-existent id', () => {
    const deleted = ContactRepo.del(db, crypto.randomUUID())
    expect(deleted).toBe(false)
  })

  test('del cascades to junction tables', () => {
    const orgId = seedOrganization(db)
    const contact = ContactRepo.create(db, { name: 'Cascade Test' })
    ContactRepo.addOrganization(db, contact.id, orgId, 'peer')

    ContactRepo.del(db, contact.id)

    const rows = db.query('SELECT * FROM contact_organizations WHERE contact_id = ?')
      .all(contact.id)
    expect(rows).toHaveLength(0)
  })

  // =========================================================================
  // Organization relationships
  // =========================================================================

  test('addOrganization / listOrganizations / removeOrganization', () => {
    const orgId = seedOrganization(db, { name: 'TestOrg' })
    const contact = ContactRepo.create(db, { name: 'Person' })

    ContactRepo.addOrganization(db, contact.id, orgId, 'recruiter')

    const orgs = ContactRepo.listOrganizations(db, contact.id)
    expect(orgs).toHaveLength(1)
    expect(orgs[0].id).toBe(orgId)
    expect(orgs[0].name).toBe('TestOrg')
    expect(orgs[0].relationship).toBe('recruiter')

    ContactRepo.removeOrganization(db, contact.id, orgId, 'recruiter')

    const afterRemove = ContactRepo.listOrganizations(db, contact.id)
    expect(afterRemove).toHaveLength(0)
  })

  test('addOrganization is idempotent (INSERT OR IGNORE)', () => {
    const orgId = seedOrganization(db)
    const contact = ContactRepo.create(db, { name: 'Person' })

    ContactRepo.addOrganization(db, contact.id, orgId, 'peer')
    ContactRepo.addOrganization(db, contact.id, orgId, 'peer') // duplicate

    const orgs = ContactRepo.listOrganizations(db, contact.id)
    expect(orgs).toHaveLength(1)
  })

  test('same contact+org can have multiple relationship types', () => {
    const orgId = seedOrganization(db)
    const contact = ContactRepo.create(db, { name: 'MultiRel' })

    ContactRepo.addOrganization(db, contact.id, orgId, 'peer')
    ContactRepo.addOrganization(db, contact.id, orgId, 'referral')

    const orgs = ContactRepo.listOrganizations(db, contact.id)
    expect(orgs).toHaveLength(2)
  })

  // =========================================================================
  // Job Description relationships
  // =========================================================================

  test('addJobDescription / listJobDescriptions / removeJobDescription', () => {
    const orgId = seedOrganization(db, { name: 'JDOrg' })
    const jdId = seedJobDescription(db, { organizationId: orgId, title: 'SWE' })
    const contact = ContactRepo.create(db, { name: 'JDPerson' })

    ContactRepo.addJobDescription(db, contact.id, jdId, 'hiring_manager')

    const jds = ContactRepo.listJobDescriptions(db, contact.id)
    expect(jds).toHaveLength(1)
    expect(jds[0].id).toBe(jdId)
    expect(jds[0].title).toBe('SWE')
    expect(jds[0].organization_name).toBe('JDOrg')
    expect(jds[0].relationship).toBe('hiring_manager')

    ContactRepo.removeJobDescription(db, contact.id, jdId, 'hiring_manager')
    expect(ContactRepo.listJobDescriptions(db, contact.id)).toHaveLength(0)
  })

  // =========================================================================
  // Resume relationships
  // =========================================================================

  test('addResume / listResumes / removeResume', () => {
    const resumeId = seedResume(db, { name: 'My Resume' })
    const contact = ContactRepo.create(db, { name: 'ResPerson' })

    ContactRepo.addResume(db, contact.id, resumeId, 'reference')

    const resumes = ContactRepo.listResumes(db, contact.id)
    expect(resumes).toHaveLength(1)
    expect(resumes[0].id).toBe(resumeId)
    expect(resumes[0].name).toBe('My Resume')
    expect(resumes[0].relationship).toBe('reference')

    ContactRepo.removeResume(db, contact.id, resumeId, 'reference')
    expect(ContactRepo.listResumes(db, contact.id)).toHaveLength(0)
  })

  // =========================================================================
  // Reverse lookups
  // =========================================================================

  test('listByOrganization returns contacts linked to an org', () => {
    const orgId = seedOrganization(db, { name: 'ReverseOrg' })
    const c1 = ContactRepo.create(db, { name: 'First', title: 'Dev', email: 'first@test.com' })
    const c2 = ContactRepo.create(db, { name: 'Second' })

    ContactRepo.addOrganization(db, c1.id, orgId, 'peer')
    ContactRepo.addOrganization(db, c2.id, orgId, 'recruiter')

    const links = ContactRepo.listByOrganization(db, orgId)

    expect(links).toHaveLength(2)
    expect(links[0].contact_name).toBe('First')
    expect(links[0].contact_title).toBe('Dev')
    expect(links[0].contact_email).toBe('first@test.com')
    expect(links[0].relationship).toBe('peer')
    expect(links[1].contact_name).toBe('Second')
  })

  test('listByJobDescription returns contacts linked to a JD', () => {
    const jdId = seedJobDescription(db)
    const c1 = ContactRepo.create(db, { name: 'JDContact' })
    ContactRepo.addJobDescription(db, c1.id, jdId, 'interviewer')

    const links = ContactRepo.listByJobDescription(db, jdId)

    expect(links).toHaveLength(1)
    expect(links[0].contact_id).toBe(c1.id)
    expect(links[0].relationship).toBe('interviewer')
  })

  test('listByResume returns contacts linked to a resume', () => {
    const resumeId = seedResume(db)
    const c1 = ContactRepo.create(db, { name: 'ResContact' })
    ContactRepo.addResume(db, c1.id, resumeId, 'recommender')

    const links = ContactRepo.listByResume(db, resumeId)

    expect(links).toHaveLength(1)
    expect(links[0].contact_id).toBe(c1.id)
    expect(links[0].relationship).toBe('recommender')
  })

  test('reverse lookup returns empty array when no contacts linked', () => {
    const orgId = seedOrganization(db)
    expect(ContactRepo.listByOrganization(db, orgId)).toHaveLength(0)
  })
})
