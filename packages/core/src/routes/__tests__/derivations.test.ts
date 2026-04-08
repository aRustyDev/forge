/**
 * Derivation route tests — prepare/commit protocol for bullets and perspectives.
 *
 * Uses a real in-memory database (full integration) so that service logic,
 * pending_derivations locking, and response shapes are all exercised.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSource, seedBullet } from '../../db/__tests__/helpers'

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Return archetype/domain names that already exist from migrations.
 * Migration 003 seeds 'agentic-ai' archetype and 'ai_ml' domain and links them.
 * We use those instead of inserting new rows to avoid UNIQUE constraint violations.
 */
function seedArchetypeAndDomain(_db: any) {
  return { archetypeName: 'agentic-ai', domainName: 'ai_ml' }
}

// ── Test setup ────────────────────────────────────────────────────────

describe('Derivation Routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ── POST /derivations/prepare (source) ────────────────────────────

  describe('POST /derivations/prepare (entity_type: source)', () => {
    test('returns 201 with derivation context for a valid source', async () => {
      const sourceId = seedSource(ctx.db, { status: 'approved' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: 'test-client',
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data.derivation_id).toBeString()
      expect(body.data.prompt).toBeString()
      expect(body.data.snapshot).toBeString()
      expect(body.data.instructions).toBeString()
      expect(body.data.expires_at).toBeString()
    })

    test('returns 409 when source already has an active lock', async () => {
      const sourceId = seedSource(ctx.db, { status: 'approved' })

      // First prepare — should succeed
      await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: 'client-1',
      })

      // Second prepare — should conflict
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: 'client-2',
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('CONFLICT')
    })

    test('returns 404 when source does not exist', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: 'nonexistent-id',
        client_id: 'test-client',
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    test('returns 400 when source is archived', async () => {
      const sourceId = seedSource(ctx.db, { status: 'archived' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: 'test-client',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── POST /derivations/prepare (bullet) ────────────────────────────

  describe('POST /derivations/prepare (entity_type: bullet)', () => {
    test('returns 201 with derivation context for a valid approved bullet', async () => {
      const { archetypeName, domainName } = seedArchetypeAndDomain(ctx.db)
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        params: { archetype: archetypeName, domain: domainName, framing: 'accomplishment' },
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.derivation_id).toBeString()
      expect(body.data.prompt).toBeString()
      expect(body.data.expires_at).toBeString()
    })

    test('returns 400 when params are missing for bullet entity_type', async () => {
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        // params omitted
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('params')
    })

    test('returns 400 when bullet is not approved (in_review)', async () => {
      const { archetypeName, domainName } = seedArchetypeAndDomain(ctx.db)
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'in_review' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        params: { archetype: archetypeName, domain: domainName, framing: 'accomplishment' },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when archetype does not exist', async () => {
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })

      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        // ai_ml domain exists from migrations but nonexistent-archetype does not
        params: { archetype: 'nonexistent-archetype', domain: 'ai_ml', framing: 'accomplishment' },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── POST /derivations/prepare — validation ────────────────────────

  describe('POST /derivations/prepare — input validation', () => {
    test('returns 400 when entity_type is missing', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_id: 'some-id',
        client_id: 'client-1',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('entity_type')
    })

    test('returns 400 when entity_type is invalid', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'resume',
        entity_id: 'some-id',
        client_id: 'client-1',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when entity_id is missing', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        client_id: 'client-1',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('entity_id')
    })

    test('returns 400 when client_id is missing', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: 'some-id',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('client_id')
    })
  })

  // ── POST /derivations/:id/commit (bullets) ────────────────────────

  describe('POST /derivations/:id/commit (bullet derivation)', () => {
    test('returns 201 with created bullets after valid commit', async () => {
      const sourceId = seedSource(ctx.db, { status: 'approved' })

      // Prepare first
      const prepareRes = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: 'test-client',
      })
      expect(prepareRes.status).toBe(201)
      const { data: { derivation_id } } = await prepareRes.json()

      // Commit
      const res = await apiRequest(ctx.app, 'POST', `/derivations/${derivation_id}/commit`, {
        bullets: [
          {
            content: 'Led 4-engineer team migrating cloud forensics platform to AWS OpenSearch',
            technologies: ['AWS', 'OpenSearch'],
            metrics: '40% cost reduction',
          },
          {
            content: 'Implemented automated log ingestion pipeline processing 2M records/day',
            technologies: ['Python', 'Kafka'],
            metrics: null,
          },
        ],
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toBeArray()
      expect(body.data.length).toBe(2)
      expect(body.data[0].content).toContain('cloud forensics')
      expect(body.data[0].status).toBe('in_review')
    })

    test('returns 404 when derivation_id does not exist', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/nonexistent-id/commit', {
        bullets: [{ content: 'Test bullet', technologies: [], metrics: null }],
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    test('returns 400 when commit body is ambiguous (no bullets, content, or reasoning)', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/derivations/some-id/commit', {
        foo: 'bar',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('bullets')
    })
  })

  // ── POST /derivations/:id/commit (perspective) ────────────────────

  describe('POST /derivations/:id/commit (perspective derivation)', () => {
    test('returns 201 with created perspective after valid commit', async () => {
      const { archetypeName, domainName } = seedArchetypeAndDomain(ctx.db)
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })

      // Prepare
      const prepareRes = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        params: { archetype: archetypeName, domain: domainName, framing: 'accomplishment' },
      })
      expect(prepareRes.status).toBe(201)
      const { data: { derivation_id } } = await prepareRes.json()

      // Commit
      const res = await apiRequest(ctx.app, 'POST', `/derivations/${derivation_id}/commit`, {
        content: 'Designed agentic pipeline to automate cloud forensics triage across 3 environments',
        reasoning: 'Framed for agentic-ai archetype emphasizing autonomous decision-making',
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data.content).toContain('agentic pipeline')
      expect(body.data.status).toBe('in_review')
    })

    test('returns 400 when perspective commit has no content field', async () => {
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })
      const { archetypeName, domainName } = seedArchetypeAndDomain(ctx.db)

      const prepareRes = await apiRequest(ctx.app, 'POST', '/derivations/prepare', {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: 'test-client',
        params: { archetype: archetypeName, domain: domainName, framing: 'accomplishment' },
      })
      const { data: { derivation_id } } = await prepareRes.json()

      const res = await apiRequest(ctx.app, 'POST', `/derivations/${derivation_id}/commit`, {
        reasoning: 'only reasoning, no content',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── Old route stubs ────────────────────────────────────────────────

  describe('Old derive route stubs return 501', () => {
    test('POST /sources/:id/derive-bullets returns 501', async () => {
      const sourceId = seedSource(ctx.db)
      const res = await apiRequest(ctx.app, 'POST', `/sources/${sourceId}/derive-bullets`)
      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_IMPLEMENTED')
      expect(body.error.message).toContain('/api/derivations/prepare')
    })

    test('POST /bullets/:id/derive-perspectives returns 501', async () => {
      const sourceId = seedSource(ctx.db)
      const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
      const res = await apiRequest(ctx.app, 'POST', `/bullets/${bulletId}/derive-perspectives`, {
        archetype: 'agentic-ai',
        domain: 'ai_ml',
        framing: 'accomplishment',
      })
      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_IMPLEMENTED')
      expect(body.error.message).toContain('/api/derivations/prepare')
    })
  })

  // ── GONE status code ──────────────────────────────────────────────

  describe('Expired derivation returns 410 Gone', () => {
    test('committing an expired derivation returns 410', async () => {
      const sourceId = seedSource(ctx.db, { status: 'approved' })

      // Insert an already-expired pending_derivations row directly
      const expiredAt = new Date(Date.now() - 1000).toISOString()
      const row = ctx.db.query(
        `INSERT INTO pending_derivations (entity_type, entity_id, client_id, prompt, snapshot, derivation_params, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      ).get('source', sourceId, 'test-client', 'prompt', 'snapshot', null, expiredAt) as { id: string }

      const res = await apiRequest(ctx.app, 'POST', `/derivations/${row.id}/commit`, {
        bullets: [{ content: 'Expired bullet', technologies: [], metrics: null }],
      })

      expect(res.status).toBe(410)
      const body = await res.json()
      expect(body.error.code).toBe('GONE')
    })
  })
})
