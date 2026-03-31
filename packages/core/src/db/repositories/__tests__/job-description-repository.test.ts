/**
 * Tests for JobDescriptionRepository -- CRUD operations for the job_descriptions table.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedOrganization } from '../../__tests__/helpers'
import * as JDRepo from '../job-description-repository'

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
// JobDescriptionRepository
// ===========================================================================

describe('JobDescriptionRepository', () => {
  // ── create ──────────────────────────────────────────────────────────

  test('create returns a job description with generated id and default status', () => {
    const jd = JDRepo.create(db, {
      title: 'Senior Security Engineer',
      raw_text: 'We are looking for a senior security engineer...',
    })

    expect(jd.id).toHaveLength(36)
    expect(jd.title).toBe('Senior Security Engineer')
    expect(jd.raw_text).toBe('We are looking for a senior security engineer...')
    expect(jd.status).toBe('interested')
    expect(jd.organization_id).toBeNull()
    expect(jd.organization_name).toBeNull()
    expect(jd.url).toBeNull()
    expect(jd.salary_range).toBeNull()
    expect(jd.location).toBeNull()
    expect(jd.notes).toBeNull()
    expect(jd.created_at).toBeTruthy()
    expect(jd.updated_at).toBeTruthy()
  })

  test('create with all optional fields', () => {
    const orgId = seedOrganization(db, { name: 'Cloudflare' })

    const jd = JDRepo.create(db, {
      title: 'Staff Engineer',
      organization_id: orgId,
      url: 'https://boards.greenhouse.io/cloudflare/123',
      raw_text: 'Full JD text here...',
      status: 'applied',
      salary_range: '$180k-$220k',
      location: 'Remote',
      notes: 'Referred by John',
    })

    expect(jd.organization_id).toBe(orgId)
    expect(jd.organization_name).toBe('Cloudflare')
    expect(jd.url).toBe('https://boards.greenhouse.io/cloudflare/123')
    expect(jd.status).toBe('applied')
    expect(jd.salary_range).toBe('$180k-$220k')
    expect(jd.location).toBe('Remote')
    expect(jd.notes).toBe('Referred by John')
  })

  test('create with organization includes organization_name in response', () => {
    const orgId = seedOrganization(db, { name: 'Anthropic' })
    const jd = JDRepo.create(db, {
      title: 'Security Engineer',
      organization_id: orgId,
      raw_text: 'Join us...',
    })

    expect(jd.organization_name).toBe('Anthropic')
  })

  // ── get ─────────────────────────────────────────────────────────────

  test('get returns the job description by id with org name', () => {
    const orgId = seedOrganization(db, { name: 'Google' })
    const jd = JDRepo.create(db, {
      title: 'SRE',
      organization_id: orgId,
      raw_text: 'Site reliability...',
    })
    const fetched = JDRepo.get(db, jd.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(jd.id)
    expect(fetched!.title).toBe('SRE')
    expect(fetched!.organization_name).toBe('Google')
  })

  test('get returns null for nonexistent id', () => {
    expect(JDRepo.get(db, crypto.randomUUID())).toBeNull()
  })

  // ── list ────────────────────────────────────────────────────────────

  test('list returns all job descriptions', () => {
    JDRepo.create(db, { title: 'First', raw_text: 'text' })
    JDRepo.create(db, { title: 'Second', raw_text: 'text' })
    JDRepo.create(db, { title: 'Third', raw_text: 'text' })

    const result = JDRepo.list(db)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(3)
    // All three titles should be present
    const titles = result.data.map((jd) => jd.title).sort()
    expect(titles).toEqual(['First', 'Second', 'Third'])
  })

  test('list filters by status', () => {
    JDRepo.create(db, { title: 'A', raw_text: 'text', status: 'interested' })
    JDRepo.create(db, { title: 'B', raw_text: 'text', status: 'applied' })
    JDRepo.create(db, { title: 'C', raw_text: 'text', status: 'applied' })

    const result = JDRepo.list(db, { status: 'applied' })
    expect(result.total).toBe(2)
    expect(result.data.every((jd) => jd.status === 'applied')).toBe(true)
  })

  test('list filters by organization_id', () => {
    const org1 = seedOrganization(db, { name: 'Org1' })
    const org2 = seedOrganization(db, { name: 'Org2' })
    JDRepo.create(db, {
      title: 'JD1',
      organization_id: org1,
      raw_text: 'text',
    })
    JDRepo.create(db, {
      title: 'JD2',
      organization_id: org2,
      raw_text: 'text',
    })
    JDRepo.create(db, {
      title: 'JD3',
      organization_id: org1,
      raw_text: 'text',
    })

    const result = JDRepo.list(db, { organization_id: org1 })
    expect(result.total).toBe(2)
    expect(result.data.every((jd) => jd.organization_id === org1)).toBe(true)
  })

  test('list filters by both status AND organization_id', () => {
    const orgId = seedOrganization(db, { name: 'Target' })
    JDRepo.create(db, {
      title: 'Match',
      organization_id: orgId,
      raw_text: 'text',
      status: 'applied',
    })
    JDRepo.create(db, {
      title: 'WrongStatus',
      organization_id: orgId,
      raw_text: 'text',
      status: 'interested',
    })
    JDRepo.create(db, {
      title: 'WrongOrg',
      raw_text: 'text',
      status: 'applied',
    })

    const result = JDRepo.list(db, {
      status: 'applied',
      organization_id: orgId,
    })
    expect(result.total).toBe(1)
    expect(result.data[0].title).toBe('Match')
  })

  test('list includes organization_name per item', () => {
    const orgId = seedOrganization(db, { name: 'Anthropic' })
    JDRepo.create(db, {
      title: 'With Org',
      organization_id: orgId,
      raw_text: 'text',
    })
    JDRepo.create(db, { title: 'No Org', raw_text: 'text' })

    const result = JDRepo.list(db)
    const withOrg = result.data.find((jd) => jd.title === 'With Org')
    const noOrg = result.data.find((jd) => jd.title === 'No Org')

    expect(withOrg!.organization_name).toBe('Anthropic')
    expect(noOrg!.organization_name).toBeNull()
  })

  test('list supports pagination', () => {
    JDRepo.create(db, { title: 'A', raw_text: 'text' })
    JDRepo.create(db, { title: 'B', raw_text: 'text' })
    JDRepo.create(db, { title: 'C', raw_text: 'text' })

    const page1 = JDRepo.list(db, undefined, 0, 2)
    expect(page1.data).toHaveLength(2)
    expect(page1.total).toBe(3)

    const page2 = JDRepo.list(db, undefined, 2, 2)
    expect(page2.data).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  // ── update ──────────────────────────────────────────────────────────

  test('update modifies specified fields and refreshes updated_at', () => {
    const jd = JDRepo.create(db, {
      title: 'OldTitle',
      raw_text: 'old text',
    })
    const updated = JDRepo.update(db, jd.id, {
      title: 'NewTitle',
      status: 'applied',
    })

    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('NewTitle')
    expect(updated!.status).toBe('applied')
    expect(updated!.raw_text).toBe('old text') // unchanged
  })

  test('update can set organization_id to null', () => {
    const orgId = seedOrganization(db, { name: 'Corp' })
    const jd = JDRepo.create(db, {
      title: 'JD',
      organization_id: orgId,
      raw_text: 'text',
    })
    expect(jd.organization_id).toBe(orgId)

    const updated = JDRepo.update(db, jd.id, { organization_id: null })
    expect(updated!.organization_id).toBeNull()
    expect(updated!.organization_name).toBeNull()
  })

  test('update can change organization_id and organization_name updates', () => {
    const org1 = seedOrganization(db, { name: 'OrgOne' })
    const org2 = seedOrganization(db, { name: 'OrgTwo' })
    const jd = JDRepo.create(db, {
      title: 'JD',
      organization_id: org1,
      raw_text: 'text',
    })
    expect(jd.organization_name).toBe('OrgOne')

    const updated = JDRepo.update(db, jd.id, { organization_id: org2 })
    expect(updated!.organization_name).toBe('OrgTwo')
  })

  test('update returns null for nonexistent id', () => {
    expect(
      JDRepo.update(db, crypto.randomUUID(), { title: 'X' }),
    ).toBeNull()
  })

  // ── del ─────────────────────────────────────────────────────────────

  test('del removes the job description', () => {
    const jd = JDRepo.create(db, { title: 'Temp', raw_text: 'text' })
    const deleted = JDRepo.del(db, jd.id)

    expect(deleted).toBe(true)
    expect(JDRepo.get(db, jd.id)).toBeNull()
  })

  test('del returns false for nonexistent id', () => {
    expect(JDRepo.del(db, crypto.randomUUID())).toBe(false)
  })

  // ── ON DELETE SET NULL ──────────────────────────────────────────────

  test('deleting organization sets organization_id to null on linked JDs', () => {
    const orgId = seedOrganization(db, { name: 'Doomed Corp' })
    const jd = JDRepo.create(db, {
      title: 'Linked JD',
      organization_id: orgId,
      raw_text: 'text',
    })
    expect(jd.organization_id).toBe(orgId)

    // Delete the organization
    db.run('DELETE FROM organizations WHERE id = ?', [orgId])

    // JD should still exist but with organization_id = null
    const fetched = JDRepo.get(db, jd.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.organization_id).toBeNull()
    expect(fetched!.organization_name).toBeNull()
  })

  // ── CHECK constraint ───────────────────────────────────────────────

  test('CHECK constraint rejects invalid status values', () => {
    expect(() => {
      db.run(
        `INSERT INTO job_descriptions (id, title, raw_text, status)
         VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Bad', 'text', 'invalid_status'],
      )
    }).toThrow()
  })

  // ── note_references entity_type ────────────────────────────────────

  test('note_references accepts job_description entity_type', () => {
    const jdId = JDRepo.create(db, {
      title: 'JD',
      raw_text: 'text',
    }).id

    // Create a note first
    const noteId = crypto.randomUUID()
    db.run(
      `INSERT INTO user_notes (id, content) VALUES (?, ?)`,
      [noteId, 'Note about this JD'],
    )

    // Link note to JD
    expect(() => {
      db.run(
        `INSERT INTO note_references (note_id, entity_type, entity_id)
         VALUES (?, 'job_description', ?)`,
        [noteId, jdId],
      )
    }).not.toThrow()

    // Verify it was inserted
    const ref = db
      .query(
        `SELECT * FROM note_references WHERE note_id = ? AND entity_type = 'job_description'`,
      )
      .get(noteId)
    expect(ref).not.toBeNull()
  })

  test('note_references still rejects invalid entity_type', () => {
    const noteId = crypto.randomUUID()
    db.run(
      `INSERT INTO user_notes (id, content) VALUES (?, ?)`,
      [noteId, 'Test'],
    )

    expect(() => {
      db.run(
        `INSERT INTO note_references (note_id, entity_type, entity_id)
         VALUES (?, 'invalid_type', ?)`,
        [noteId, 'some-id'],
      )
    }).toThrow()
  })
})
