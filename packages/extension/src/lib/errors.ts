// packages/extension/src/lib/errors.ts

import { serverLoggingEnabled } from '../storage/config'

export type ExtensionErrorCode =
  // Extraction errors (P1)
  | 'NO_PLUGIN_FOR_HOST'
  | 'PLUGIN_THREW'
  | 'EXTRACTION_INCOMPLETE'
  | 'EXTRACTION_EMPTY'
  // API errors (added in P2+)
  | 'API_UNREACHABLE'
  | 'API_CORS_BLOCKED'
  | 'API_VALIDATION_FAILED'
  | 'API_DUPLICATE'
  | 'API_NOT_FOUND'
  | 'API_INTERNAL_ERROR'
  | 'API_TIMEOUT'
  // Dedup errors (P5+)
  | 'ORG_AMBIGUOUS'
  // Autofill errors (P6+)
  | 'FORM_NOT_DETECTED'
  | 'FIELD_WRITE_FAILED'
  | 'PROFILE_NOT_AVAILABLE'
  // Configuration errors
  | 'CONFIG_MISSING'
  | 'UNKNOWN_ERROR'

export interface ExtensionError {
  code: ExtensionErrorCode
  message: string
  layer: 'plugin' | 'content' | 'background' | 'popup' | 'sdk'
  plugin?: string
  url?: string
  context?: Record<string, unknown>
  cause?: ExtensionError
  timestamp: string
}

export function extError(
  code: ExtensionErrorCode,
  message: string,
  opts: Partial<Omit<ExtensionError, 'code' | 'message' | 'timestamp'>> = {},
): ExtensionError {
  return {
    code,
    message,
    layer: opts.layer ?? 'background',
    plugin: opts.plugin,
    url: opts.url,
    context: opts.context,
    cause: opts.cause,
    timestamp: new Date().toISOString(),
  }
}

import type { ForgeError } from '@forge/sdk'

/**
 * Map an SDK ForgeError to an ExtensionError with a sensible code.
 * The SDK's `code` strings come from the Forge server; map the known ones
 * and default the rest to API_INTERNAL_ERROR.
 */
export function mapSdkError(
  err: ForgeError,
  opts: { url?: string; context?: Record<string, unknown> } = {},
): ExtensionError {
  const code: ExtensionErrorCode = (() => {
    switch (err.code) {
      case 'VALIDATION_FAILED':
      case 'INVALID_INPUT':
        return 'API_VALIDATION_FAILED'
      case 'NOT_FOUND':
        return 'API_NOT_FOUND'
      case 'DUPLICATE':
      case 'DUPLICATE_URL':
        return 'API_DUPLICATE'
      case 'NETWORK_ERROR':
        return 'API_UNREACHABLE'
      default:
        return 'API_INTERNAL_ERROR'
    }
  })()

  const result = extError(code, err.message, {
    layer: 'sdk',
    url: opts.url,
    context: { sdk_code: err.code, ...opts.context, details: err.details },
  })
  reportError(result)
  return result
}

/**
 * Map a network-level error (SDK request never reached the server) to an
 * ExtensionError. These have no ForgeError; they're raw exceptions from fetch.
 */
export function mapNetworkError(err: unknown, opts: { url?: string } = {}): ExtensionError {
  const message = err instanceof Error ? err.message : String(err)
  // Chrome surfaces CORS blocks as TypeError: Failed to fetch
  const code: ExtensionErrorCode = message.toLowerCase().includes('cors')
    ? 'API_CORS_BLOCKED'
    : 'API_UNREACHABLE'
  const result = extError(code, message, { layer: 'sdk', url: opts.url })
  reportError(result)
  return result
}

/**
 * Report an error to the Forge server for logging.
 *
 * Fire-and-forget: does not await the response, catches and swallows
 * errors to prevent reporting from causing cascading failures.
 *
 * Reads `serverLoggingEnabled` synchronously from the module-level flag
 * (set by loadConfig on startup) to avoid async config reads on every error.
 */
export function reportError(err: ExtensionError): void {
  if (!serverLoggingEnabled) return

  const body = {
    error_code: err.code,
    message: err.message,
    layer: err.layer,
    plugin: err.plugin ?? undefined,
    url: err.url ?? undefined,
    context: err.context ?? undefined,
  }

  // Fire and forget — read baseUrl from chrome.storage.local cache
  chrome.storage.local.get('forge_ext_config').then((stored) => {
    const config = (stored.forge_ext_config ?? {}) as { baseUrl?: string }
    const baseUrl = config.baseUrl ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/extension/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // Swallow — logging failures must not cascade
    })
  }).catch(() => {
    // Swallow
  })
}
