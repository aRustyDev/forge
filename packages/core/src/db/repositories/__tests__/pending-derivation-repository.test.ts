import { describe, test, expect, beforeEach } from 'bun:test'
import Database from 'bun:sqlite'
import { join } from 'node:path'
import { runMigrations } from '../../migrate'
import * as PendingDerivationRepo from '../pending-derivation-repository'

describe('PendingDerivationRepository', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
    runMigrations(db, join(import.meta.dir, '../../migrations'))
  })

  describe('create', () => {
    test('creates a pending derivation and returns it', () => {
      const pd = PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'test prompt',
        snapshot: 'test snapshot',
        derivation_params: null,
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      expect(pd.id).toBeTruthy()
      expect(pd.entity_type).toBe('source')
      expect(pd.entity_id).toBe('src-1')
      expect(pd.client_id).toBe('mcp')
      expect(pd.prompt).toBe('test prompt')
      expect(pd.snapshot).toBe('test snapshot')
      expect(pd.derivation_params).toBeNull()
      expect(pd.expires_at).toBeTruthy()
    })

    test('rejects duplicate entity locks', () => {
      PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      expect(() =>
        PendingDerivationRepo.create(db, {
          entity_type: 'source',
          entity_id: 'src-1',
          client_id: 'webui',
          prompt: 'p2',
          snapshot: 's2',
          derivation_params: null,
          expires_at: new Date(Date.now() + 120_000).toISOString(),
        }),
      ).toThrow()
    })
  })

  describe('getById', () => {
    test('returns the pending derivation', () => {
      const created = PendingDerivationRepo.create(db, {
        entity_type: 'bullet',
        entity_id: 'b-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: JSON.stringify({ archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' }),
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      const fetched = PendingDerivationRepo.getById(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.entity_type).toBe('bullet')
      expect(fetched!.derivation_params).toContain('agentic-ai')
    })

    test('returns null for missing id', () => {
      expect(PendingDerivationRepo.getById(db, 'nope')).toBeNull()
    })
  })

  describe('findUnexpiredByEntity', () => {
    test('returns lock if not expired', () => {
      PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      const found = PendingDerivationRepo.findUnexpiredByEntity(db, 'source', 'src-1')
      expect(found).not.toBeNull()
    })

    test('returns null if expired', () => {
      PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })

      const found = PendingDerivationRepo.findUnexpiredByEntity(db, 'source', 'src-1')
      expect(found).toBeNull()
    })
  })

  describe('deleteById', () => {
    test('deletes the row', () => {
      const created = PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      PendingDerivationRepo.deleteById(db, created.id)
      expect(PendingDerivationRepo.getById(db, created.id)).toBeNull()
    })
  })

  describe('deleteExpired', () => {
    test('deletes expired rows and returns count', () => {
      PendingDerivationRepo.create(db, {
        entity_type: 'source',
        entity_id: 'src-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() - 5000).toISOString(),
      })
      PendingDerivationRepo.create(db, {
        entity_type: 'bullet',
        entity_id: 'b-1',
        client_id: 'mcp',
        prompt: 'p',
        snapshot: 's',
        derivation_params: null,
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      })

      const deleted = PendingDerivationRepo.deleteExpired(db)
      expect(deleted).toBe(1)

      // Non-expired still exists
      expect(PendingDerivationRepo.findUnexpiredByEntity(db, 'bullet', 'b-1')).not.toBeNull()
    })
  })
})
