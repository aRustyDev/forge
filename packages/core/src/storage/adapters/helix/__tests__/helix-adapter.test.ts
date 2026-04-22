import { describe, expect, test } from 'bun:test'
import { HelixAdapter } from '../helix-adapter'
import type { EntityMap } from '../../../entity-map'
// ── Minimal entity map for tests ─────────────────────────────────────────

const testEntityMap: EntityMap = {
  bullets: {
    fields: {
      id: { type: 'text', required: true },
      content: { type: 'text', required: true },
      status: { type: 'text', required: true },
      domain: { type: 'text' },
      slug: { type: 'text', unique: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['id'],
  },
  skills: {
    fields: {
      id: { type: 'text', required: true },
      name: { type: 'text', required: true, unique: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['id'],
  },
  bullet_skills: {
    fields: {
      bullet_id: { type: 'text', required: true, fk: { entity: 'bullets', field: 'id' } },
      skill_id: { type: 'text', required: true, fk: { entity: 'skills', field: 'id' } },
      is_primary: { type: 'integer', boolean: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['bullet_id', 'skill_id'],
  },
}

// ── Mock client ──────────────────────────────────────────────────────────

interface MockCall {
  name: string
  params: Record<string, unknown>
}

function createMockClient(responses: Record<string, unknown> = {}) {
  const calls: MockCall[] = []
  return {
    calls,
    query: async (name: string, params: Record<string, unknown>): Promise<unknown> => {
      calls.push({ name, params })
      return responses[name] ?? null
    },
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('HelixAdapter', () => {
  describe('capabilities', () => {
    test('reports correct capabilities', () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      expect(adapter.capabilities).toEqual({
        graph: true,
        vector: true,
        transactions: false,
        nativeCascade: false,
      })
    })
  })

  describe('connect/disconnect/isConnected', () => {
    test('starts disconnected', () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      expect(adapter.isConnected()).toBe(false)
    })

    test('connect sets connected state', async () => {
      const mock = createMockClient({ Health: { status: 'ok' } })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
    })

    test('disconnect clears connected state', async () => {
      const mock = createMockClient({ Health: { status: 'ok' } })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock
      await adapter.connect()
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })
  })

  describe('create()', () => {
    test('node create calls Add{E} with data', async () => {
      const mock = createMockClient()
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.create('bullets', {
        id: 'b-1',
        content: 'Test bullet',
        status: 'draft',
      })

      expect(result).toEqual({ id: 'b-1' })
      expect(mock.calls).toHaveLength(1)
      expect(mock.calls[0].name).toBe('AddBullets')
      expect(mock.calls[0].params).toEqual({
        id: 'b-1',
        content: 'Test bullet',
        status: 'draft',
      })
    })

    test('edge create extracts from/to and calls Add{E}', async () => {
      const mock = createMockClient()
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.create('bullet_skills', {
        bullet_id: 'b-1',
        skill_id: 's-1',
        is_primary: true,
      })

      expect(result).toEqual({ id: '' })
      expect(mock.calls).toHaveLength(1)
      expect(mock.calls[0].name).toBe('AddBulletSkills')
      expect(mock.calls[0].params).toEqual({
        fromId: 'b-1',
        toId: 's-1',
        is_primary: true,
      })
    })
  })

  describe('get()', () => {
    test('returns normalized node response', async () => {
      const mock = createMockClient({
        GetBullets: [{ id: 'b-1', content: 'Hello', status: 'draft' }],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.get('bullets', 'b-1')
      expect(result).toEqual({ id: 'b-1', content: 'Hello', status: 'draft' })
      expect(mock.calls[0].name).toBe('GetBullets')
      expect(mock.calls[0].params).toEqual({ id: 'b-1' })
    })

    test('returns null for missing entity', async () => {
      const mock = createMockClient({ GetBullets: null })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.get('bullets', 'nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('update()', () => {
    test('calls Update{E} with id and data', async () => {
      const mock = createMockClient()
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      await adapter.update('bullets', 'b-1', { content: 'Updated' })

      expect(mock.calls).toHaveLength(1)
      expect(mock.calls[0].name).toBe('UpdateBullets')
      expect(mock.calls[0].params).toEqual({ id: 'b-1', content: 'Updated' })
    })
  })

  describe('delete()', () => {
    test('calls Delete{E} with id', async () => {
      const mock = createMockClient()
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      await adapter.delete('bullets', 'b-1')

      expect(mock.calls).toHaveLength(1)
      expect(mock.calls[0].name).toBe('DeleteBullets')
      expect(mock.calls[0].params).toEqual({ id: 'b-1' })
    })
  })

  describe('list()', () => {
    test('no where uses List query with pagination', async () => {
      const mock = createMockClient({
        ListBullets: [
          { id: 'b-1', content: 'A', status: 'draft' },
          { id: 'b-2', content: 'B', status: 'approved' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullets', { limit: 10, offset: 0 })

      expect(result.rows).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(mock.calls[0].name).toBe('ListBullets')
      expect(mock.calls[0].params).toEqual({ limit: 10, offset: 0 })
    })

    test('simple equality routes to ListAll + filter (getBy strategy)', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', content: 'A', status: 'draft' },
          { id: 'b-2', content: 'B', status: 'approved' },
          { id: 'b-3', content: 'C', status: 'draft' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullets', {
        where: { status: 'draft' },
      })

      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].status).toBe('draft')
      expect(result.rows[1].status).toBe('draft')
    })

    test('edge from_id routes to ListFrom', async () => {
      const mock = createMockClient({
        ListBulletSkillsFrom: [
          { from: { id: 'b-1' }, to: { id: 's-1' }, properties: { is_primary: true } },
          { from: { id: 'b-1' }, to: { id: 's-2' }, properties: {} },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullet_skills', {
        where: { bullet_id: 'b-1' },
      })

      expect(mock.calls[0].name).toBe('ListBulletSkillsFrom')
      expect(mock.calls[0].params).toEqual({ id: 'b-1' })
      expect(result.rows).toHaveLength(2)
      // Edge responses are normalized to junction row shape
      expect(result.rows[0]).toEqual({
        bullet_id: 'b-1',
        skill_id: 's-1',
        is_primary: true,
      })
    })

    test('edge to_id routes to ListTo', async () => {
      const mock = createMockClient({
        ListBulletSkillsTo: [
          { from: { id: 'b-1' }, to: { id: 's-1' }, properties: {} },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullet_skills', {
        where: { skill_id: 's-1' },
      })

      expect(mock.calls[0].name).toBe('ListBulletSkillsTo')
      expect(mock.calls[0].params).toEqual({ id: 's-1' })
    })

    test('compound where ($or) falls back to client-side filter', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', content: 'A', status: 'draft' },
          { id: 'b-2', content: 'B', status: 'approved' },
          { id: 'b-3', content: 'C', status: 'rejected' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullets', {
        where: { $or: [{ status: 'draft' }, { status: 'approved' }] },
      })

      expect(result.rows).toHaveLength(2)
      expect(result.rows.map((r) => r.status)).toEqual(['draft', 'approved'])
    })

    test('applies offset and limit to client-filtered results', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', status: 'draft' },
          { id: 'b-2', status: 'draft' },
          { id: 'b-3', status: 'draft' },
          { id: 'b-4', status: 'draft' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullets', {
        where: { status: 'draft' },
        limit: 2,
        offset: 1,
      })

      expect(result.total).toBe(4) // total before pagination
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].id).toBe('b-2')
      expect(result.rows[1].id).toBe('b-3')
    })
  })

  describe('count()', () => {
    test('no where calls Count{E}', async () => {
      const mock = createMockClient({ CountBullets: 5 })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.count('bullets')
      expect(result).toBe(5)
      expect(mock.calls[0].name).toBe('CountBullets')
    })

    test('edge with from calls CountFrom', async () => {
      const mock = createMockClient({ CountBulletSkillsFrom: 3 })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.count('bullet_skills', { bullet_id: 'b-1' })
      expect(result).toBe(3)
      expect(mock.calls[0].name).toBe('CountBulletSkillsFrom')
      expect(mock.calls[0].params).toEqual({ id: 'b-1' })
    })

    test('with non-routable where falls back to list+count', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', status: 'draft' },
          { id: 'b-2', status: 'draft' },
          { id: 'b-3', status: 'approved' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.count('bullets', { status: 'draft' })
      expect(result).toBe(2)
    })
  })

  describe('deleteWhere()', () => {
    test('edge from calls DeleteFrom', async () => {
      const mock = createMockClient({ DeleteBulletSkillsFrom: 2 })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.deleteWhere('bullet_skills', { bullet_id: 'b-1' })

      expect(mock.calls[0].name).toBe('DeleteBulletSkillsFrom')
      expect(mock.calls[0].params).toEqual({ id: 'b-1' })
    })

    test('node falls back to list-then-delete', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', status: 'draft' },
          { id: 'b-2', status: 'draft' },
        ],
        DeleteBullets: null,
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.deleteWhere('bullets', { status: 'draft' })

      // first call: ListAllBullets, then 2 DeleteBullets
      expect(result).toBe(2)
      expect(mock.calls).toHaveLength(3)
      expect(mock.calls[0].name).toBe('ListAllBullets')
      expect(mock.calls[1].name).toBe('DeleteBullets')
      expect(mock.calls[2].name).toBe('DeleteBullets')
    })

    test('edge deleteByEndpoints for two-field where', async () => {
      const mock = createMockClient({ DeleteBulletSkillsByEndpoints: null })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      await adapter.deleteWhere('bullet_skills', {
        bullet_id: 'b-1',
        skill_id: 's-1',
      })

      expect(mock.calls[0].name).toBe('DeleteBulletSkillsByEndpoints')
      expect(mock.calls[0].params).toEqual({ fromId: 'b-1', toId: 's-1' })
    })
  })

  describe('updateWhere()', () => {
    test('lists matching then updates each', async () => {
      const mock = createMockClient({
        ListAllBullets: [
          { id: 'b-1', status: 'draft' },
          { id: 'b-2', status: 'draft' },
        ],
        UpdateBullets: null,
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.updateWhere(
        'bullets',
        { status: 'draft' },
        { status: 'approved' },
      )

      expect(result).toBe(2)
      // ListAllBullets + 2x UpdateBullets
      expect(mock.calls).toHaveLength(3)
      expect(mock.calls[1].name).toBe('UpdateBullets')
      expect(mock.calls[1].params).toEqual({ id: 'b-1', status: 'approved' })
      expect(mock.calls[2].name).toBe('UpdateBullets')
      expect(mock.calls[2].params).toEqual({ id: 'b-2', status: 'approved' })
    })
  })

  describe('beginTransaction()', () => {
    test('returns a HelixTransaction', async () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      const txn = await adapter.beginTransaction()

      expect(txn).toBeDefined()
      expect(typeof txn.commit).toBe('function')
      expect(typeof txn.rollback).toBe('function')
      expect(typeof txn.create).toBe('function')
      expect(typeof txn.get).toBe('function')
    })
  })

  describe('executeNamedQuery()', () => {
    test('dispatches to HELIX_NAMED_QUERIES handler', async () => {
      const mock = createMockClient({
        TraceChain: {
          perspective: { id: 'p-1', content: 'Test', bullet_content_snapshot: '', framing: 'default', status: 'draft', created_at: '2026-01-01' },
          bullet: { id: 'b-1', content: 'Bullet', source_content_snapshot: '', status: 'approved' },
          sources: [],
        },
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.executeNamedQuery('traceChain', {
        perspectiveId: 'p-1',
      })

      expect(result).toBeDefined()
      expect(mock.calls[0].name).toBe('TraceChain')
    })

    test('throws for unknown named query', async () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      await expect(
        adapter.executeNamedQuery('nonexistent', {}),
      ).rejects.toThrow('Unknown named query')
    })
  })

  describe('graph sub-interface', () => {
    test('traverse returns traversal result', async () => {
      const mock = createMockClient({
        ListBulletSkillsFrom: [
          { from: { id: 'b-1' }, to: { id: 's-1' }, properties: {} },
          { from: { id: 'b-1' }, to: { id: 's-2' }, properties: {} },
        ],
        GetSkills: [{ id: 's-1', name: 'TypeScript' }],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.traverse(
        { entityType: 'bullets', id: 'b-1' },
        'bullet_skills',
      )

      expect(result).toBeDefined()
      expect(result.edges.length).toBeGreaterThanOrEqual(0)
    })

    test('shortestPath throws not supported', async () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      await expect(
        adapter.shortestPath(
          { entityType: 'bullets', id: 'b-1' },
          { entityType: 'skills', id: 's-1' },
        ),
      ).rejects.toThrow('not supported')
    })

    test('subgraph throws not supported', async () => {
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      await expect(adapter.subgraph('bullets', 'b-1', 2)).rejects.toThrow('not supported')
    })
  })

  describe('vector sub-interface', () => {
    test('embed calls AddV query', async () => {
      const mock = createMockClient({ AddEmbedding: null })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      await adapter.embed('bullets', 'b-1', 'some content to embed')

      expect(mock.calls[0].name).toBe('AddEmbedding')
      expect(mock.calls[0].params).toEqual({
        entityType: 'bullets',
        entityId: 'b-1',
        content: 'some content to embed',
      })
    })

    test('findSimilar calls SearchEmbedding', async () => {
      const mock = createMockClient({
        SearchEmbedding: [
          { entityType: 'bullets', entityId: 'b-1', score: 0.95 },
          { entityType: 'bullets', entityId: 'b-2', score: 0.87 },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const results = await adapter.findSimilar('test query', 'bullets', 5, 0.8)

      expect(results).toHaveLength(2)
      expect(results[0].score).toBe(0.95)
      expect(mock.calls[0].name).toBe('SearchEmbedding')
    })

    test('checkEmbeddingStale returns boolean', async () => {
      const mock = createMockClient({
        GetEmbeddingByEntity: { entityType: 'bullets', entityId: 'b-1', content_hash: 'old-hash' },
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const stale = await adapter.checkEmbeddingStale('bullets', 'b-1', 'new-hash')
      expect(stale).toBe(true)

      const fresh = await adapter.checkEmbeddingStale('bullets', 'b-1', 'old-hash')
      expect(fresh).toBe(false)
    })
  })

  describe('orderBy', () => {
    test('applies orderBy sorting to results', async () => {
      const mock = createMockClient({
        ListBullets: [
          { id: 'b-3', content: 'C', status: 'draft' },
          { id: 'b-1', content: 'A', status: 'approved' },
          { id: 'b-2', content: 'B', status: 'draft' },
        ],
      })
      const adapter = new HelixAdapter(testEntityMap, { url: 'http://localhost:6969' })
      ;(adapter as any).client = mock

      const result = await adapter.list('bullets', {
        orderBy: [{ field: 'id', direction: 'asc' }],
      })

      expect(result.rows[0].id).toBe('b-1')
      expect(result.rows[1].id).toBe('b-2')
      expect(result.rows[2].id).toBe('b-3')
    })
  })
})
