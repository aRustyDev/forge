/**
 * Common lifecycle hooks used by the entity map.
 *
 * Each hook is a pure function of HookContext. Hooks that require
 * dependencies (EmbeddingService) are created by factory functions that
 * close over the injected service.
 *
 * See Section 3.3 and 8.2 of the Phase 0 spec.
 */

import type { HookFn } from '../entity-map'

/**
 * ISO 8601 timestamp in Forge's canonical format (Z-suffixed, no millis).
 * Matches SQLite's strftime('%Y-%m-%dT%H:%M:%SZ', 'now') output exactly.
 */
export function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ─── setUpdatedAt ──────────────────────────────────────────────────────────
//
// beforeUpdate hook that refreshes the updated_at timestamp. Applied to
// every entity with an updated_at column.

export const setUpdatedAt: HookFn = (ctx) => {
  ctx.data.updated_at = isoNow()
}

// ─── captureSnapshotHook ───────────────────────────────────────────────────
//
// beforeCreate/beforeUpdate hook on resume_entries that copies the
// referenced perspective's content into perspective_content_snapshot.
// Implements the copy-on-write pattern: if the caller doesn't provide a
// local override in `content`, we freeze the perspective text at write
// time so future changes to the perspective don't silently mutate the
// resume.

export const captureSnapshotHook: HookFn = async (ctx) => {
  // Only applies when there's a perspective_id and no local content override.
  const perspectiveId = ctx.data.perspective_id as string | undefined | null
  const content = ctx.data.content as string | undefined | null

  if (!perspectiveId || content) {
    return
  }

  // Only capture if the snapshot wasn't already provided by the caller.
  if (ctx.data.perspective_content_snapshot) {
    return
  }

  const perspective = await ctx.adapter.get('perspectives', perspectiveId)
  if (perspective && typeof perspective.content === 'string') {
    ctx.data.perspective_content_snapshot = perspective.content
  }
}

// ─── captureBulletSnapshotHook ─────────────────────────────────────────────
//
// beforeCreate hook on perspectives that snapshots the referenced bullet's
// content into bullet_content_snapshot. Used for drift detection and
// audit trail (audit-service uses this to detect stale perspectives).

export const captureBulletSnapshotHook: HookFn = async (ctx) => {
  const bulletId = ctx.data.bullet_id as string | undefined
  if (!bulletId) return
  if (ctx.data.bullet_content_snapshot) return

  const bullet = await ctx.adapter.get('bullets', bulletId)
  if (bullet && typeof bullet.content === 'string') {
    ctx.data.bullet_content_snapshot = bullet.content
  }
}

// ─── captureSourceSnapshotHook ─────────────────────────────────────────────
//
// beforeCreate hook on bullets that snapshots the primary source's
// description into source_content_snapshot. Unlike perspective snapshots,
// a bullet may have multiple sources via bullet_sources — we snapshot
// the first/primary source if the caller didn't supply a snapshot.
//
// Note: bullets require source_content_snapshot (NOT NULL). Callers
// typically provide it directly from the derivation prompt input. This
// hook is a fallback for programmatic creates that don't.

export const captureSourceSnapshotHook: HookFn = async (ctx) => {
  if (ctx.data.source_content_snapshot) return
  // If the caller didn't provide a snapshot, leave it — integrity layer
  // will reject on REQUIRED_VIOLATION. Bullets created outside the
  // derivation flow must supply source_content_snapshot explicitly.
  // (This hook exists as a placeholder for future enhancement.)
}

// ─── createEmbedHook ───────────────────────────────────────────────────────
//
// Factory that returns an afterCreate hook which fires fire-and-forget
// embedding for the newly created entity. The hook closes over the
// injected EmbeddingService.
//
// Errors are caught and logged — they do NOT reject the parent operation.
// This matches the existing fire-and-forget pattern in Forge (bullet,
// perspective, source, JD services all use queueMicrotask for embedding).

export interface EmbeddingServiceLike {
  embed(entityType: string, entityId: string, content: string): Promise<void>
}

/**
 * Build an afterCreate hook that fires embedding for the given entity type.
 *
 * @param service Embedding service (undefined = no-op, for tests/OSS)
 * @param entityType Canonical embedding entity type (e.g. 'bullet', 'source')
 * @param contentField Which field on the entity contains the text to embed
 */
export function createEmbedHook(
  service: EmbeddingServiceLike | undefined,
  entityType: string,
  contentField = 'content',
): HookFn {
  // If no service is provided (tests, OSS build), return a no-op.
  if (!service) {
    return () => undefined
  }

  return (ctx) => {
    if (!ctx.id) return
    const content = ctx.data[contentField]
    if (typeof content !== 'string' || content.length === 0) return

    queueMicrotask(() => {
      service
        .embed(entityType, ctx.id!, content)
        .catch((err) => {
          // Match existing Forge behavior: embedding failures are
          // logged but never propagated to the caller.
          console.error(
            `[storage] embedding failed for ${entityType}/${ctx.id}:`,
            err,
          )
        })
    })
  }
}

// ─── setCreatedAt ──────────────────────────────────────────────────────────
//
// beforeCreate hook that sets created_at if not provided. Most entities
// rely on field defaults (DEFAULT strftime(...)) instead; this hook is
// for entities where the created_at default is computed at the field
// level via a function (() => isoNow()).

export const setCreatedAt: HookFn = (ctx) => {
  if (!ctx.data.created_at) {
    ctx.data.created_at = isoNow()
  }
}
