// packages/extension/src/lib/messaging.ts

import type { ExtensionError } from './errors'

/**
 * Commands the popup sends to the background worker.
 * Extend with new cmd types as later phases add capability.
 */
export type Command =
  | { cmd: 'health' }
  | { cmd: 'orgs.list'; limit?: number }
  | { cmd: 'orgs.create'; payload: { name: string } }
  | { cmd: 'form.testFill' }
  | { cmd: 'form.profileFill' }
  | { cmd: 'jd.captureActive'; forceManual?: boolean }
  | { cmd: 'jd.submitExtracted'; data: unknown }
  | { cmd: 'answers.list' }

/**
 * Responses from the background worker to the popup.
 * Generic over the data type. Use discriminated union for typed consumers.
 */
export type Response<T> =
  | { ok: true; data: T }
  | { ok: false; error: ExtensionError }

/** Typed wrapper around chrome.runtime.sendMessage for the popup side. */
export async function sendCommand<T = unknown>(cmd: Command): Promise<Response<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(cmd)) as Response<T> | undefined
    if (!response) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'No response from background worker',
          layer: 'popup',
          timestamp: new Date().toISOString(),
        },
      }
    }
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message,
        layer: 'popup',
        timestamp: new Date().toISOString(),
      },
    }
  }
}
