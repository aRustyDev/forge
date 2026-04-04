import type { Database } from 'bun:sqlite'
import type { EmbeddingEntityType } from '../../types'

export interface EmbeddingRow {
  id: string
  entity_type: EmbeddingEntityType
  entity_id: string
  content_hash: string
  vector: Uint8Array
  created_at: string
}

export interface UpsertEmbeddingInput {
  entity_type: EmbeddingEntityType
  entity_id: string
  content_hash: string
  vector: Float32Array
}

function serializeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
}

function deserializeVector(blob: Uint8Array): Float32Array {
  const alignedBuffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
  return new Float32Array(alignedBuffer)
}

export const EmbeddingRepository = {
  upsert(db: Database, input: UpsertEmbeddingInput): EmbeddingRow {
    const id = crypto.randomUUID()
    const vectorBlob = serializeVector(input.vector)
    const row = db
      .query(
        `INSERT INTO embeddings (id, entity_type, entity_id, content_hash, vector)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (entity_type, entity_id)
         DO UPDATE SET
           content_hash = excluded.content_hash,
           vector = excluded.vector,
           created_at = datetime('now')
         RETURNING *`,
      )
      .get(id, input.entity_type, input.entity_id, input.content_hash, vectorBlob) as EmbeddingRow
    return row
  },

  findByEntity(db: Database, entityType: EmbeddingEntityType, entityId: string): EmbeddingRow | null {
    return db
      .query('SELECT * FROM embeddings WHERE entity_type = ? AND entity_id = ?')
      .get(entityType, entityId) as EmbeddingRow | null
  },

  findByType(db: Database, entityType: EmbeddingEntityType): EmbeddingRow[] {
    return db
      .query('SELECT * FROM embeddings WHERE entity_type = ? ORDER BY created_at DESC')
      .all(entityType) as EmbeddingRow[]
  },

  deleteByEntity(db: Database, entityType: EmbeddingEntityType, entityId: string): boolean {
    const result = db.run(
      'DELETE FROM embeddings WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId],
    )
    return result.changes > 0
  },

  findStale(
    db: Database,
    entityType: EmbeddingEntityType,
    currentHashes: Map<string, string>,
  ): Array<{ entity_id: string; stored_hash: string | null; current_hash: string }> {
    const stale: Array<{ entity_id: string; stored_hash: string | null; current_hash: string }> = []
    for (const [entityId, currentHash] of currentHashes) {
      const row = db
        .query('SELECT content_hash FROM embeddings WHERE entity_type = ? AND entity_id = ?')
        .get(entityType, entityId) as { content_hash: string } | null
      if (!row) {
        stale.push({ entity_id: entityId, stored_hash: null, current_hash: currentHash })
      } else if (row.content_hash !== currentHash) {
        stale.push({ entity_id: entityId, stored_hash: row.content_hash, current_hash: currentHash })
      }
    }
    return stale
  },

  deleteAll(db: Database): number {
    const result = db.run('DELETE FROM embeddings')
    return result.changes
  },

  deserializeVector,
  serializeVector,
}
