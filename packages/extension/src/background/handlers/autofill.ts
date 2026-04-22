// packages/extension/src/background/handlers/autofill.ts

import type { Response } from '../../lib/messaging'
import { extError, mapNetworkError } from '../../lib/errors'
import { buildProfileFieldMap } from '../../lib/profile-map'
import { getClient } from '../client'

export interface ProfileFillPayload {
  filled: number
  skipped: number
  total: number
}

export async function handleProfileFill(): Promise<Response<ProfileFillPayload>> {
  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return {
        ok: false,
        error: extError('UNKNOWN_ERROR', 'No active tab', { layer: 'background' }),
      }
    }

    // 2. Load profile from Forge
    const client = await getClient()
    const profileResult = await client.profile.get()
    if (!profileResult.ok) {
      return {
        ok: false,
        error: extError('PROFILE_NOT_AVAILABLE', 'Profile not loaded from Forge', {
          layer: 'sdk',
          context: { sdk_code: profileResult.error.code },
        }),
      }
    }

    // 3. Build FieldKind → value map
    const values = buildProfileFieldMap(profileResult.data)

    // 3b. Merge answer bank entries (EEO/work-auth fields)
    try {
      const answersResult = await client.answerBank.list()
      if (answersResult.ok) {
        for (const entry of answersResult.data) {
          // Answer bank values take precedence for their field_kinds
          values[entry.field_kind] = entry.value
        }
      }
    } catch {
      // Answer bank fetch failure is non-fatal — continue with profile-only values
    }

    if (Object.keys(values).length === 0) {
      return {
        ok: false,
        error: extError('PROFILE_NOT_AVAILABLE', 'Profile has no fillable fields', {
          layer: 'background',
        }),
      }
    }

    // 4. Inject Workday content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/workday.js'],
    })

    // 5. Send profile values to content script for filling
    const response = await chrome.tabs.sendMessage(tab.id, {
      cmd: 'profileFill',
      values,
    })

    if (response?.ok) {
      return { ok: true, data: response.data as ProfileFillPayload }
    }

    return {
      ok: false,
      error: response?.error ?? extError('FORM_NOT_DETECTED', 'Unexpected response from content script', {
        layer: 'content',
      }),
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/profile' }) }
  }
}
