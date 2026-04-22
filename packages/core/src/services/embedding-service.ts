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
 * Phase 1.6: EmbeddingRepository + raw SQL replaced with EntityLifecycleManager.
 * Blob fields (vector) handled via ELM's native blob serialization (Float32Array → Buffer
 * on write, Uint8Array on read). Upsert semantics preserved via find + create/update.
 * alignResume uses a named query for the resume_entries+sections JOIN.
 *
 * Circular dependency note: This service is injected into the entity map (for
 * afterCreate hooks on bullets/perspectives/sources). The hooks call
 * service.embed() which uses this.elm. Because the EmbeddingService creates its
 * own private ELM (without embedding hooks), there is no infinite loop.
 */

import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Result, Bullet, Perspective, JobDescription, Source,
  EmbeddingEntityType, AlignmentReport, RequirementMatchReport,
  RequirementMatch, UnmatchedEntry, MatchVerdict,
} from '../types'
import {
  STRONG_THRESHOLD_DEFAULT, ADJACENT_THRESHOLD_DEFAULT,
} from '../types'
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

/** Convert Uint8Array (ELM read path) to Float32Array for vector math. */
function toFloat32(blob: unknown): Float32Array {
  if (blob instanceof Float32Array) return blob
  if (blob instanceof Uint8Array) {
    const buf = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
    return new Float32Array(buf)
  }
  if (Buffer.isBuffer(blob)) {
    const buf = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
    return new Float32Array(buf)
  }
  throw new Error('Cannot convert blob to Float32Array')
}

// ── Service ──────────────────────────────────────────────────────────

export class EmbeddingService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  /**
   * Compute and store an embedding for a single entity.
   *
   * If an embedding already exists and the content hash matches,
   * this is a no-op (returns early). If the hash differs, the
   * embedding is recomputed and updated. If none exists, a new one
   * is created.
   */
  async embed(
    entityType: EmbeddingEntityType,
    entityId: string,
    text: string,
  ): Promise<Result<void>> {
    try {
      const hash = contentHash(text)

      // Check if current embedding is still fresh
      const existingResult = await this.elm.list('embeddings', {
        where: { entity_type: entityType, entity_id: entityId },
        limit: 1,
      })
      if (existingResult.ok && existingResult.value.rows.length > 0) {
        const existing = existingResult.value.rows[0]
        if (existing.content_hash === hash) {
          return { ok: true, data: undefined }
        }
        // Hash changed — recompute and update
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
        await this.elm.update('embeddings', existing.id as string, {
          content_hash: hash,
          vector,
        })
        return { ok: true, data: undefined }
      }

      // New embedding
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
      await this.elm.create('embeddings', {
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

      const listResult = await this.elm.list('embeddings', {
        where: { entity_type: entityType },
        limit: 100000,
        includeLazy: ['vector'],
      })
      if (!listResult.ok) {
        return { ok: false, error: { code: 'EMBEDDING_ERROR', message: 'Failed to load embeddings' } }
      }

      const scored: SimilarEntity[] = []
      for (const row of listResult.value.rows) {
        const storedVec = toFloat32(row.vector)
        const sim = cosineSimilarity(queryVec, storedVec)
        if (sim >= threshold) {
          scored.push({ entity_id: row.entity_id as string, similarity: sim })
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

      // Helper: check staleness for a simple entity type
      const checkEntityType = async (
        entityType: EmbeddingEntityType,
        sourceEntity: string,
        contentField: string,
      ) => {
        const entitiesResult = await this.elm.list(sourceEntity, { limit: 100000 })
        if (!entitiesResult.ok) return

        const entityHashes = new Map<string, string>()
        for (const row of entitiesResult.value.rows) {
          const content = row[contentField]
          if (typeof content === 'string' && typeof row.id === 'string') {
            entityHashes.set(row.id, contentHash(content))
          }
        }

        // Check each entity against stored embeddings
        const embeddingsResult = await this.elm.list('embeddings', {
          where: { entity_type: entityType },
          limit: 100000,
        })
        if (!embeddingsResult.ok) return
        const storedById = new Map<string, string>()
        for (const emb of embeddingsResult.value.rows) {
          storedById.set(emb.entity_id as string, emb.content_hash as string)
        }

        // Find stale (hash mismatch or missing embedding)
        for (const [entityId, currentHash] of entityHashes) {
          const storedHash = storedById.get(entityId)
          if (!storedHash) {
            stale.push({ entity_type: entityType, entity_id: entityId, stored_hash: null, current_hash: currentHash })
          } else if (storedHash !== currentHash) {
            stale.push({ entity_type: entityType, entity_id: entityId, stored_hash: storedHash, current_hash: currentHash })
          }
        }

        // Find orphan embeddings (entity deleted from source table)
        for (const emb of embeddingsResult.value.rows) {
          if (!entityHashes.has(emb.entity_id as string)) {
            stale.push({
              entity_type: entityType,
              entity_id: emb.entity_id as string,
              stored_hash: emb.content_hash as string,
              current_hash: '',
            })
          }
        }
      }

      await checkEntityType('bullet', 'bullets', 'content')
      await checkEntityType('perspective', 'perspectives', 'content')
      await checkEntityType('source', 'sources', 'description')

      // Check JD requirements for staleness
      const jdsResult = await this.elm.list('job_descriptions', { limit: 100000 })
      if (jdsResult.ok) {
        const jdReqEmbeddings = await this.elm.list('embeddings', {
          where: { entity_type: 'jd_requirement' },
          limit: 100000,
        })
        const storedReqs = new Map<string, string>()
        if (jdReqEmbeddings.ok) {
          for (const emb of jdReqEmbeddings.value.rows) {
            storedReqs.set(emb.entity_id as string, emb.content_hash as string)
          }
        }

        for (const jd of jdsResult.value.rows) {
          const rawText = jd.raw_text as string
          if (!rawText) continue
          const parsed = parseRequirements(rawText)
          for (let i = 0; i < parsed.requirements.length; i++) {
            const entityId = `${jd.id}:${i}`
            const currentHash = contentHash(parsed.requirements[i].text)
            const storedHash = storedReqs.get(entityId)
            if (!storedHash) {
              stale.push({ entity_type: 'jd_requirement', entity_id: entityId, stored_hash: null, current_hash: currentHash })
            } else if (storedHash !== currentHash) {
              stale.push({ entity_type: 'jd_requirement', entity_id: entityId, stored_hash: storedHash, current_hash: currentHash })
            }
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
        const result = await this.elm.get('bullets', entry.entity_id)
        text = result.ok ? (result.value.content as string) : null
      } else if (entry.entity_type === 'perspective') {
        const result = await this.elm.get('perspectives', entry.entity_id)
        text = result.ok ? (result.value.content as string) : null
      } else if (entry.entity_type === 'source') {
        const result = await this.elm.get('sources', entry.entity_id)
        text = result.ok ? (result.value.description as string) : null
      } else if (entry.entity_type === 'jd_requirement') {
        // Parse the JD ID and requirement index from the entity_id (format: "{jd_id}:{index}")
        const colonIdx = entry.entity_id.lastIndexOf(':')
        if (colonIdx > 0) {
          const jdId = entry.entity_id.slice(0, colonIdx)
          const reqIdx = parseInt(entry.entity_id.slice(colonIdx + 1), 10)
          const jdResult = await this.elm.get('job_descriptions', jdId)
          if (jdResult.ok) {
            const rawText = jdResult.value.raw_text as string
            const parsed = parseRequirements(rawText)
            if (reqIdx < parsed.requirements.length) {
              text = parsed.requirements[reqIdx].text
            }
          }
        }
      }

      if (text === null) {
        // Entity was deleted since the staleness check — remove orphan embedding
        await this.elm.deleteWhere('embeddings', {
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
        })
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
      const strongThreshold = opts?.strongThreshold ?? STRONG_THRESHOLD_DEFAULT
      const adjacentThreshold = opts?.adjacentThreshold ?? ADJACENT_THRESHOLD_DEFAULT

      // Fetch JD requirement embeddings
      const jdEmbResult = await this.elm.list('embeddings', {
        where: { entity_type: 'jd_requirement' },
        limit: 100000,
        includeLazy: ['vector'],
      })
      if (!jdEmbResult.ok) {
        return { ok: false, error: { code: 'EMBEDDING_ERROR', message: 'Failed to load JD embeddings' } }
      }
      const jdRows = jdEmbResult.value.rows.filter(
        (r) => (r.entity_id as string).startsWith(`${jdId}:`),
      )
      if (jdRows.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No requirement embeddings found for JD ${jdId}` },
        }
      }

      // Fetch resume entry perspective IDs via sequential ELM calls
      const sectionsResult = await this.elm.list('resume_sections', {
        where: { resume_id: resumeId },
        limit: 10000,
      })
      if (!sectionsResult.ok || sectionsResult.value.rows.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No resume entries found for resume ${resumeId}` },
        }
      }

      const resumeEntries: Array<{ entry_id: string; perspective_id: string }> = []
      for (const section of sectionsResult.value.rows) {
        const entriesResult = await this.elm.list('resume_entries', {
          where: { section_id: section.id as string },
          limit: 10000,
        })
        if (entriesResult.ok) {
          for (const entry of entriesResult.value.rows) {
            if (entry.perspective_id) {
              resumeEntries.push({
                entry_id: entry.id as string,
                perspective_id: entry.perspective_id as string,
              })
            }
          }
        }
      }

      if (resumeEntries.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No resume entries found for resume ${resumeId}` },
        }
      }

      // Fetch perspective embeddings for resume entries, including content
      const perspectiveEmbeddings: Array<{
        entry_id: string
        perspective_id: string
        perspective_content: string
        vector: Float32Array
      }> = []
      for (const entry of resumeEntries) {
        const embResult = await this.elm.list('embeddings', {
          where: { entity_type: 'perspective', entity_id: entry.perspective_id },
          limit: 1,
          includeLazy: ['vector'],
        })
        if (embResult.ok && embResult.value.rows.length > 0) {
          const embRow = embResult.value.rows[0]
          // Look up perspective content
          const pResult = await this.elm.get('perspectives', entry.perspective_id)
          perspectiveEmbeddings.push({
            entry_id: entry.entry_id,
            perspective_id: entry.perspective_id,
            perspective_content: pResult.ok ? (pResult.value.content as string) : '',
            vector: toFloat32(embRow.vector),
          })
        }
      }

      // Look up requirement texts
      const jdResult = await this.elm.get('job_descriptions', jdId)
      const parsedReqs = jdResult.ok ? parseRequirements(jdResult.value.raw_text as string) : null

      // Track best requirement similarity per entry (for unmatched detection)
      const entryBestReqSim = new Map<string, number>()
      for (const pe of perspectiveEmbeddings) {
        entryBestReqSim.set(pe.entry_id, 0)
      }

      // Compute similarity matrix and classify
      const requirementMatches: RequirementMatch[] = []
      let similaritySum = 0

      for (const jdRow of jdRows) {
        const jdVec = toFloat32(jdRow.vector)
        const reqIdxStr = (jdRow.entity_id as string).split(':').pop()!
        const reqIdx = parseInt(reqIdxStr, 10)

        const requirementText = parsedReqs && reqIdx < parsedReqs.requirements.length
          ? parsedReqs.requirements[reqIdx].text
          : `Requirement ${reqIdx}`

        let bestSimilarity = 0
        let bestPerspective: typeof perspectiveEmbeddings[0] | null = null

        for (const pe of perspectiveEmbeddings) {
          const sim = cosineSimilarity(jdVec, pe.vector)

          // Track best requirement similarity for this entry
          const currentBest = entryBestReqSim.get(pe.entry_id) ?? 0
          if (sim > currentBest) {
            entryBestReqSim.set(pe.entry_id, sim)
          }

          if (sim > bestSimilarity) {
            bestSimilarity = sim
            bestPerspective = pe
          }
        }

        let verdict: MatchVerdict
        if (bestSimilarity >= strongThreshold) {
          verdict = 'strong'
        } else if (bestSimilarity >= adjacentThreshold) {
          verdict = 'adjacent'
        } else {
          verdict = 'gap'
        }

        // Gaps contribute 0.0 to overall_score
        similaritySum += verdict === 'gap' ? 0.0 : bestSimilarity

        requirementMatches.push({
          requirement_text: requirementText,
          requirement_index: reqIdx,
          best_match: bestPerspective ? {
            entry_id: bestPerspective.entry_id,
            perspective_id: bestPerspective.perspective_id,
            perspective_content: bestPerspective.perspective_content,
            similarity: bestSimilarity,
          } : null,
          verdict,
        })
      }

      // Build unmatched entries: resume entries whose best similarity to any requirement
      // is below the adjacent threshold
      const unmatchedEntries: UnmatchedEntry[] = []
      for (const pe of perspectiveEmbeddings) {
        const bestReqSim = entryBestReqSim.get(pe.entry_id) ?? 0
        if (bestReqSim < adjacentThreshold) {
          unmatchedEntries.push({
            entry_id: pe.entry_id,
            perspective_content: pe.perspective_content,
            best_requirement_similarity: bestReqSim,
          })
        }
      }

      const overallScore = requirementMatches.length > 0 ? similaritySum / requirementMatches.length : 0

      return {
        ok: true,
        data: {
          job_description_id: jdId,
          resume_id: resumeId,
          overall_score: overallScore,
          requirement_matches: requirementMatches,
          unmatched_entries: unmatchedEntries,
          summary: {
            strong: requirementMatches.filter(m => m.verdict === 'strong').length,
            adjacent: requirementMatches.filter(m => m.verdict === 'adjacent').length,
            gaps: requirementMatches.filter(m => m.verdict === 'gap').length,
            total_requirements: requirementMatches.length,
            total_entries: perspectiveEmbeddings.length,
          },
          computed_at: new Date().toISOString(),
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
      const jdEmbResult = await this.elm.list('embeddings', {
        where: { entity_type: 'jd_requirement' },
        limit: 100000,
        includeLazy: ['vector'],
      })
      if (!jdEmbResult.ok) {
        return { ok: false, error: { code: 'EMBEDDING_ERROR', message: 'Failed to load JD embeddings' } }
      }
      const jdRows = jdEmbResult.value.rows.filter(
        (r) => (r.entity_id as string).startsWith(`${jdId}:`),
      )
      if (jdRows.length === 0) {
        return {
          ok: false,
          error: { code: 'EMBEDDING_ERROR', message: `No requirement embeddings found for JD ${jdId}` },
        }
      }

      // Fetch all entity embeddings of the requested type
      const entityEmbResult = await this.elm.list('embeddings', {
        where: { entity_type: entityType },
        limit: 100000,
        includeLazy: ['vector'],
      })
      if (!entityEmbResult.ok) {
        return { ok: false, error: { code: 'EMBEDDING_ERROR', message: 'Failed to load entity embeddings' } }
      }

      // Look up requirement texts
      const jdResult = await this.elm.get('job_descriptions', jdId)
      const parsedReqs = jdResult.ok ? parseRequirements(jdResult.value.raw_text as string) : null

      const matches: RequirementMatchReport['matches'] = []

      for (const jdRow of jdRows) {
        const jdVec = toFloat32(jdRow.vector)
        const reqIdx = parseInt((jdRow.entity_id as string).split(':').pop()!, 10)
        const requirementText = parsedReqs && reqIdx < parsedReqs.requirements.length
          ? parsedReqs.requirements[reqIdx].text
          : `Requirement ${reqIdx}`

        // Score all entities against this requirement
        const candidates: Array<{ entity_id: string; content: string; similarity: number }> = []
        for (const entityRow of entityEmbResult.value.rows) {
          const entityVec = toFloat32(entityRow.vector)
          const sim = cosineSimilarity(jdVec, entityVec)
          if (sim >= threshold) {
            // Look up content for the entity
            let content = ''
            const entityId = entityRow.entity_id as string
            if (entityType === 'bullet') {
              const r = await this.elm.get('bullets', entityId)
              content = r.ok ? (r.value.content as string) : ''
            } else {
              const r = await this.elm.get('perspectives', entityId)
              content = r.ok ? (r.value.content as string) : ''
            }
            candidates.push({ entity_id: entityId, content, similarity: sim })
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
          computed_at: new Date().toISOString(),
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
      const existingResult = await this.elm.list('embeddings', {
        where: { entity_type: 'jd_requirement' },
        limit: 100000,
      })
      if (existingResult.ok) {
        for (const row of existingResult.value.rows) {
          if ((row.entity_id as string).startsWith(`${jd.id}:`)) {
            await this.elm.deleteWhere('embeddings', {
              entity_type: 'jd_requirement',
              entity_id: row.entity_id as string,
            })
          }
        }
      }

      // Re-parse and re-embed
      const parsed = parseRequirements(jd.raw_text)
      for (let i = 0; i < parsed.requirements.length; i++) {
        const entityId = `${jd.id}:${i}`
        await this.embed('jd_requirement', entityId, parsed.requirements[i].text)
      }
    } catch (err) {
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
      console.error(`[EmbeddingService] Failed to embed source ${source.id}:`, err)
    }
  }
}
