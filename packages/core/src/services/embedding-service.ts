// packages/core/src/services/embedding-service.ts

/**
 * EmbeddingService — vector embedding computation, storage, and similarity search.
 *
 * Wraps the model loader and embedding repository to provide:
 * - embed(): compute and store an embedding for any entity
 * - findSimilar(): cosine similarity search against stored embeddings
 * - checkStale(): detect embeddings whose content has changed
 * - refreshStale(): recompute stale embeddings
 * - alignResume(): JD<->Resume alignment via cosine similarity matrix
 * - matchRequirements(): JD requirement matching against bullet/perspective inventory
 * - Fire-and-forget hooks: onBulletCreated, onPerspectiveCreated, onJDCreated, onSourceCreated
 *
 * Error isolation: embedding failures NEVER propagate to calling services.
 * The embed/hook methods catch all errors internally and log warnings.
 *
 * NOTE (AP1): Use the structured logger from Phase 23 if available. If Phase 23
 * has not landed, console.error is acceptable as a temporary measure.
 * TODO: Replace console.error with structured logger (Phase 23).
 *
 * NOTE (I3): checkStale() uses raw SQL queries for cross-entity staleness scans
 * rather than going through individual repositories. This is intentional for
 * performance: a single scan across multiple entity types avoids N+1 queries
 * through repository abstractions.
 *
 * NOTE (I7): refreshStale() uses individual lookupById calls (N+1 pattern) to
 * fetch entity content. For v1, this is acceptable for the expected small number
 * of stale embeddings. Batched lookup is a future optimization if stale counts grow.
 */

import type { Database } from 'bun:sqlite'
import type {
  Result, Bullet, Perspective, JobDescription, Source,
  EmbeddingEntityType, AlignmentReport, RequirementMatchReport,
} from '../types'
import {
  EmbeddingRepository,
} from '../db/repositories/embedding-repository'
import { computeEmbedding, EMBEDDING_DIM } from '../lib/model-loader'
import { parseRequirements } from '../lib/jd-parser'
import { createHash } from 'node:crypto'

// ── Types ────────────────────────────────────────────────────────────

export interface SimilarEntity {
  entity_id: string
  similarity: number
}

export interface StaleEmbedding {
  entity_type: EmbeddingEntityType
  entity_id: string
  stored_hash: string | null
  current_hash: string
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Compute SHA256 hex digest of a string. */
function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Cosine similarity between two Float32Arrays.
 * Both vectors are assumed to be L2-normalized (norm = 1.0),
 * so cosine similarity reduces to dot product.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }
  return dot
}

// ── Service ──────────────────────────────────────────────────────────

export class EmbeddingService {
  constructor(private db: Database) {}

  /**
   * Compute and store an embedding for a single entity.
   *
   * If an embedding already exists and the content hash matches,
   * this is a no-op (returns early). If the hash differs, the
   * embedding is recomputed and upserted.
   */
  async embed(
    entityType: EmbeddingEntityType,
    entityId: string,
    text: string,
  ): Promise<Result<void>> {
    try {
      const hash = contentHash(text)

      // Check if current embedding is still fresh
      const existing = EmbeddingRepository.findByEntity(this.db, entityType, entityId)
      if (existing && existing.content_hash === hash) {
        return { ok: true, data: undefined }
      }

      // Compute embedding vector
      const vector = await computeEmbedding(text)

      if (vector.length !== EMBEDDING_DIM) {
        return {
          ok: false,
          error: {
            code: 'EMBEDDING_ERROR',
            message: `Expected ${EMBEDDING_DIM}-dim vector, got ${vector.length}`,
          },
        }
      }

      // Upsert into DB
      EmbeddingRepository.upsert(this.db, {
        entity_type: entityType,
        entity_id: entityId,
        content_hash: hash,
        vector,
      })

      return { ok: true, data: undefined }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'EMBEDDING_ERROR', message: `Embedding failed: ${message}` },
      }
    }
  }

  /**
   * Find entities of a given type that are semantically similar to the query text.
   *
   * Computes the query embedding, then performs a brute-force cosine similarity
   * scan against all stored embeddings of the specified type. Returns results
   * sorted by descending similarity, filtered by threshold.
   */
  async findSimilar(
    queryText: string,
    entityType: EmbeddingEntityType,
    threshold = 0.5,
    limit = 10,
  ): Promise<Result<SimilarEntity[]>> {
    try {
      const queryVec = await computeEmbedding(queryText)

      const rows = EmbeddingRepository.findByType(this.db, entityType)

      const scored: SimilarEntity[] = []
      for (const row of rows) {
        const storedVec = EmbeddingRepository.deserializeVector(row.vector)
        const sim = cosineSimilarity(queryVec, storedVec)
        if (sim >= threshold) {
          scored.push({ entity_id: row.entity_id, similarity: sim })
        }
      }

      // Sort descending by similarity, take top N
      scored.sort((a, b) => b.similarity - a.similarity)
      const results = scored.slice(0, limit)

      return { ok: true, data: results }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'EMBEDDING_ERROR', message: `Similarity search failed: ${message}` },
      }
    }
  }

  /**
   * Check for stale embeddings across all entity types.
   *
   * Queries the source-of-truth tables (bullets, perspectives, job_descriptions, sources)
   * and compares content hashes against stored embeddings.
   *
   * Returns an array of stale entries with their entity type, ID, and hash info.
   */
  async checkStale(): Promise<Result<StaleEmbedding[]>> {
    try {
      const stale: StaleEmbedding[] = []

      // Check bullets (stale + orphan)
      const bullets = this.db
        .query('SELECT id, content FROM bullets')
        .all() as Array<{ id: string; content: string }>
      const bulletHashes = new Map(bullets.map(b => [b.id, contentHash(b.content)]))
      const staleBullets = EmbeddingRepository.findStale(this.db, 'bullet', bulletHashes)
      for (const s of staleBullets) {
        stale.push({ entity_type: 'bullet', ...s })
      }
      // Detect orphan embeddings (entity deleted from source table)
      const bulletEmbeddings = EmbeddingRepository.findByType(this.db, 'bullet')
      for (const emb of bulletEmbeddings) {
        if (!bulletHashes.has(emb.entity_id)) {
          stale.push({ entity_type: 'bullet', entity_id: emb.entity_id, stored_hash: emb.content_hash, current_hash: '' })
        }
      }

      // Check perspectives (stale + orphan)
      const perspectives = this.db
        .query('SELECT id, content FROM perspectives')
        .all() as Array<{ id: string; content: string }>
      const perspectiveHashes = new Map(perspectives.map(p => [p.id, contentHash(p.content)]))
      const stalePerspectives = EmbeddingRepository.findStale(this.db, 'perspective', perspectiveHashes)
      for (const s of stalePerspectives) {
        stale.push({ entity_type: 'perspective', ...s })
      }
      const perspectiveEmbeddings = EmbeddingRepository.findByType(this.db, 'perspective')
      for (const emb of perspectiveEmbeddings) {
        if (!perspectiveHashes.has(emb.entity_id)) {
          stale.push({ entity_type: 'perspective', entity_id: emb.entity_id, stored_hash: emb.content_hash, current_hash: '' })
        }
      }

      // Check sources (stale + orphan)
      const sources = this.db
        .query('SELECT id, description FROM sources')
        .all() as Array<{ id: string; description: string }>
      const sourceHashes = new Map(sources.map(s => [s.id, contentHash(s.description)]))
      const staleSources = EmbeddingRepository.findStale(this.db, 'source', sourceHashes)
      for (const s of staleSources) {
        stale.push({ entity_type: 'source', ...s })
      }
      const sourceEmbeddings = EmbeddingRepository.findByType(this.db, 'source')
      for (const emb of sourceEmbeddings) {
        if (!sourceHashes.has(emb.entity_id)) {
          stale.push({ entity_type: 'source', entity_id: emb.entity_id, stored_hash: emb.content_hash, current_hash: '' })
        }
      }

      // Check JD requirements for staleness (S1)
      // Re-parse requirements from raw_text, compute hash of requirement texts,
      // compare against stored content_hash for each jd_requirement embedding.
      const jds = this.db
        .query('SELECT id, raw_text FROM job_descriptions')
        .all() as Array<{ id: string; raw_text: string }>
      for (const jd of jds) {
        const parsed = parseRequirements(jd.raw_text)
        for (let i = 0; i < parsed.requirements.length; i++) {
          const entityId = `${jd.id}:${i}`
          const currentHash = contentHash(parsed.requirements[i].text)
          const existing = EmbeddingRepository.findByEntity(this.db, 'jd_requirement', entityId)
          if (!existing) {
            stale.push({
              entity_type: 'jd_requirement',
              entity_id: entityId,
              stored_hash: null,
              current_hash: currentHash,
            })
          } else if (existing.content_hash !== currentHash) {
            stale.push({
              entity_type: 'jd_requirement',
              entity_id: entityId,
              stored_hash: existing.content_hash,
              current_hash: currentHash,
            })
          }
        }
      }

      return { ok: true, data: stale }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'EMBEDDING_ERROR', message: `Staleness check failed: ${message}` },
      }
    }
  }

  /**
   * Re-embed all stale entries detected by checkStale().
   *
   * Returns the count of embeddings refreshed.
   */
  async refreshStale(): Promise<Result<number>> {
    const staleResult = await this.checkStale()
    if (!staleResult.ok) return staleResult as Result<number>

    let refreshed = 0

    for (const entry of staleResult.data) {
      let text: string | null = null

      if (entry.entity_type === 'bullet') {
        const row = this.db.query('SELECT content FROM bullets WHERE id = ?').get(entry.entity_id) as { content: string } | null
        text = row?.content ?? null
      } else if (entry.entity_type === 'perspective') {
        const row = this.db.query('SELECT content FROM perspectives WHERE id = ?').get(entry.entity_id) as { content: string } | null
        text = row?.content ?? null
      } else if (entry.entity_type === 'source') {
        const row = this.db.query('SELECT description FROM sources WHERE id = ?').get(entry.entity_id) as { description: string } | null
        text = row?.description ?? null
      } else if (entry.entity_type === 'jd_requirement') {
        // Parse the JD ID and requirement index from the entity_id (format: "{jd_id}:{index}")
        const colonIdx = entry.entity_id.lastIndexOf(':')
        if (colonIdx > 0) {
          const jdId = entry.entity_id.slice(0, colonIdx)
          const reqIdx = parseInt(entry.entity_id.slice(colonIdx + 1), 10)
          const jdRow = this.db.query('SELECT raw_text FROM job_descriptions WHERE id = ?').get(jdId) as { raw_text: string } | null
          if (jdRow) {
            const parsed = parseRequirements(jdRow.raw_text)
            if (reqIdx < parsed.requirements.length) {
              text = parsed.requirements[reqIdx].text
            }
          }
        }
      }

      if (text === null) {
        // Entity was deleted since the staleness check -- remove orphan embedding
        EmbeddingRepository.deleteByEntity(this.db, entry.entity_type, entry.entity_id)
        continue
      }

      const result = await this.embed(entry.entity_type, entry.entity_id, text)
      if (result.ok) refreshed++
    }

    return { ok: true, data: refreshed }
  }

  // ── Alignment Methods ───────────────────────────────────────────────

  /**
   * Align a resume against a job description using embedding similarity.
   *
   * Fetches JD requirement embeddings and resume entry (perspective) embeddings,
   * computes a cosine similarity matrix, classifies each requirement as
   * strong/adjacent/gap, and returns an AlignmentReport.
   *
   * overall_score formula: mean of best_match.similarity per requirement.
   * Requirements with no match (gaps) contribute 0.0 to the mean.
   */
  async alignResume(
    jdId: string,
    resumeId: string,
    opts?: { strongThreshold?: number; adjacentThreshold?: number },
  ): Promise<Result<AlignmentReport>> {
    try {
      const strongThreshold = opts?.strongThreshold ?? 0.75
      const adjacentThreshold = opts?.adjacentThreshold ?? 0.50

      // Fetch JD requirement embeddings
      const jdRows = EmbeddingRepository.findByType(this.db, 'jd_requirement')
        .filter(r => r.entity_id.startsWith(`${jdId}:`))
      if (jdRows.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No requirement embeddings found for JD ${jdId}` },
        }
      }

      // Fetch resume entry perspective IDs
      const resumeEntries = this.db.query(
        `SELECT re.perspective_id
         FROM resume_entries re
         JOIN resume_sections rs ON re.section_id = rs.id
         WHERE rs.resume_id = ?`,
      ).all(resumeId) as Array<{ perspective_id: string }>

      if (resumeEntries.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No resume entries found for resume ${resumeId}` },
        }
      }

      // Fetch perspective embeddings for resume entries
      const perspectiveEmbeddings: Array<{ entity_id: string; vector: Float32Array }> = []
      for (const entry of resumeEntries) {
        const embRow = EmbeddingRepository.findByEntity(this.db, 'perspective', entry.perspective_id)
        if (embRow) {
          perspectiveEmbeddings.push({
            entity_id: entry.perspective_id,
            vector: EmbeddingRepository.deserializeVector(embRow.vector),
          })
        }
      }

      // Compute similarity matrix and classify
      const matches: AlignmentReport['matches'] = []
      let similaritySum = 0

      for (const jdRow of jdRows) {
        const jdVec = EmbeddingRepository.deserializeVector(jdRow.vector)
        const reqIdx = jdRow.entity_id.split(':').pop()!
        // Look up the original requirement text
        const jdTextRow = this.db.query('SELECT raw_text FROM job_descriptions WHERE id = ?').get(jdId) as { raw_text: string } | null
        let requirementText = `Requirement ${reqIdx}`
        if (jdTextRow) {
          const parsed = parseRequirements(jdTextRow.raw_text)
          const idx = parseInt(reqIdx, 10)
          if (idx < parsed.requirements.length) {
            requirementText = parsed.requirements[idx].text
          }
        }

        let bestSimilarity = 0
        let bestEntityId: string | null = null

        for (const pe of perspectiveEmbeddings) {
          const sim = cosineSimilarity(jdVec, pe.vector)
          if (sim > bestSimilarity) {
            bestSimilarity = sim
            bestEntityId = pe.entity_id
          }
        }

        let classification: 'strong' | 'adjacent' | 'gap'
        if (bestSimilarity >= strongThreshold) {
          classification = 'strong'
        } else if (bestSimilarity >= adjacentThreshold) {
          classification = 'adjacent'
        } else {
          classification = 'gap'
        }

        // Gaps contribute 0.0 to overall_score
        similaritySum += classification === 'gap' ? 0.0 : bestSimilarity

        matches.push({
          requirement_text: requirementText,
          classification,
          best_match: bestEntityId ? {
            entity_id: bestEntityId,
            similarity: bestSimilarity,
          } : null,
        })
      }

      const overallScore = matches.length > 0 ? similaritySum / matches.length : 0

      return {
        ok: true,
        data: {
          job_description_id: jdId,
          resume_id: resumeId,
          overall_score: overallScore,
          matches,
          strong_count: matches.filter(m => m.classification === 'strong').length,
          adjacent_count: matches.filter(m => m.classification === 'adjacent').length,
          gap_count: matches.filter(m => m.classification === 'gap').length,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'EMBEDDING_ERROR', message: `Alignment failed: ${message}` },
      }
    }
  }

  /**
   * Match JD requirements against the full bullet or perspective inventory.
   *
   * Returns the best-matching entities for each JD requirement, independent of
   * any specific resume. Useful for pre-resume discovery.
   */
  async matchRequirements(
    jdId: string,
    entityType: 'bullet' | 'perspective',
    opts?: { threshold?: number; limit?: number },
  ): Promise<Result<RequirementMatchReport>> {
    try {
      const threshold = opts?.threshold ?? 0.50
      const limit = opts?.limit ?? 10

      // Fetch JD requirement embeddings
      const jdRows = EmbeddingRepository.findByType(this.db, 'jd_requirement')
        .filter(r => r.entity_id.startsWith(`${jdId}:`))
      if (jdRows.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No requirement embeddings found for JD ${jdId}` },
        }
      }

      // Fetch all entity embeddings of the requested type
      const entityRows = EmbeddingRepository.findByType(this.db, entityType)

      // Look up requirement texts
      const jdTextRow = this.db.query('SELECT raw_text FROM job_descriptions WHERE id = ?').get(jdId) as { raw_text: string } | null
      const parsedReqs = jdTextRow ? parseRequirements(jdTextRow.raw_text) : null

      const matches: RequirementMatchReport['matches'] = []

      for (const jdRow of jdRows) {
        const jdVec = EmbeddingRepository.deserializeVector(jdRow.vector)
        const reqIdx = parseInt(jdRow.entity_id.split(':').pop()!, 10)
        const requirementText = parsedReqs && reqIdx < parsedReqs.requirements.length
          ? parsedReqs.requirements[reqIdx].text
          : `Requirement ${reqIdx}`

        // Score all entities against this requirement
        const candidates: Array<{ entity_id: string; content: string; similarity: number }> = []
        for (const entityRow of entityRows) {
          const entityVec = EmbeddingRepository.deserializeVector(entityRow.vector)
          const sim = cosineSimilarity(jdVec, entityVec)
          if (sim >= threshold) {
            // Look up content for the entity
            let content = ''
            if (entityType === 'bullet') {
              const row = this.db.query('SELECT content FROM bullets WHERE id = ?').get(entityRow.entity_id) as { content: string } | null
              content = row?.content ?? ''
            } else {
              const row = this.db.query('SELECT content FROM perspectives WHERE id = ?').get(entityRow.entity_id) as { content: string } | null
              content = row?.content ?? ''
            }
            candidates.push({ entity_id: entityRow.entity_id, content, similarity: sim })
          }
        }

        // Sort by similarity descending, take top N
        candidates.sort((a, b) => b.similarity - a.similarity)
        matches.push({
          requirement_text: requirementText,
          candidates: candidates.slice(0, limit),
        })
      }

      return {
        ok: true,
        data: {
          job_description_id: jdId,
          matches,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'EMBEDDING_ERROR', message: `Requirement matching failed: ${message}` },
      }
    }
  }

  // ── Fire-and-Forget Hooks ──────────────────────────────────────────

  /**
   * Embed a bullet's content after creation. Fire-and-forget.
   * Errors are caught and logged, never propagated.
   */
  async onBulletCreated(bullet: Bullet): Promise<void> {
    try {
      await this.embed('bullet', bullet.id, bullet.content)
    } catch (err) {
      // TODO: Replace with structured logger (Phase 23)
      console.error(`[EmbeddingService] Failed to embed bullet ${bullet.id}:`, err)
    }
  }

  /**
   * Embed a perspective's content after creation. Fire-and-forget.
   * Errors are caught and logged, never propagated.
   */
  async onPerspectiveCreated(perspective: Perspective): Promise<void> {
    try {
      await this.embed('perspective', perspective.id, perspective.content)
    } catch (err) {
      // TODO: Replace with structured logger (Phase 23)
      console.error(`[EmbeddingService] Failed to embed perspective ${perspective.id}:`, err)
    }
  }

  /**
   * Parse and embed JD requirements after JD creation. Fire-and-forget.
   *
   * Accepts pre-parsed requirement strings. Each requirement is embedded
   * with entity_type='jd_requirement' and entity_id='{jd_id}:{index}'.
   */
  async onJDCreated(jd: JobDescription, requirements: string[]): Promise<void> {
    try {
      for (let i = 0; i < requirements.length; i++) {
        const entityId = `${jd.id}:${i}`
        await this.embed('jd_requirement', entityId, requirements[i])
      }
    } catch (err) {
      // TODO: Replace with structured logger (Phase 23)
      console.error(`[EmbeddingService] Failed to embed JD requirements for ${jd.id}:`, err)
    }
  }

  /**
   * Re-parse and re-embed JD requirements when raw_text is updated.
   * Called from JobDescriptionService when raw_text changes.
   *
   * Deletes old requirement embeddings for this JD and re-embeds from scratch.
   */
  async onJDUpdated(jd: JobDescription): Promise<void> {
    try {
      // Delete all existing requirement embeddings for this JD
      const existing = EmbeddingRepository.findByType(this.db, 'jd_requirement')
        .filter(r => r.entity_id.startsWith(`${jd.id}:`))
      for (const row of existing) {
        EmbeddingRepository.deleteByEntity(this.db, 'jd_requirement', row.entity_id)
      }

      // Re-parse and re-embed
      const parsed = parseRequirements(jd.raw_text)
      for (let i = 0; i < parsed.requirements.length; i++) {
        const entityId = `${jd.id}:${i}`
        await this.embed('jd_requirement', entityId, parsed.requirements[i].text)
      }
    } catch (err) {
      // TODO: Replace with structured logger (Phase 23)
      console.error(`[EmbeddingService] Failed to re-embed JD requirements for ${jd.id}:`, err)
    }
  }

  /**
   * Embed a source's description after creation. Fire-and-forget.
   * Errors are caught and logged, never propagated.
   */
  async onSourceCreated(source: Source): Promise<void> {
    try {
      await this.embed('source', source.id, source.description)
    } catch (err) {
      // TODO: Replace with structured logger (Phase 23)
      console.error(`[EmbeddingService] Failed to embed source ${source.id}:`, err)
    }
  }
}
