/**
 * Entity map — declarative relationship schema driving the integrity layer.
 *
 * Defines every Forge entity's fields, FK/cascade/restrict/setNull rules,
 * and lifecycle hooks. Hand-maintained. Validated against the actual SQLite
 * schema by the PRAGMA test in __tests__/entity-map.test.ts.
 *
 * Built via a factory function (`buildEntityMap(deps)`) so that lifecycle
 * hooks can close over injected services (see Section 8.2 of Phase 0 spec).
 * The static shape `ENTITY_MAP_SHAPE` (field definitions only, no hooks) is
 * used for TypeScript inference of entity types in entity-types.ts.
 */

import type { StorageAdapter } from './adapter'

// ─── Field definition ─────────────────────────────────────────────────────

/**
 * Describes a single field on an entity: its type, constraints, defaults,
 * and runtime behavior flags.
 */
export interface FieldDefinition {
  /**
   * Storage type. Maps to SQLite affinities (TEXT/INTEGER/REAL/BLOB) and to
   * canonical JS types at the integrity layer boundary.
   */
  type: 'text' | 'integer' | 'real' | 'blob' | 'json'

  /** NOT NULL equivalent. */
  required?: boolean

  /** UNIQUE constraint on this field. */
  unique?: boolean

  /**
   * DEFAULT value. May be a literal or a zero-arg function invoked at
   * create time (useful for timestamps, UUIDs).
   */
  default?: unknown | (() => unknown)

  /**
   * Foreign key reference. `entity` is the target entity map key;
   * `field` is the referenced field on that entity (usually 'id').
   * `nullable` means the FK itself can be null (skip FK check when null).
   */
  fk?: { entity: string; field: string; nullable?: boolean }

  /** Enum values — either literal or computed (e.g. lookup table rows). */
  enum?: readonly string[] | (() => readonly string[])

  /** Custom validation — return false to reject the value. */
  check?: (value: unknown) => boolean

  /**
   * Flag an INTEGER field as a boolean. Integrity layer converts
   * 0/1 ↔ false/true on the read path. See Section 8.1 of Phase 0 spec.
   */
  boolean?: boolean

  /**
   * Lazy materialization: don't deserialize on read unless the caller
   * explicitly opts in via ReadOptions.includeLazy. Used for vectors
   * and large JSON blobs.
   */
  lazy?: boolean
}

// ─── Relationship rules ────────────────────────────────────────────────────

/**
 * CASCADE rule: when the parent is deleted, delete all rows in `entity`
 * where `field = parentId`.
 */
export interface CascadeRule {
  entity: string
  field: string
}

/**
 * RESTRICT rule: refuse to delete the parent if any rows in `entity`
 * have `field = parentId`. Message supports {count} placeholder.
 */
export interface RestrictRule {
  entity: string
  field: string
  message?: string
}

/**
 * SET NULL rule: when the parent is deleted, null out `entity.field`
 * for rows referencing the parent.
 */
export interface SetNullRule {
  entity: string
  field: string
}

// ─── Lifecycle hooks ───────────────────────────────────────────────────────

/**
 * Hook execution context.
 *
 * Before-create hooks have no id (id: undefined) but can mutate `data` to
 * inject defaults, capture snapshots, etc. Before-update/delete hooks have
 * id and may have `previous` (the current row state) for diffing.
 *
 * Hooks may call adapter methods — e.g. captureSnapshotHook reads the
 * referenced perspective to populate perspective_content_snapshot.
 */
export interface HookContext {
  entityType: string
  id?: string
  data: Record<string, unknown>
  adapter: StorageAdapter
  previous?: Record<string, unknown>
}

export type HookFn = (ctx: HookContext) => Promise<void> | void

export interface EntityHooks {
  beforeCreate?: HookFn[]
  afterCreate?: HookFn[]
  beforeUpdate?: HookFn[]
  afterUpdate?: HookFn[]
  beforeDelete?: HookFn[]
  afterDelete?: HookFn[]
}

// ─── Entity definition ────────────────────────────────────────────────────

/**
 * Complete definition for a single entity: fields, relationship rules,
 * and lifecycle hooks.
 */
export interface EntityDefinition {
  fields: Record<string, FieldDefinition>
  cascade: CascadeRule[]
  restrict: RestrictRule[]
  setNull: SetNullRule[]
  hooks?: EntityHooks
  /**
   * Primary key field(s). Defaults to ['id'] for most entities.
   * Junction tables use composite PKs (e.g. ['bullet_id', 'skill_id']).
   * Junction entities are accessed via list/count/deleteWhere, never
   * get-by-id (see Section 8.3 of Phase 0 spec).
   */
  primaryKey?: string[]
}

// ─── Type inference helpers ────────────────────────────────────────────────

/**
 * Infer the canonical JS type for a field definition.
 * Used by entity-types.ts to derive Bullet, Perspective, etc.
 */
export type InferFieldType<F extends FieldDefinition> =
  F extends { boolean: true }
    ? boolean
    : F extends { type: 'text' }
    ? string
    : F extends { type: 'integer' }
    ? number
    : F extends { type: 'real' }
    ? number
    : F extends { type: 'blob' }
    ? Uint8Array
    : F extends { type: 'json' }
    ? Record<string, unknown>
    : never

/**
 * Build an entity type from an entity definition's field map.
 * Required fields are non-optional; nullable/optional fields are `T | null`.
 */
export type EntityOf<D extends { fields: Record<string, FieldDefinition> }> = {
  [F in keyof D['fields']]: D['fields'][F] extends { required: true }
    ? InferFieldType<D['fields'][F]>
    : InferFieldType<D['fields'][F]> | null
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Dependencies injected into the entity map factory. Hooks close over
 * these — e.g. the fire-and-forget embedding hook closes over the
 * EmbeddingService instance.
 */
export interface EntityMapDeps {
  /**
   * Embedding service. Optional: tests and OSS builds without vector
   * support can omit it, in which case afterCreate embedding hooks
   * become no-ops.
   */
  embeddingService?: {
    embed(entityType: string, entityId: string, content: string): Promise<void>
  }
}

/**
 * Entity map type: the full output of buildEntityMap().
 */
export type EntityMap = Record<string, EntityDefinition>

// Note: the concrete buildEntityMap() implementation and ENTITY_MAP_SHAPE
// live in ./entity-map.data.ts (populated in the next task) to keep this
// file focused on type definitions. Importers should depend on this file
// for types and ./entity-map.data for runtime values.
