/**
 * Storage layer error types and Result<T> envelope.
 *
 * These error types are backend-agnostic and form the contract that every
 * adapter + the EntityLifecycleManager use to report failures.
 */

/**
 * Canonical error codes for storage-layer operations.
 *
 * All adapters map their native error conditions to these codes. The
 * EntityLifecycleManager also emits these from its constraint enforcement
 * layer.
 */
export type StorageErrorCode =
  | 'NOT_FOUND'           // requested entity doesn't exist
  | 'FK_VIOLATION'        // referenced entity doesn't exist (create/update)
  | 'UNIQUE_VIOLATION'    // duplicate value on unique field
  | 'RESTRICT_VIOLATION'  // delete blocked: children exist
  | 'ENUM_VIOLATION'      // field value not in allowed set
  | 'REQUIRED_VIOLATION'  // required field missing/null
  | 'TYPE_VIOLATION'      // field value has wrong runtime type
  | 'VALIDATION_ERROR'    // custom check function failed, or unknown field
  | 'TRANSACTION_ERROR'   // transaction begin/commit/rollback failed
  | 'ADAPTER_ERROR'       // backend-specific error (wraps native error)

/**
 * Structured storage error. Services map these to domain errors.
 */
export interface StorageError {
  code: StorageErrorCode
  message: string
  /** Entity type the error relates to, if any. */
  entityType?: string
  /** Field name the error relates to, if any. */
  field?: string
  /** Structured details — e.g. { count: 3 } for restrict violations. */
  details?: Record<string, unknown>
  /** Original error thrown by the underlying adapter, for debugging. */
  cause?: unknown
}

/**
 * Result<T> envelope: every storage layer method returns this.
 *
 * Success: { ok: true, value: T }
 * Failure: { ok: false, error: StorageError }
 *
 * This matches the existing Result<T> pattern used throughout Forge
 * services, keeping consumers uniform.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: StorageError }

// ─── Result constructors ───────────────────────────────────────────────────

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err<T = never>(
  code: StorageErrorCode,
  message: string,
  opts?: Omit<StorageError, 'code' | 'message'>,
): Result<T> {
  return { ok: false, error: { code, message, ...opts } }
}

// ─── Error factories (used by integrity layer + adapters) ──────────────────

export function notFound(entityType: string, id: string): StorageError {
  return {
    code: 'NOT_FOUND',
    message: `${entityType} with id "${id}" not found`,
    entityType,
    details: { id },
  }
}

export function fkViolation(
  entityType: string,
  field: string,
  referencedEntity: string,
  referencedValue: unknown,
): StorageError {
  return {
    code: 'FK_VIOLATION',
    message: `${entityType}.${field} references non-existent ${referencedEntity} "${String(referencedValue)}"`,
    entityType,
    field,
    details: { referencedEntity, referencedValue },
  }
}

export function uniqueViolation(
  entityType: string,
  field: string,
  value: unknown,
): StorageError {
  return {
    code: 'UNIQUE_VIOLATION',
    message: `${entityType}.${field} must be unique: "${String(value)}" already exists`,
    entityType,
    field,
    details: { value },
  }
}

export function restrictViolation(
  entityType: string,
  childEntity: string,
  childField: string,
  count: number,
  customMessage?: string,
): StorageError {
  const message = customMessage
    ? customMessage.replace('{count}', String(count))
    : `Cannot delete ${entityType}: ${count} ${childEntity} row(s) reference it via ${childField}`
  return {
    code: 'RESTRICT_VIOLATION',
    message,
    entityType,
    details: { childEntity, childField, count },
  }
}

export function enumViolation(
  entityType: string,
  field: string,
  value: unknown,
  allowed: readonly string[],
): StorageError {
  return {
    code: 'ENUM_VIOLATION',
    message: `${entityType}.${field}: value "${String(value)}" is not in allowed set [${allowed.join(', ')}]`,
    entityType,
    field,
    details: { value, allowed },
  }
}

export function requiredViolation(
  entityType: string,
  field: string,
): StorageError {
  return {
    code: 'REQUIRED_VIOLATION',
    message: `${entityType}.${field} is required but was not provided`,
    entityType,
    field,
  }
}

export function typeViolation(
  entityType: string,
  field: string,
  expected: string,
  received: unknown,
): StorageError {
  return {
    code: 'TYPE_VIOLATION',
    message: `${entityType}.${field}: expected ${expected}, received ${typeof received}`,
    entityType,
    field,
    details: { expected, received },
  }
}

export function validationError(
  message: string,
  entityType?: string,
  field?: string,
  details?: Record<string, unknown>,
): StorageError {
  return { code: 'VALIDATION_ERROR', message, entityType, field, details }
}

export function adapterError(
  message: string,
  cause: unknown,
  entityType?: string,
): StorageError {
  return { code: 'ADAPTER_ERROR', message, entityType, cause }
}
