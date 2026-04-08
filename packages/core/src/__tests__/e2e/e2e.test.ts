/**
 * End-to-end integration tests exercising the full stack:
 * routes -> services -> repositories -> SQLite
 *
 * AI derivation uses the prepare/commit handshake protocol.
 * No AI calls are mocked — the tests simulate the MCP client
 * by calling prepare and then commit with synthetic LLM output.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from '../../routes/__tests__/helpers'
import {
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
  seedResumeEntry,
  seedResumeSection,
  seedOrganization,
  seedUserNote,
} from '../../db/__tests__/helpers'

// ── Derivation helpers ─────────────────────────────────────────────────────

/**
 * Simulate the MCP client bullet derivation handshake:
 * 1. POST /derivations/prepare with entity_type: 'source'
 * 2. POST /derivations/:id/commit with synthetic bullets
 *
 * Returns the committed bullets array.
 */
async function deriveBullets(
  app: any,
  sourceId: string,
  bullets: Array<{ content: string; technologies: string[]; metrics: string | null }>,
) {
  const prepRes = await apiRequest(app, 'POST', '/derivations/prepare', {
    entity_type: 'source',
    entity_id: sourceId,
    client_id: 'test',
  })
  if (prepRes.status !== 201) {
    throw new Error(`deriveBullets prepare failed: ${prepRes.status} ${await prepRes.text()}`)
  }
  const { data: { derivation_id } } = await prepRes.json()

  const commitRes = await apiRequest(app, 'POST', `/derivations/${derivation_id}/commit`, { bullets })
  if (commitRes.status !== 201) {
    throw new Error(`deriveBullets commit failed: ${commitRes.status} ${await commitRes.text()}`)
  }
  return (await commitRes.json()).data as Array<{ id: string; content: string; status: string }>
}

/**
 * Simulate the MCP client perspective derivation handshake:
 * 1. POST /derivations/prepare with entity_type: 'bullet'
 * 2. POST /derivations/:id/commit with synthetic content + reasoning
 *
 * Returns the committed perspective.
 */
async function derivePerspective(
  app: any,
  bulletId: string,
  params: { archetype: string; domain: string; framing: string },
  content: string,
  reasoning: string,
) {
  const prepRes = await apiRequest(app, 'POST', '/derivations/prepare', {
    entity_type: 'bullet',
    entity_id: bulletId,
    client_id: 'test',
    params,
  })
  if (prepRes.status !== 201) {
    throw new Error(`derivePerspective prepare failed: ${prepRes.status} ${await prepRes.text()}`)
  }
  const { data: { derivation_id } } = await prepRes.json()

  const commitRes = await apiRequest(app, 'POST', `/derivations/${derivation_id}/commit`, {
    content,
    reasoning,
  })
  if (commitRes.status !== 201) {
    throw new Error(`derivePerspective commit failed: ${commitRes.status} ${await commitRes.text()}`)
  }
  return (await commitRes.json()).data as { id: string; content: string; status: string; bullet_id: string }
}

// ── E2E-1: Full Derivation Chain ───────────────────────────────────────────

describe('E2E-1: Full Derivation Chain', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('create source -> derive bullets -> approve -> derive perspective -> add to resume entry', async () => {
    // 1. Create source
    const createRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Cloud Forensics Lead',
      description: 'Led a team of 4 engineers to migrate cloud forensics platform from ELK to AWS OpenSearch.',
      source_type: 'role',
    })
    expect(createRes.status).toBe(201)
    const source = (await createRes.json()).data
    expect(source.id).toHaveLength(36)

    // 2. Derive bullets via prepare/commit
    const derivedBullets = await deriveBullets(ctx.app, source.id, [
      {
        content: 'Led migration of forensics platform to AWS OpenSearch',
        technologies: ['AWS', 'OpenSearch'],
        metrics: '4 engineers, 3 months',
      },
    ])
    expect(derivedBullets).toBeArray()
    expect(derivedBullets.length).toBeGreaterThanOrEqual(1)
    const bulletId = derivedBullets[0].id
    expect(derivedBullets[0].status).toBe('in_review')

    // 3. Approve the bullet
    const approveRes = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)
    expect(approveRes.status).toBe(200)
    expect((await approveRes.json()).data.status).toBe('approved')

    // 4. Derive perspective via prepare/commit
    const perspective = await derivePerspective(
      ctx.app,
      bulletId,
      { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
      'Architected cloud-native forensics pipeline using AWS OpenSearch',
      'Reframed for AI/ML archetype focus',
    )
    expect(perspective.id).toHaveLength(36)
    expect(perspective.status).toBe('in_review')

    // 5. Approve perspective
    const approvePerspRes = await apiRequest(ctx.app, 'PATCH', `/perspectives/${perspective.id}/approve`)
    expect(approvePerspRes.status).toBe(200)

    // 6. Create resume
    const resumeRes = await apiRequest(ctx.app, 'POST', '/resumes', {
      name: 'AI Resume',
      target_role: 'AI Engineer',
      target_employer: 'Anthropic',
      archetype: 'agentic-ai',
    })
    expect(resumeRes.status).toBe(201)
    const resume = (await resumeRes.json()).data

    // 6b. Create a section for the resume
    const sectionId = seedResumeSection(ctx.db, resume.id, 'Experience', 'experience')

    // 7. Add perspective as resume entry
    const entryRes = await apiRequest(ctx.app, 'POST', `/resumes/${resume.id}/entries`, {
      perspective_id: perspective.id,
      section_id: sectionId,
      position: 0,
    })
    expect(entryRes.status).toBe(201)
    const entry = (await entryRes.json()).data
    expect(entry.perspective_id).toBe(perspective.id)

    // 8. Verify the full resume includes the entry
    const getRes = await apiRequest(ctx.app, 'GET', `/resumes/${resume.id}`)
    expect(getRes.status).toBe(200)
    const fullResume = (await getRes.json()).data
    expect(fullResume.sections).toBeArray()
    expect(fullResume.sections.length).toBe(1)
    expect(fullResume.sections[0].entries[0].perspective_id).toBe(perspective.id)
  })
})

// ── E2E-2: Content Drift Detection ────────────────────────────────────────

describe('E2E-2: Content Drift Detection', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('editing a source description creates drift in bullets', async () => {
    // 1. Create a source and a bullet with a matching snapshot
    const sourceId = seedSource(ctx.db, {
      title: 'Drift Source',
      description: 'Original description of the experience.',
    })
    // Create bullet with snapshot matching original description
    seedBullet(ctx.db, [{ id: sourceId }], { content: 'A derived bullet' })

    // 2. Verify no drift initially
    // The seedBullet sets source_content_snapshot to 'snapshot of source content'
    // which doesn't match the source description, so there IS drift from the start.
    // Let's check integrity endpoint
    const driftRes1 = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    expect(driftRes1.status).toBe(200)
    const drift1 = (await driftRes1.json()).data
    // There should be drift because seed snapshot != source description
    expect(drift1).toBeArray()
    expect(drift1.length).toBeGreaterThanOrEqual(1)
    expect(drift1[0].entity_type).toBe('bullet')

    // 3. Now update the source description via PATCH
    const patchRes = await apiRequest(ctx.app, 'PATCH', `/sources/${sourceId}`, {
      description: 'Updated description that differs even more.',
    })
    expect(patchRes.status).toBe(200)

    // 4. Check drift again - should still show drift
    const driftRes2 = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    expect(driftRes2.status).toBe(200)
    const drift2 = (await driftRes2.json()).data
    expect(drift2.length).toBeGreaterThanOrEqual(1)
    const bulletDrift = drift2.find((d: any) => d.entity_type === 'bullet')
    expect(bulletDrift).toBeDefined()
    expect(bulletDrift.current_value).toBe('Updated description that differs even more.')
  })
})

// ── E2E-3: Rejection and Reopen Flow ──────────────────────────────────────

describe('E2E-3: Rejection and Reopen Flow', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('reject bullet -> reopen -> approve -> derive perspective', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'in_review' })

    // 1. Reject the bullet
    const rejectRes = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/reject`, {
      rejection_reason: 'Too vague, needs more specifics',
    })
    expect(rejectRes.status).toBe(200)
    expect((await rejectRes.json()).data.status).toBe('rejected')

    // 2. Reopen the bullet
    const reopenRes = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/reopen`)
    expect(reopenRes.status).toBe(200)
    expect((await reopenRes.json()).data.status).toBe('in_review')

    // 3. Approve the bullet
    const approveRes = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)
    expect(approveRes.status).toBe(200)
    expect((await approveRes.json()).data.status).toBe('approved')

    // 4. Derive a perspective via prepare/commit
    const perspective = await derivePerspective(
      ctx.app,
      bulletId,
      { archetype: 'security-engineer', domain: 'security', framing: 'accomplishment' },
      'A reframed perspective after reopen',
      'Improved version',
    )
    expect(perspective.bullet_id).toBe(bulletId)
    expect(perspective.status).toBe('in_review')
  })
})

// ── E2E-4: Concurrency Protection ─────────────────────────────────────────

describe('E2E-4: Concurrency Protection', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('concurrent prepare on same source returns 409', async () => {
    // Create source
    const createRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Concurrency Test',
      description: 'Testing concurrent access.',
    })
    const source = (await createRes.json()).data

    // Fire two prepare requests concurrently — the lock prevents both from acquiring
    const [res1, res2] = await Promise.all([
      apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: source.id,
        client_id: 'client-1',
      }),
      apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: source.id,
        client_id: 'client-2',
      }),
    ])

    const statuses = [res1.status, res2.status].sort()
    // One should succeed (201) and one should conflict (409)
    expect(statuses).toEqual([201, 409])
  })
})

// ── E2E-5: Cascade and Restrict Behavior ──────────────────────────────────

describe('E2E-5: Cascade and Restrict Behavior', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('delete through chain respects foreign key constraints', async () => {
    // Build a full chain: source -> bullet -> perspective -> resume entry
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    const perspId = seedPerspective(ctx.db, bulletId)
    const resumeId = seedResume(ctx.db)
    const secId = seedResumeSection(ctx.db, resumeId, 'Experience', 'experience')
    seedResumeEntry(ctx.db, secId, { perspectiveId: perspId })

    // Cannot delete perspective (referenced by resume_entries ON DELETE RESTRICT)
    const deletePerspRes = await apiRequest(ctx.app, 'DELETE', `/perspectives/${perspId}`)
    expect(deletePerspRes.status).toBe(409)

    // Cannot delete bullet (referenced by perspectives ON DELETE RESTRICT)
    const deleteBulletRes = await apiRequest(ctx.app, 'DELETE', `/bullets/${bulletId}`)
    expect(deleteBulletRes.status).toBe(409)

    // Delete resume first — resume_entries cascade with the resume
    const deleteResumeRes = await apiRequest(ctx.app, 'DELETE', `/resumes/${resumeId}`)
    expect(deleteResumeRes.status).toBe(204)

    // Now perspective can be deleted (no more resume entries referencing it)
    const deletePerspRes2 = await apiRequest(ctx.app, 'DELETE', `/perspectives/${perspId}`)
    expect(deletePerspRes2.status).toBe(204)

    // Now bullet can be deleted (no more perspectives referencing it)
    const deleteBulletRes2 = await apiRequest(ctx.app, 'DELETE', `/bullets/${bulletId}`)
    expect(deleteBulletRes2.status).toBe(204)

    // Source can be deleted (bullet_sources uses ON DELETE CASCADE, so
    // deleting a source cascades the junction rows — the source is free)
    const deleteSourceRes = await apiRequest(ctx.app, 'DELETE', `/sources/${sourceId}`)
    expect(deleteSourceRes.status).toBe(204)
  })
})

// ── E2E-6: Polymorphic Source CRUD ────────────────────────────────────────

describe('E2E-6: Polymorphic Source CRUD', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('create role source with extension data, update, and verify cascade on delete', async () => {
    // 1. Create organization
    const orgRes = await apiRequest(ctx.app, 'POST', '/organizations', {
      name: 'Acme Corp',
      org_type: 'company',
      industry: 'Tech',
    })
    expect(orgRes.status).toBe(201)
    const org = (await orgRes.json()).data

    // 2. Create source with source_type = 'role' and extension data
    const sourceRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Senior Engineer',
      description: 'Led cloud infrastructure team at Acme Corp.',
      source_type: 'role',
      organization_id: org.id,
      start_date: '2023-01-15',
      end_date: '2025-06-30',
    })
    expect(sourceRes.status).toBe(201)
    const source = (await sourceRes.json()).data
    expect(source.source_type).toBe('role')

    // 3. GET source -> verify extension data is present
    const getRes = await apiRequest(ctx.app, 'GET', `/sources/${source.id}`)
    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()).data
    expect(fetched.source_type).toBe('role')
    expect(fetched.role).toBeDefined()
    expect(fetched.role.organization_id).toBe(org.id)
    expect(fetched.role.start_date).toBe('2023-01-15')
    expect(fetched.role.end_date).toBe('2025-06-30')

    // 4. Update extension fields (change end_date)
    const patchRes = await apiRequest(ctx.app, 'PATCH', `/sources/${source.id}`, {
      end_date: '2026-01-31',
    })
    expect(patchRes.status).toBe(200)

    // 5. GET source -> verify updated extension
    const getRes2 = await apiRequest(ctx.app, 'GET', `/sources/${source.id}`)
    expect(getRes2.status).toBe(200)
    const fetched2 = (await getRes2.json()).data
    expect(fetched2.role.end_date).toBe('2026-01-31')

    // 6. Delete source -> verify cascade to source_roles
    const deleteRes = await apiRequest(ctx.app, 'DELETE', `/sources/${source.id}`)
    expect(deleteRes.status).toBe(204)

    // Verify source_roles row was cascade-deleted
    const roleRow = ctx.db
      .query('SELECT * FROM source_roles WHERE source_id = ?')
      .get(source.id)
    expect(roleRow).toBeNull()
  })
})

// ── E2E-7: Organization CRUD + Source Linkage ─────────────────────────────

describe('E2E-7: Organization CRUD + Source Linkage', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('delete organization sets source role org link to null', async () => {
    // 1. Create organization
    const orgRes = await apiRequest(ctx.app, 'POST', '/organizations', {
      name: 'Vanishing Corp',
      org_type: 'company',
    })
    expect(orgRes.status).toBe(201)
    const org = (await orgRes.json()).data

    // 2. Create role source linked to org
    const sourceRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'DevOps Lead',
      description: 'Managed CI/CD pipelines.',
      source_type: 'role',
      organization_id: org.id,
    })
    expect(sourceRes.status).toBe(201)
    const source = (await sourceRes.json()).data

    // Verify org link is set
    const getRes1 = await apiRequest(ctx.app, 'GET', `/sources/${source.id}`)
    expect(getRes1.status).toBe(200)
    const before = (await getRes1.json()).data
    expect(before.role.organization_id).toBe(org.id)

    // 3. Delete organization
    const deleteOrgRes = await apiRequest(ctx.app, 'DELETE', `/organizations/${org.id}`)
    expect(deleteOrgRes.status).toBe(204)

    // 4. GET source -> verify org link is null (SET NULL cascade)
    const getRes2 = await apiRequest(ctx.app, 'GET', `/sources/${source.id}`)
    expect(getRes2.status).toBe(200)
    const after = (await getRes2.json()).data
    expect(after.role.organization_id).toBeNull()
  })
})

// ── E2E-8: Resume Entries (Copy-on-Write) ─────────────────────────────────

describe('E2E-8: Resume Entries (Copy-on-Write)', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('reference mode, clone mode, and reset to reference', async () => {
    // 1. Create source -> derive bullets -> approve -> derive perspective -> approve
    const srcRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'K8s Platform',
      description: 'Managed Kubernetes clusters for production workloads.',
      source_type: 'general',
    })
    const source = (await srcRes.json()).data

    const bullets = await deriveBullets(ctx.app, source.id, [
      {
        content: 'Managed Kubernetes clusters across 3 availability zones',
        technologies: ['Kubernetes', 'AWS'],
        metrics: '99.9% uptime',
      },
    ])
    const bulletId = bullets[0].id

    await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)

    const perspective = await derivePerspective(
      ctx.app,
      bulletId,
      { archetype: 'infrastructure', domain: 'devops', framing: 'accomplishment' },
      'Architected highly available Kubernetes platform on AWS',
      'Reframed for infrastructure archetype',
    )

    await apiRequest(ctx.app, 'PATCH', `/perspectives/${perspective.id}/approve`)

    // 2. Create resume
    const resumeRes = await apiRequest(ctx.app, 'POST', '/resumes', {
      name: 'Infra Resume',
      target_role: 'Platform Engineer',
      target_employer: 'CloudCo',
      archetype: 'infrastructure',
    })
    const resume = (await resumeRes.json()).data

    // 2b. Create a section for the resume
    const sectionId = seedResumeSection(ctx.db, resume.id, 'Experience', 'experience')

    // 3. Add perspective as entry (reference mode — no content override)
    const entryRes = await apiRequest(ctx.app, 'POST', `/resumes/${resume.id}/entries`, {
      perspective_id: perspective.id,
      section_id: sectionId,
      position: 0,
    })
    expect(entryRes.status).toBe(201)
    const entry = (await entryRes.json()).data

    // 4. GET resume -> verify entry content is null (reference mode)
    const getRes1 = await apiRequest(ctx.app, 'GET', `/resumes/${resume.id}`)
    expect(getRes1.status).toBe(200)
    const r1 = (await getRes1.json()).data
    const e1 = r1.sections[0].entries[0]
    expect(e1.content).toBeNull()
    expect(e1.perspective_content).toBeDefined() // perspective content available for display

    // 5. Update entry content (clone mode)
    const patchEntryRes = await apiRequest(
      ctx.app,
      'PATCH',
      `/resumes/${resume.id}/entries/${entry.id}`,
      { content: 'Custom: Led K8s migration across multi-cloud environment' },
    )
    expect(patchEntryRes.status).toBe(200)

    // 6. GET resume -> verify entry has custom content + perspective_content_snapshot
    const getRes2 = await apiRequest(ctx.app, 'GET', `/resumes/${resume.id}`)
    const r2 = (await getRes2.json()).data
    const e2 = r2.sections[0].entries[0]
    expect(e2.content).toBe('Custom: Led K8s migration across multi-cloud environment')
    expect(e2.perspective_content_snapshot).toBeDefined()
    expect(e2.perspective_content_snapshot).not.toBeNull()

    // 7. Reset entry to reference (content = null)
    const resetRes = await apiRequest(
      ctx.app,
      'PATCH',
      `/resumes/${resume.id}/entries/${entry.id}`,
      { content: null },
    )
    expect(resetRes.status).toBe(200)

    // 8. GET resume -> verify content is null again
    const getRes3 = await apiRequest(ctx.app, 'GET', `/resumes/${resume.id}`)
    const r3 = (await getRes3.json()).data
    const e3 = r3.sections[0].entries[0]
    expect(e3.content).toBeNull()
    expect(e3.perspective_content_snapshot).toBeNull()
  })
})

// ── E2E-9: Integrity Drift Detection ──────────────────────────────────────

describe('E2E-9: Integrity Drift Detection', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('editing source description creates bullet drift, perspective unaffected', async () => {
    // 1. Create source -> derive bullets -> approve -> derive perspective
    const srcRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Data Pipeline',
      description: 'Built real-time data pipeline processing 10M events/day using Kafka and Flink.',
    })
    const source = (await srcRes.json()).data

    const bullets = await deriveBullets(ctx.app, source.id, [
      {
        content: 'Built real-time data pipeline processing 10M events/day',
        technologies: ['Kafka', 'Flink'],
        metrics: '10M events/day',
      },
    ])
    const bulletId = bullets[0].id

    await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)

    await derivePerspective(
      ctx.app,
      bulletId,
      { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
      'Designed streaming data architecture for high-throughput analytics',
      'Reframed for data engineering focus',
    )

    // Verify no drift initially (snapshot matches source description)
    const driftRes1 = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    const drift1 = (await driftRes1.json()).data
    // Should be empty or have no bullet drift (snapshot was set to source description at derivation time)
    const bulletDrifts1 = drift1.filter((d: any) => d.entity_type === 'bullet' && d.entity_id === bulletId)
    expect(bulletDrifts1.length).toBe(0)

    // 2. Edit source description
    await apiRequest(ctx.app, 'PATCH', `/sources/${source.id}`, {
      description: 'UPDATED: Built next-gen streaming pipeline with 50M events/day using Kafka, Flink, and Spark.',
    })

    // 3. GET /integrity/drift -> verify bullet shows as drifted
    const driftRes2 = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    const drift2 = (await driftRes2.json()).data
    const bulletDrifts2 = drift2.filter((d: any) => d.entity_type === 'bullet' && d.entity_id === bulletId)
    expect(bulletDrifts2.length).toBe(1)
    expect(bulletDrifts2[0].current_value).toContain('UPDATED')

    // 4. Verify perspective is NOT drifted (bullet content hasn't changed)
    const perspDrifts = drift2.filter((d: any) => d.entity_type === 'perspective')
    // The perspective's bullet_content_snapshot should still match the bullet's content
    // since we only changed the source, not the bullet
    expect(perspDrifts.length).toBe(0)
  })
})

// ── E2E-10: Notes + Entity Linking ────────────────────────────────────────

describe('E2E-10: Notes + Entity Linking', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('create note, link to source, verify references, unlink', async () => {
    // 1. Create note
    const noteRes = await apiRequest(ctx.app, 'POST', '/notes', {
      title: 'Interview Prep',
      content: 'Remember to emphasize cloud migration experience.',
    })
    expect(noteRes.status).toBe(201)
    const note = (await noteRes.json()).data
    expect(note.id).toHaveLength(36)
    expect(note.title).toBe('Interview Prep')

    // 2. Create source
    const sourceRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Cloud Migration Lead',
      description: 'Led migration of 50+ services to AWS.',
    })
    expect(sourceRes.status).toBe(201)
    const source = (await sourceRes.json()).data

    // 3. Link note to source
    const linkRes = await apiRequest(ctx.app, 'POST', `/notes/${note.id}/references`, {
      entity_type: 'source',
      entity_id: source.id,
    })
    expect(linkRes.status).toBe(201)

    // 4. GET note -> verify reference
    const getNoteRes = await apiRequest(ctx.app, 'GET', `/notes/${note.id}`)
    expect(getNoteRes.status).toBe(200)
    const fetchedNote = (await getNoteRes.json()).data
    expect(fetchedNote.references).toBeArray()
    expect(fetchedNote.references.length).toBe(1)
    expect(fetchedNote.references[0].entity_type).toBe('source')
    expect(fetchedNote.references[0].entity_id).toBe(source.id)

    // 5. GET notes for source entity -> verify note appears
    const entityNotesRes = await apiRequest(
      ctx.app,
      'GET',
      `/notes/by-entity/source/${source.id}`,
    )
    expect(entityNotesRes.status).toBe(200)
    const entityNotes = (await entityNotesRes.json()).data
    expect(entityNotes).toBeArray()
    expect(entityNotes.length).toBe(1)
    expect(entityNotes[0].id).toBe(note.id)

    // 6. Unlink -> verify removed
    const unlinkRes = await apiRequest(
      ctx.app,
      'DELETE',
      `/notes/${note.id}/references/source/${source.id}`,
    )
    expect(unlinkRes.status).toBe(204)

    // Verify reference is gone
    const getNoteRes2 = await apiRequest(ctx.app, 'GET', `/notes/${note.id}`)
    const fetchedNote2 = (await getNoteRes2.json()).data
    expect(fetchedNote2.references).toBeArray()
    expect(fetchedNote2.references.length).toBe(0)
  })
})
