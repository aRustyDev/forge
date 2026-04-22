/**
 * AnswerBankService — business logic for answer bank entries.
 *
 * Stores reusable answers for EEO/work-auth form fields that the
 * browser extension uses to auto-fill job applications (M6).
 *
 * Each entry is keyed by `field_kind` (UNIQUE). Upsert semantics:
 * if a row with the given field_kind exists, update it; otherwise create it.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Result } from '../types'

export interface AnswerBankEntry {
  id: string
  field_kind: string
  label: string
  value: string
  created_at: string
  updated_at: string
}

export interface UpsertAnswerInput {
  field_kind: string
  label: string
  value: string
}

export class AnswerBankService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  /** List all answer bank entries ordered by field_kind. */
  async list(): Promise<Result<AnswerBankEntry[]>> {
    const listResult = await this.elm.list('answer_bank', {
      orderBy: [{ field: 'field_kind', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return { ok: true, data: listResult.value.rows as unknown as AnswerBankEntry[] }
  }

  /** Create or update an answer bank entry by field_kind. */
  async upsert(input: UpsertAnswerInput): Promise<Result<AnswerBankEntry>> {
    if (!input.field_kind || input.field_kind.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'field_kind is required' },
      }
    }
    if (!input.label || input.label.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'label is required' },
      }
    }
    if (input.value === undefined || input.value === null) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'value is required' },
      }
    }

    // Check if an entry with this field_kind already exists
    const existing = await this.elm.list('answer_bank', {
      where: { field_kind: input.field_kind },
      limit: 1,
    })

    if (existing.ok && existing.value.rows.length > 0) {
      // Update existing entry
      const row = existing.value.rows[0] as unknown as AnswerBankEntry
      const updateResult = await this.elm.update('answer_bank', row.id, {
        label: input.label,
        value: input.value,
      })
      if (!updateResult.ok) {
        return { ok: false, error: storageErrorToForgeError(updateResult.error) }
      }
      // Re-fetch to get updated_at
      const fetched = await this.elm.get('answer_bank', row.id)
      if (!fetched.ok) {
        return { ok: false, error: storageErrorToForgeError(fetched.error) }
      }
      return { ok: true, data: fetched.value as unknown as AnswerBankEntry }
    }

    // Create new entry
    const createResult = await this.elm.create('answer_bank', {
      field_kind: input.field_kind,
      label: input.label,
      value: input.value,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('answer_bank', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as AnswerBankEntry }
  }

  /** Delete an answer bank entry by field_kind. Returns NOT_FOUND if missing. */
  async delete(fieldKind: string): Promise<Result<void>> {
    const existing = await this.elm.list('answer_bank', {
      where: { field_kind: fieldKind },
      limit: 1,
    })

    if (!existing.ok || existing.value.rows.length === 0) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Answer bank entry not found: ${fieldKind}` },
      }
    }

    const row = existing.value.rows[0] as unknown as AnswerBankEntry
    const delResult = await this.elm.delete('answer_bank', row.id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }
}
