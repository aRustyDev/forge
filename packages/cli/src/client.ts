import { ForgeClient } from '@forge/sdk'
import type { ForgeError } from '@forge/sdk'

// ---------------------------------------------------------------------------
// SDK client singleton
// ---------------------------------------------------------------------------

const baseUrl = process.env.FORGE_API_URL ?? 'http://localhost:3000'

// Debug logging is OFF by default in CLI to avoid interleaving debug output
// with user-facing command output. Enable for a single command with:
//   FORGE_DEBUG=true forge source list
export const forge = new ForgeClient({
  baseUrl,
  debug: process.env.FORGE_DEBUG === 'true',
})

// ---------------------------------------------------------------------------
// Connection-check helper
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the error represents a network-level failure (server
 * unreachable, DNS failure, etc.).  CLI commands should call this when an SDK
 * result comes back with `ok: false` so they can print a friendly message
 * instead of a raw error dump.
 */
export function isNetworkError(error: ForgeError): boolean {
  return error.code === 'NETWORK_ERROR'
}

/**
 * Print a user-friendly connection-error message and exit with code 1.
 */
export function handleNetworkError(error: ForgeError): never {
  console.error(
    `\nError: Could not connect to the Forge API at ${baseUrl}\n` +
      `       ${error.message}\n\n` +
      `Make sure the API server is running:\n` +
      `  bun run dev            (from packages/mcp)\n\n` +
      `Or set FORGE_API_URL to point to the correct server:\n` +
      `  export FORGE_API_URL=http://localhost:3000\n`,
  )
  process.exit(1)
}

/**
 * Convenience wrapper: if the result is a network error, print a helpful
 * message and exit.  Otherwise return the error for normal handling.
 */
export function exitOnNetworkError(error: ForgeError): ForgeError {
  if (isNetworkError(error)) {
    handleNetworkError(error)
  }
  return error
}
