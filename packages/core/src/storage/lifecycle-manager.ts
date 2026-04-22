/**
 * EntityLifecycleManager — the integrity layer.
 *
 * Wraps a StorageAdapter with:
 *   - Constraint enforcement: FK existence, uniqueness, enums, required,
 *     type checks, cascade/restrict/setNull on delete
 *   - Lifecycle hooks: before/after CRUD
 *   - Deserialization: raw adapter rows → canonical JS types using the
 *     entity map (boolean flags, JSON parse, lazy field filtering)
 *
 * All services should write through this layer, not the adapter directly.
 * The underlying adapter stays dumb; this class owns all relational
 * semantics. See Sections 2.2-2.4 and 8.1-8.4 of the Phase 0 spec.
 */

import type { StorageAdapter, Transaction } from './adapter'
import type {
  AdapterCapabilities,
  ListOptions,
  ListResult,
  ReadOptions,
  WhereClause,
} from './adapter-types'
import {
  adapterError,
  err,
  enumViolation,
  fkViolation,
  notFound,
  ok,
  requiredViolation,
  restrictViolation,
  typeViolation,
  uniqueViolation,
  validationError,
  type Result,
  type StorageError,
} from './errors'
import type {
  EntityDefinition,
  EntityMap,
  FieldDefinition,
  HookContext,
  HookFn,
} from './entity-map'

// ─── Public interface ────────────────────────────────────────────────────

export interface EntityLifecycleManagerContract {
  readonly adapter: StorageAdapter
  readonly capabilities: AdapterCapabilities

  create(
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<Result<{ id: string }>>

  get(
    entityType: string,
    id: string,
    opts?: ReadOptions,
  ): Promise<Result<Record<string, unknown>>>

  list(
    entityType: string,
    opts?: ListOptions & ReadOptions,
  ): Promise<Result<ListResult>>

  update(
    entityType: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Result<void>>

  delete(entityType: string, id: string): Promise<Result<void>>

  count(entityType: string, where?: WhereClause): Promise<Result<number>>
  deleteWhere(entityType: string, where: WhereClause): Promise<Result<number>>
  updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<Result<number>>

  query<P extends Record<string, unknown>, R>(
    name: string,
    params: P,
  ): Promise<Result<R>>

  transaction<T>(
    fn: (tx: TransactionScope) => Promise<T>,
  ): Promise<Result<T>>
}

/**
 * Lightweight transaction scope passed to `transaction(fn)`. Mirrors the
 * adapter's Transaction shape; the integrity layer's cascade/restrict
 * semantics are NOT re-run inside user-level transactions (that would be
 * infinite recursion). Use transaction scope for multi-entity atomic
 * writes that don't need integrity validation.
 */
export interface TransactionScope {
  create(entityType: string, data: Record<string, unknown>): Promise<{ id: string }>
  get(entityType: string, id: string): Promise<Record<string, unknown> | null>
  update(entityType: string, id: string, data: Record<string, unknown>): Promise<void>
  delete(entityType: string, id: string): Promise<void>
  deleteWhere(entityType: string, where: WhereClause): Promise<number>
  updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number>
  count(entityType: string, where?: WhereClause): Promise<number>
}

// ─── Implementation ──────────────────────────────────────────────────────

export class EntityLifecycleManager implements EntityLifecycleManagerContract {
  constructor(
    public readonly adapter: StorageAdapter,
    private readonly entityMap: EntityMap,
  ) {}

  get capabilities(): AdapterCapabilities {
    return this.adapter.capabilities
  }

  // ══════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════

  async create(
    entityType: string,
    inputData: Record<string, unknown>,
  ): Promise<Result<{ id: string }>> {
    const def = this.entityMap[entityType]
    if (!def) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }

    // Work on a copy so hooks can mutate without affecting the caller
    const data: Record<string, unknown> = { ...inputData }

    // Step 1: Apply declarative defaults
    applyDefaults(def, data)

    // Step 2: Run beforeCreate hooks (before validation, so they can
    // populate derived fields like bullet_content_snapshot and
    // perspective_content_snapshot that are required).
    try {
      await runHooks(def.hooks?.beforeCreate, {
        entityType,
        data,
        adapter: this.adapter,
      })
    } catch (hookErr) {
      return {
        ok: false,
        error: validationError(
          `beforeCreate hook failed for ${entityType}: ${
            hookErr instanceof Error ? hookErr.message : String(hookErr)
          }`,
          entityType,
        ),
      }
    }

    // Step 3: Validate required fields (after hooks have had a chance
    // to inject derived values)
    const reqErr = validateRequired(entityType, def, data)
    if (reqErr) return { ok: false, error: reqErr }

    // Step 4: Validate field types and unknown-field check
    const typeErr = validateTypesAndFields(entityType, def, data)
    if (typeErr) return { ok: false, error: typeErr }

    // Step 5: Validate enum constraints
    const enumErr = validateEnums(entityType, def, data)
    if (enumErr) return { ok: false, error: enumErr }

    // Step 6: Validate FK existence
    const fkErr = await validateForeignKeys(entityType, def, data, this.adapter)
    if (fkErr) return { ok: false, error: fkErr }

    // Step 7: Validate uniqueness
    const uniqErr = await validateUniqueness(
      entityType,
      def,
      data,
      this.adapter,
      null, // create — no existing id to exclude
    )
    if (uniqErr) return { ok: false, error: uniqErr }

    // Step 8: Delegate to adapter
    let result: { id: string }
    try {
      result = await this.adapter.create(entityType, data)
    } catch (adapterErr) {
      return {
        ok: false,
        error: adapterError(
          adapterErr instanceof Error ? adapterErr.message : String(adapterErr),
          adapterErr,
          entityType,
        ),
      }
    }

    // Step 9: Run afterCreate hooks (errors logged, not propagated)
    await runAfterHooks(def.hooks?.afterCreate, {
      entityType,
      id: result.id,
      data,
      adapter: this.adapter,
    })

    return ok(result)
  }

  // ══════════════════════════════════════════════════════════════════════
  // GET
  // ══════════════════════════════════════════════════════════════════════

  async get(
    entityType: string,
    id: string,
    opts: ReadOptions = {},
  ): Promise<Result<Record<string, unknown>>> {
    const def = this.entityMap[entityType]
    if (!def) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }

    let raw: Record<string, unknown> | null
    try {
      raw = await this.adapter.get(entityType, id)
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }

    if (!raw) return { ok: false, error: notFound(entityType, id) }
    return ok(deserializeRow(def, raw, opts))
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIST
  // ══════════════════════════════════════════════════════════════════════

  async list(
    entityType: string,
    opts: ListOptions & ReadOptions = {},
  ): Promise<Result<ListResult>> {
    const def = this.entityMap[entityType]
    if (!def) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }

    try {
      const result = await this.adapter.list(entityType, opts)
      const rows = result.rows.map((row) => deserializeRow(def, row, opts))
      return ok({ rows, total: result.total })
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════

  async update(
    entityType: string,
    id: string,
    inputData: Record<string, unknown>,
  ): Promise<Result<void>> {
    const def = this.entityMap[entityType]
    if (!def) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }

    const data: Record<string, unknown> = { ...inputData }

    // Step 1: Verify entity exists
    let previous: Record<string, unknown> | null
    try {
      previous = await this.adapter.get(entityType, id)
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
    if (!previous) return { ok: false, error: notFound(entityType, id) }

    // Step 2: beforeUpdate hooks — run before validation so setUpdatedAt
    // and snapshot hooks can inject fields that will be validated
    try {
      await runHooks(def.hooks?.beforeUpdate, {
        entityType,
        id,
        data,
        previous,
        adapter: this.adapter,
      })
    } catch (hookErr) {
      return {
        ok: false,
        error: validationError(
          `beforeUpdate hook failed for ${entityType}: ${
            hookErr instanceof Error ? hookErr.message : String(hookErr)
          }`,
          entityType,
        ),
      }
    }

    // Step 3: Validate types/unknown fields on changed data
    const typeErr = validateTypesAndFields(entityType, def, data, /* partial */ true)
    if (typeErr) return { ok: false, error: typeErr }

    // Step 4: Validate enums on changed fields
    const enumErr = validateEnums(entityType, def, data)
    if (enumErr) return { ok: false, error: enumErr }

    // Step 5: Validate FK existence on changed fields
    const fkErr = await validateForeignKeys(
      entityType,
      def,
      data,
      this.adapter,
      /* partial */ true,
    )
    if (fkErr) return { ok: false, error: fkErr }

    // Step 6: Validate uniqueness (excluding self)
    const uniqErr = await validateUniqueness(
      entityType,
      def,
      data,
      this.adapter,
      id,
    )
    if (uniqErr) return { ok: false, error: uniqErr }

    // Step 7: Delegate
    try {
      await this.adapter.update(entityType, id, data)
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }

    // Step 8: afterUpdate hooks (logged only)
    await runAfterHooks(def.hooks?.afterUpdate, {
      entityType,
      id,
      data,
      previous,
      adapter: this.adapter,
    })

    return ok(undefined)
  }

  // ══════════════════════════════════════════════════════════════════════
  // DELETE (cascade / restrict / setNull)
  // ══════════════════════════════════════════════════════════════════════

  async delete(entityType: string, id: string): Promise<Result<void>> {
    const def = this.entityMap[entityType]
    if (!def) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }

    // Verify exists
    let previous: Record<string, unknown> | null
    try {
      previous = await this.adapter.get(entityType, id)
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
    if (!previous) return { ok: false, error: notFound(entityType, id) }

    // Step 1: Check restrict rules BEFORE touching anything
    for (const rule of def.restrict) {
      try {
        const count = await this.adapter.count(rule.entity, {
          [rule.field]: id,
        })
        if (count > 0) {
          return {
            ok: false,
            error: restrictViolation(
              entityType,
              rule.entity,
              rule.field,
              count,
              rule.message,
            ),
          }
        }
      } catch (e) {
        return {
          ok: false,
          error: adapterError(
            e instanceof Error ? e.message : String(e),
            e,
            entityType,
          ),
        }
      }
    }

    // Step 2: beforeDelete hooks
    try {
      await runHooks(def.hooks?.beforeDelete, {
        entityType,
        id,
        data: previous,
        previous,
        adapter: this.adapter,
      })
    } catch (hookErr) {
      return {
        ok: false,
        error: validationError(
          `beforeDelete hook failed for ${entityType}: ${
            hookErr instanceof Error ? hookErr.message : String(hookErr)
          }`,
          entityType,
        ),
      }
    }

    // Step 3: Open transaction and perform cascade/setNull/delete
    let tx: Transaction
    try {
      tx = await this.adapter.beginTransaction()
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }

    try {
      // Cascade deletes (depth-first recursive)
      await cascadeDelete(entityType, id, def, this.entityMap, tx)

      // Set null updates
      for (const rule of def.setNull) {
        await tx.updateWhere(rule.entity, { [rule.field]: id }, {
          [rule.field]: null,
        })
      }

      // Delete the entity itself (single-id entities only; junction entities
      // should be deleted via deleteWhere by the caller).
      if (!def.primaryKey || def.primaryKey.length === 1) {
        await tx.delete(entityType, id)
      }

      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {
        // rollback errors swallowed
      }
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }

    // Step 4: afterDelete hooks (logged only)
    await runAfterHooks(def.hooks?.afterDelete, {
      entityType,
      id,
      data: previous,
      previous,
      adapter: this.adapter,
    })

    return ok(undefined)
  }

  // ══════════════════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ══════════════════════════════════════════════════════════════════════

  async count(
    entityType: string,
    where?: WhereClause,
  ): Promise<Result<number>> {
    if (!this.entityMap[entityType]) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }
    try {
      return ok(await this.adapter.count(entityType, where))
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
  }

  async deleteWhere(
    entityType: string,
    where: WhereClause,
  ): Promise<Result<number>> {
    if (!this.entityMap[entityType]) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }
    // NOTE: deleteWhere bypasses cascade/restrict/setNull. It is intended
    // for junction tables and bulk cleanup. Callers must know what they're
    // doing. The spec Section 8.3 documents this for junction table access.
    try {
      return ok(await this.adapter.deleteWhere(entityType, where))
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
  }

  async updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<Result<number>> {
    if (!this.entityMap[entityType]) {
      return err('VALIDATION_ERROR', `Unknown entity type: ${entityType}`, {
        entityType,
      })
    }
    try {
      return ok(await this.adapter.updateWhere(entityType, where, data))
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
          entityType,
        ),
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // NAMED QUERIES
  // ══════════════════════════════════════════════════════════════════════

  async query<P extends Record<string, unknown>, R>(
    name: string,
    params: P,
  ): Promise<Result<R>> {
    try {
      const result = (await this.adapter.executeNamedQuery(name, params)) as R
      return ok(result)
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
        ),
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRANSACTION SCOPE
  // ══════════════════════════════════════════════════════════════════════

  async transaction<T>(
    fn: (tx: TransactionScope) => Promise<T>,
  ): Promise<Result<T>> {
    let tx: Transaction
    try {
      tx = await this.adapter.beginTransaction()
    } catch (e) {
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
        ),
      }
    }

    try {
      const result = await fn(tx as TransactionScope)
      await tx.commit()
      return ok(result)
    } catch (e) {
      try {
        await tx.rollback()
      } catch {
        // swallowed
      }
      return {
        ok: false,
        error: adapterError(
          e instanceof Error ? e.message : String(e),
          e,
        ),
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════════════

function applyDefaults(
  def: EntityDefinition,
  data: Record<string, unknown>,
): void {
  for (const [field, fdef] of Object.entries(def.fields)) {
    if (data[field] === undefined && fdef.default !== undefined) {
      const dv = fdef.default
      data[field] = typeof dv === 'function' ? (dv as () => unknown)() : dv
    }
  }
  // Auto-generate `id` for entities whose id field is a required text
  // without an explicit default. Every Forge entity with `id` uses UUIDs;
  // this matches the convention used by SQLite defaults like
  // `DEFAULT (lower(hex(randomblob(16))))` without burdening every entry
  // in the map with a default function.
  const idField = def.fields.id
  if (
    idField &&
    idField.type === 'text' &&
    idField.required &&
    idField.default === undefined &&
    (data.id === undefined || data.id === null)
  ) {
    data.id = crypto.randomUUID()
  }
}

function validateRequired(
  entityType: string,
  def: EntityDefinition,
  data: Record<string, unknown>,
): StorageError | null {
  for (const [field, fdef] of Object.entries(def.fields)) {
    if (!fdef.required) continue
    const v = data[field]
    if (v === undefined || v === null) {
      return requiredViolation(entityType, field)
    }
  }
  return null
}

function validateTypesAndFields(
  entityType: string,
  def: EntityDefinition,
  data: Record<string, unknown>,
  partial = false,
): StorageError | null {
  for (const [field, value] of Object.entries(data)) {
    const fdef = def.fields[field]
    if (!fdef) {
      return validationError(
        `Unknown field "${field}" on ${entityType}`,
        entityType,
        field,
      )
    }
    if (value === null || value === undefined) continue

    const typeErr = checkFieldType(entityType, field, fdef, value)
    if (typeErr) return typeErr

    if (fdef.check && !fdef.check(value)) {
      return validationError(
        `Custom check failed for ${entityType}.${field}`,
        entityType,
        field,
      )
    }
  }
  // partial updates skip required checks — only validate provided fields
  void partial
  return null
}

function checkFieldType(
  entityType: string,
  field: string,
  fdef: FieldDefinition,
  value: unknown,
): StorageError | null {
  if (fdef.boolean === true) {
    if (typeof value !== 'boolean' && typeof value !== 'number') {
      return typeViolation(entityType, field, 'boolean', value)
    }
    return null
  }
  switch (fdef.type) {
    case 'text':
      if (typeof value !== 'string') {
        return typeViolation(entityType, field, 'string', value)
      }
      return null
    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return typeViolation(entityType, field, 'integer', value)
      }
      return null
    case 'real':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return typeViolation(entityType, field, 'real', value)
      }
      return null
    case 'blob':
      if (
        !(value instanceof Uint8Array) &&
        !(value instanceof Float32Array) &&
        !(value instanceof ArrayBuffer)
      ) {
        return typeViolation(entityType, field, 'blob', value)
      }
      return null
    case 'json':
      if (typeof value !== 'object' || value === null) {
        return typeViolation(entityType, field, 'object', value)
      }
      return null
  }
  return null
}

function validateEnums(
  entityType: string,
  def: EntityDefinition,
  data: Record<string, unknown>,
): StorageError | null {
  for (const [field, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    const fdef = def.fields[field]
    if (!fdef?.enum) continue
    const allowed = typeof fdef.enum === 'function' ? fdef.enum() : fdef.enum
    if (!allowed.includes(value as string)) {
      return enumViolation(entityType, field, value, allowed)
    }
  }
  return null
}

async function validateForeignKeys(
  entityType: string,
  def: EntityDefinition,
  data: Record<string, unknown>,
  adapter: StorageAdapter,
  partial = false,
): Promise<StorageError | null> {
  for (const [field, fdef] of Object.entries(def.fields)) {
    if (!fdef.fk) continue
    const value = data[field]

    // partial update: only check provided fields
    if (partial && value === undefined) continue

    if (value === null || value === undefined) {
      if (fdef.fk.nullable) continue
      // required field case already caught by validateRequired
      continue
    }

    try {
      // For the common case (fk points at id), use adapter.get directly
      if (fdef.fk.field === 'id') {
        const parent = await adapter.get(fdef.fk.entity, String(value))
        if (!parent) {
          return fkViolation(entityType, field, fdef.fk.entity, value)
        }
      } else {
        // FK points at a non-id column (e.g. skills.category → skill_categories.slug)
        const count = await adapter.count(fdef.fk.entity, {
          [fdef.fk.field]: value as string | number,
        })
        if (count === 0) {
          return fkViolation(entityType, field, fdef.fk.entity, value)
        }
      }
    } catch {
      return fkViolation(entityType, field, fdef.fk.entity, value)
    }
  }
  return null
}

async function validateUniqueness(
  entityType: string,
  def: EntityDefinition,
  data: Record<string, unknown>,
  adapter: StorageAdapter,
  excludeId: string | null,
): Promise<StorageError | null> {
  for (const [field, fdef] of Object.entries(def.fields)) {
    if (!fdef.unique) continue
    const value = data[field]
    if (value === null || value === undefined) continue

    // For updates, exclude self via $ne on id
    const where: Record<string, unknown> = { [field]: value as string | number }
    if (excludeId !== null) {
      where.id = { $ne: excludeId }
    }

    try {
      const count = await adapter.count(entityType, where)
      if (count > 0) {
        return uniqueViolation(entityType, field, value)
      }
    } catch {
      // adapter errors here are non-fatal for uniqueness check; bubble up
      // as a generic violation
      return uniqueViolation(entityType, field, value)
    }
  }

  // Composite primary key check (for junction tables like
  // archetype_domains, skill_domains, summary_skills, contact_*).
  // Junction tables have `primaryKey: ['a_id', 'b_id']` and no `id`
  // column; per-field unique checks above do not cover this. We only
  // run on create (excludeId === null) because updates on junction
  // tables go through the adapter's `deleteWhere`/`create` pattern,
  // not `update(id, ...)`.
  if (excludeId === null && def.primaryKey && def.primaryKey.length > 1) {
    const allPresent = def.primaryKey.every(
      (pkField) => data[pkField] !== undefined && data[pkField] !== null,
    )
    if (allPresent) {
      const where: Record<string, unknown> = {}
      for (const pkField of def.primaryKey) {
        where[pkField] = data[pkField] as string | number
      }
      try {
        const count = await adapter.count(entityType, where)
        if (count > 0) {
          // Report the first pk field as the "violating" field; the
          // mapped message will be generic enough for callers.
          const firstField = def.primaryKey[0]
          return uniqueViolation(entityType, firstField, data[firstField])
        }
      } catch {
        const firstField = def.primaryKey[0]
        return uniqueViolation(entityType, firstField, data[firstField])
      }
    }
  }

  return null
}

// ══════════════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════════════

async function runHooks(
  hooks: HookFn[] | undefined,
  ctx: HookContext,
): Promise<void> {
  if (!hooks || hooks.length === 0) return
  for (const hook of hooks) {
    await hook(ctx)
  }
}

async function runAfterHooks(
  hooks: HookFn[] | undefined,
  ctx: HookContext,
): Promise<void> {
  if (!hooks || hooks.length === 0) return
  for (const hook of hooks) {
    try {
      await hook(ctx)
    } catch (e) {
      console.error(
        `[storage] after-hook failed for ${ctx.entityType}/${ctx.id ?? '?'}:`,
        e,
      )
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// CASCADE
// ══════════════════════════════════════════════════════════════════════

async function cascadeDelete(
  entityType: string,
  id: string,
  def: EntityDefinition,
  map: EntityMap,
  tx: Transaction,
): Promise<void> {
  for (const rule of def.cascade) {
    const childDef = map[rule.entity]

    // If the child entity has further cascades, we need to recurse:
    // find all child rows, cascade-delete each, then delete them in bulk.
    if (childDef && childDef.cascade.length > 0) {
      // Find child rows (partial — we only need their ids)
      const children = await tx.count(rule.entity, { [rule.field]: id })
      if (children > 0) {
        // We can't SELECT from the transaction without a named query.
        // For Phase 0, we fetch children via the parent adapter list on
        // the transaction's underlying connection. The simpler path here:
        // recurse using the same tx but via get-by-field.
        //
        // Workaround: since Transaction doesn't expose list/get-by-where,
        // and we need child ids for further cascade, use a two-step
        // approach: tx.updateWhere/deleteWhere on the grandchildren first,
        // then bulk delete children.
        //
        // However, the common case is SINGLE-LEVEL cascade (junction table
        // with no further cascades). Full multi-level cascade for entities
        // like resume → resume_sections → resume_entries needs more work.
        //
        // For Phase 0: implement single-level cascade universally. For
        // entities with deeper cascade chains, the cascade rules declare
        // the full transitive closure. This mirrors SQLite's behavior
        // (SQLite's CASCADE also fires transitively without application
        // intervention). We just deleteWhere on the child and let SQLite's
        // native FK cascade handle deeper levels.
        await tx.deleteWhere(rule.entity, { [rule.field]: id })
      }
    } else {
      // Leaf cascade (child has no further cascades — typical junction)
      await tx.deleteWhere(rule.entity, { [rule.field]: id })
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// DESERIALIZATION
// ══════════════════════════════════════════════════════════════════════

/**
 * Convert a raw adapter row to canonical JS types using the entity map.
 *
 *   - boolean flags: INTEGER 0/1 → false/true
 *   - json fields: TEXT → parsed object
 *   - blob fields: Buffer → Uint8Array/Float32Array
 *   - lazy fields: omitted unless opts.includeLazy covers them
 */
export function deserializeRow(
  def: EntityDefinition,
  raw: Record<string, unknown>,
  opts: ReadOptions = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const includeLazy = opts.includeLazy
  const lazySet = Array.isArray(includeLazy) ? new Set(includeLazy) : null

  for (const [field, value] of Object.entries(raw)) {
    const fdef = def.fields[field]
    if (!fdef) {
      // Field exists in DB but not in entity map — pass through unchanged.
      // Could warn, but this keeps forward-compatibility when columns are
      // added to SQLite before the map is updated.
      result[field] = value
      continue
    }

    // Lazy field gate
    if (fdef.lazy) {
      const shouldInclude =
        includeLazy === true ||
        (lazySet !== null && lazySet.has(field))
      if (!shouldInclude) continue
    }

    result[field] = deserializeValue(fdef, value)
  }
  return result
}

function deserializeValue(fdef: FieldDefinition, value: unknown): unknown {
  if (value === null || value === undefined) return value

  if (fdef.boolean === true) {
    return value === 1 || value === true
  }

  switch (fdef.type) {
    case 'json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value

    case 'blob':
      if (value instanceof Uint8Array) return value
      if (Buffer.isBuffer(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      }
      return value

    default:
      return value
  }
}
