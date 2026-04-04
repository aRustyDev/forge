// packages/core/src/db/repositories/__tests__/embedding-repository.test.ts

import { describe, it, expect, beforeEach } from 'bun:test'
import { getDatabase } from '../../connection'
import { runMigrations } from '../../migrate'
import { EmbeddingRepository } from '../embedding-repository'
import { join } from 'node:path'

function setupDb() {
  const db = getDatabase(':memory:')
  runMigrations(db, join(import.meta.dir, '../../migrations'))
  return db
}

function makeVector(dim = 384, fill = 0.1): Float32Array {
  const vec = new Float32Array(dim)
  vec.fill(fill)
  return vec
}

describe('EmbeddingRepository', () => {
  let db: ReturnType<typeof getDatabase>

  beforeEach(() => {
    db = setupDb()
  })

  it('upserts and retrieves an embedding', () => {
    const vec = makeVector()
    const row = EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'abc123',
      vector: vec,
    })

    expect(row.entity_type).toBe('bullet')
    expect(row.entity_id).toBe('b-001')
    expect(row.content_hash).toBe('abc123')

    const found = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')
    expect(found).not.toBeNull()
    expect(found!.content_hash).toBe('abc123')

    const deserialized = EmbeddingRepository.deserializeVector(found!.vector)
    expect(deserialized.length).toBe(384)
    expect(deserialized[0]).toBeCloseTo(0.1, 5)
  })

  it('round-trips vector through actual SQLite BLOB without alignment issues', () => {
    // This test specifically validates that deserializeVector handles
    // Uint8Array byte offsets correctly (IN4 fix).
    const original = new Float32Array(384)
    for (let i = 0; i < 384; i++) original[i] = Math.random() * 2 - 1

    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-roundtrip',
      content_hash: 'roundtrip-test',
      vector: original,
    })

    const row = EmbeddingRepository.findByEntity(db, 'bullet', 'b-roundtrip')
    expect(row).not.toBeNull()

    const restored = EmbeddingRepository.deserializeVector(row!.vector)
    expect(restored.length).toBe(384)
    for (let i = 0; i < 384; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 5)
    }
  })

  it('upsert replaces existing embedding for same entity', () => {
    const vec1 = makeVector(384, 0.1)
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'hash1',
      vector: vec1,
    })

    const vec2 = makeVector(384, 0.9)
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'hash2',
      vector: vec2,
    })

    const rows = EmbeddingRepository.findByType(db, 'bullet')
    expect(rows.length).toBe(1)
    expect(rows[0].content_hash).toBe('hash2')
  })

  it('findByType returns all embeddings for a type', () => {
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'h1',
      vector: makeVector(),
    })
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-002',
      content_hash: 'h2',
      vector: makeVector(),
    })
    EmbeddingRepository.upsert(db, {
      entity_type: 'perspective',
      entity_id: 'p-001',
      content_hash: 'h3',
      vector: makeVector(),
    })

    const bullets = EmbeddingRepository.findByType(db, 'bullet')
    expect(bullets.length).toBe(2)

    const perspectives = EmbeddingRepository.findByType(db, 'perspective')
    expect(perspectives.length).toBe(1)
  })

  it('deleteByEntity removes the embedding', () => {
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'h1',
      vector: makeVector(),
    })

    const deleted = EmbeddingRepository.deleteByEntity(db, 'bullet', 'b-001')
    expect(deleted).toBe(true)

    const found = EmbeddingRepository.findByEntity(db, 'bullet', 'b-001')
    expect(found).toBeNull()
  })

  it('deleteByEntity returns false for nonexistent embedding', () => {
    const deleted = EmbeddingRepository.deleteByEntity(db, 'bullet', 'nonexistent')
    expect(deleted).toBe(false)
  })

  it('findStale detects missing and changed embeddings', () => {
    EmbeddingRepository.upsert(db, {
      entity_type: 'bullet',
      entity_id: 'b-001',
      content_hash: 'old_hash',
      vector: makeVector(),
    })

    const currentHashes = new Map<string, string>([
      ['b-001', 'new_hash'],   // stale: hash changed
      ['b-002', 'some_hash'],  // missing: no embedding at all
    ])

    const stale = EmbeddingRepository.findStale(db, 'bullet', currentHashes)
    expect(stale.length).toBe(2)

    const changed = stale.find(s => s.entity_id === 'b-001')
    expect(changed!.stored_hash).toBe('old_hash')
    expect(changed!.current_hash).toBe('new_hash')

    const missing = stale.find(s => s.entity_id === 'b-002')
    expect(missing!.stored_hash).toBeNull()
    expect(missing!.current_hash).toBe('some_hash')
  })

  it('rejects invalid entity_type via CHECK constraint', () => {
    expect(() => {
      db.run(
        `INSERT INTO embeddings (id, entity_type, entity_id, content_hash, vector)
         VALUES ('x', 'invalid', 'e1', 'h', x'00')`,
      )
    }).toThrow()
  })
})
