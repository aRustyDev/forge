/**
 * Tests for the storage → service error translation.
 *
 * Every StorageErrorCode must map to exactly one ForgeError code, and
 * the mapping must be stable so routes/MCP tools/WebUI continue to work.
 */

import { describe, expect, test } from 'bun:test'

import {
  liftStorageResult,
  liftStorageResultMap,
  storageErrorToForgeError,
} from '../error-mapper'
import type { StorageError, StorageErrorCode } from '../errors'

function makeError(
  code: StorageErrorCode,
  extra: Partial<StorageError> = {},
): StorageError {
  return { code, message: `${code} test`, ...extra }
}

describe('storageErrorToForgeError', () => {
  test('NOT_FOUND → NOT_FOUND', () => {
    expect(storageErrorToForgeError(makeError('NOT_FOUND')).code).toBe('NOT_FOUND')
  })

  test('REQUIRED_VIOLATION → VALIDATION_ERROR', () => {
    expect(storageErrorToForgeError(makeError('REQUIRED_VIOLATION')).code).toBe(
      'VALIDATION_ERROR',
    )
  })

  test('TYPE_VIOLATION → VALIDATION_ERROR', () => {
    expect(storageErrorToForgeError(makeError('TYPE_VIOLATION')).code).toBe(
      'VALIDATION_ERROR',
    )
  })

  test('ENUM_VIOLATION → VALIDATION_ERROR', () => {
    expect(storageErrorToForgeError(makeError('ENUM_VIOLATION')).code).toBe(
      'VALIDATION_ERROR',
    )
  })

  test('VALIDATION_ERROR → VALIDATION_ERROR', () => {
    expect(storageErrorToForgeError(makeError('VALIDATION_ERROR')).code).toBe(
      'VALIDATION_ERROR',
    )
  })

  test('FK_VIOLATION → VALIDATION_ERROR', () => {
    // FK violations are "the parent you're pointing at doesn't exist" —
    // user-input errors, not conflicts.
    expect(storageErrorToForgeError(makeError('FK_VIOLATION')).code).toBe(
      'VALIDATION_ERROR',
    )
  })

  test('UNIQUE_VIOLATION → CONFLICT', () => {
    expect(storageErrorToForgeError(makeError('UNIQUE_VIOLATION')).code).toBe(
      'CONFLICT',
    )
  })

  test('RESTRICT_VIOLATION → CONFLICT', () => {
    // Can't delete because children exist — conflict with existing state.
    expect(storageErrorToForgeError(makeError('RESTRICT_VIOLATION')).code).toBe(
      'CONFLICT',
    )
  })

  test('TRANSACTION_ERROR → INTERNAL', () => {
    expect(storageErrorToForgeError(makeError('TRANSACTION_ERROR')).code).toBe(
      'INTERNAL',
    )
  })

  test('ADAPTER_ERROR → INTERNAL', () => {
    expect(storageErrorToForgeError(makeError('ADAPTER_ERROR')).code).toBe(
      'INTERNAL',
    )
  })

  test('message is preserved', () => {
    const err = makeError('NOT_FOUND', { message: 'bullet with id "x" not found' })
    expect(storageErrorToForgeError(err).message).toBe(
      'bullet with id "x" not found',
    )
  })

  test('entityType and field are preserved in details', () => {
    const err = makeError('UNIQUE_VIOLATION', {
      entityType: 'skills',
      field: 'name',
      details: { value: 'Python' },
    })
    const forgeErr = storageErrorToForgeError(err)
    expect(forgeErr.details).toMatchObject({
      entityType: 'skills',
      field: 'name',
      value: 'Python',
    })
  })
})

describe('liftStorageResult', () => {
  test('success: StorageResult.ok → Result.ok with value→data rename', () => {
    const lifted = liftStorageResult({ ok: true, value: { id: 'abc' } })
    expect(lifted.ok).toBe(true)
    if (lifted.ok) {
      expect(lifted.data).toEqual({ id: 'abc' })
    }
  })

  test('failure: error code is translated', () => {
    const lifted = liftStorageResult<never>({
      ok: false,
      error: makeError('UNIQUE_VIOLATION'),
    })
    expect(lifted.ok).toBe(false)
    if (!lifted.ok) {
      expect(lifted.error.code).toBe('CONFLICT')
    }
  })
})

describe('liftStorageResultMap', () => {
  test('maps successful value', () => {
    const lifted = liftStorageResultMap(
      { ok: true, value: { id: 'abc', name: 'x' } },
      (v) => ({ ...v, extra: true }),
    )
    expect(lifted.ok).toBe(true)
    if (lifted.ok) {
      expect(lifted.data).toEqual({ id: 'abc', name: 'x', extra: true })
    }
  })

  test('passes errors through unchanged', () => {
    const lifted = liftStorageResultMap<never, never>(
      { ok: false, error: makeError('NOT_FOUND') },
      (_) => _ as never,
    )
    expect(lifted.ok).toBe(false)
    if (!lifted.ok) {
      expect(lifted.error.code).toBe('NOT_FOUND')
    }
  })
})
