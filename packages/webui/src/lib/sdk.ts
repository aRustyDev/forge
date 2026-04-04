import { ForgeClient, isDevMode } from '@forge/sdk'
import type { ForgeError } from '@forge/sdk'

export const forge = new ForgeClient({ baseUrl: '', debug: true })

// Expose forge on window in dev mode for console debugging
// Usage: forge.debug.getAll() in browser console
if (typeof window !== 'undefined' && isDevMode()) {
  ;(window as unknown as Record<string, unknown>).forge = forge
}

/**
 * Convert an API error to a user-friendly message.
 * Detects when the API server is unreachable and shows a helpful hint.
 */
export function friendlyError(error: ForgeError, fallback?: string): string {
  if (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'UNKNOWN_ERROR' &&
    (error.message.includes('non-JSON') || error.message.includes('502'))
  ) {
    return 'Cannot connect to the Forge API server. Start it with: just api'
  }
  return fallback ? `${fallback}: ${error.message}` : error.message
}
