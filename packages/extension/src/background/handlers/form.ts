// packages/extension/src/background/handlers/form.ts

import type { Response } from '../../lib/messaging'
import type { ExtensionError } from '../../lib/errors'

export interface TestFillPayload {
  filled: number
  failed: number
  total: number
}

export async function handleTestFill(): Promise<Response<TestFillPayload>> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'No active tab',
          layer: 'background',
          timestamp: new Date().toISOString(),
        } as ExtensionError,
      }
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/workday.js'],
    })

    const response = await chrome.tabs.sendMessage(tab.id, { cmd: 'testFill' })

    if (response?.ok) {
      return { ok: true, data: response.data as TestFillPayload }
    }

    return {
      ok: false,
      error: response?.error ?? {
        code: 'UNKNOWN_ERROR',
        message: 'Unexpected response from content script',
        layer: 'content',
        timestamp: new Date().toISOString(),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: {
        code: 'FORM_NOT_DETECTED',
        message,
        layer: 'background',
        timestamp: new Date().toISOString(),
      } as ExtensionError,
    }
  }
}
