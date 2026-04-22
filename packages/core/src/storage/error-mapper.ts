/**
 * Storage error mapper.
 *
 * Translates StorageError (from the integrity layer) into the service
 * layer's ForgeError shape. Services return Result<T> with a ForgeError
 * whose `code` is one of a few strings that routes, MCP tools, and
 * WebUI all depend on. The integrity layer uses its own StorageErrorCode
 * union; this mapper preserves backwards compatibility so no route
 * handler or client needs to change.
 *
 * Code mapping:
 *   NOT_FOUND           → 'NOT_FOUND'
 *   REQUIRED_VIOLATION  → 'VALIDATION_ERROR'
 *   TYPE_VIOLATION      → 'VALIDATION_ERROR'
 *   ENUM_VIOLATION      → 'VALIDATION_ERROR'
 *   VALIDATION_ERROR    → 'VALIDATION_ERROR'
 *   FK_VIOLATION        → 'VALIDATION_ERROR' (referenced parent doesn't exist — user input error)
 *   UNIQUE_VIOLATION    → 'CONFLICT'
 *   RESTRICT_VIOLATION  → 'CONFLICT'
 *   TRANSACTION_ERROR   → 'INTERNAL' (bubble up as 500)
 *   ADAPTER_ERROR       → 'INTERNAL' (bubble up as 500)
 */

import type { ForgeError, Result } from '../types'
import type { Result as StorageResult, StorageError } from './errors'

/**
 * Translate a StorageError into the service layer's ForgeError.
 *
 * Keeps the original details under error.details so routes can log the
 * full storage-layer context without exposing it in the user-facing
 * message.
 */
export function storageErrorToForgeError(err: StorageError): ForgeError {
  const base: Partial<ForgeError> = {
    message: err.message,
    details: {
      entityType: err.entityType,
      field: err.field,
      ...(err.details ?? {}),
    },
  }

  switch (err.code) {
    case 'NOT_FOUND':
      return { ...base, code: 'NOT_FOUND' } as ForgeError

    case 'REQUIRED_VIOLATION':
    case 'TYPE_VIOLATION':
    case 'ENUM_VIOLATION':
    case 'VALIDATION_ERROR':
    case 'FK_VIOLATION':
      return { ...base, code: 'VALIDATION_ERROR' } as ForgeError

    case 'UNIQUE_VIOLATION':
    case 'RESTRICT_VIOLATION':
      return { ...base, code: 'CONFLICT' } as ForgeError

    case 'TRANSACTION_ERROR':
    case 'ADAPTER_ERROR':
      return { ...base, code: 'INTERNAL' } as ForgeError

    default: {
      // Exhaustiveness check — adding a new StorageErrorCode forces us
      // to decide how it maps to a ForgeError code.
      const _exhaustive: never = err.code
      void _exhaustive
      return { ...base, code: 'INTERNAL' } as ForgeError
    }
  }
}

/**
 * Lift a storage-layer Result<T> into a service-layer Result<T>.
 *
 * On success, rewraps the value as `{ ok: true, data }` (note: storage
 * uses `value`, service uses `data`). On failure, translates the error
 * code via storageErrorToForgeError.
 */
export function liftStorageResult<T>(
  storageResult: StorageResult<T>,
): Result<T> {
  if (storageResult.ok) {
    return { ok: true, data: storageResult.value }
  }
  return { ok: false, error: storageErrorToForgeError(storageResult.error) }
}

/**
 * Like liftStorageResult but transforms the successful value via `map`.
 * Useful when the service wants to cast or reshape the entity data.
 */
export function liftStorageResultMap<In, Out>(
  storageResult: StorageResult<In>,
  map: (value: In) => Out,
): Result<Out> {
  if (storageResult.ok) {
    return { ok: true, data: map(storageResult.value) }
  }
  return { ok: false, error: storageErrorToForgeError(storageResult.error) }
}
