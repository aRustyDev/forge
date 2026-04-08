import type { Result, PaginatedResult } from '@forge/sdk'
import { truncateResponse } from './truncation'

/** MCP tool response content block. */
interface McpToolContent {
  type: 'text'
  text: string
}

/** MCP tool response shape. */
interface McpToolResponse {
  content: McpToolContent[]
  isError?: boolean
}

/**
 * Map an SDK Result<T> to an MCP tool response.
 *
 * Success: JSON-serialized data as text content, with truncation for large payloads.
 * Failure: Human-readable error message with isError: true.
 */
export function mapResult<T>(result: Result<T>): McpToolResponse {
  if (result.ok) {
    // Void-return operations (delete, remove, unlink) have undefined data.
    // JSON.stringify(undefined) returns JS undefined, which crashes Buffer.byteLength.
    if (result.data === undefined || result.data === null) {
      return { content: [{ type: 'text', text: 'Success.' }] }
    }
    const { text } = truncateResponse(result.data)
    return {
      content: [{ type: 'text', text }],
    }
  }

  const message = formatError(result.error.code, result.error.message, result.error.details)
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Map an SDK PaginatedResult<T> to an MCP tool response.
 *
 * Includes pagination metadata in the response, with truncation for large payloads.
 */
export function mapPaginatedResult<T>(result: PaginatedResult<T>): McpToolResponse {
  if (result.ok) {
    const { text } = truncateResponse({
      data: result.data,
      pagination: result.pagination,
    })
    return {
      content: [{ type: 'text', text }],
    }
  }

  const message = formatError(result.error.code, result.error.message, result.error.details)
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Format an error code + message into a human-readable string.
 *
 * Error code mapping (from spec):
 *   NOT_FOUND           -> "Entity not found: {message}"
 *   VALIDATION_ERROR    -> "Validation failed: {message}" + field details if available
 *   CONFLICT            -> "Conflict: {message}" (e.g., "Source is locked for derivation")
 *   AI_ERROR            -> "AI derivation failed -- retry or check server logs"
 *   GATEWAY_TIMEOUT     -> "AI call timed out -- retry"
 *   NETWORK_ERROR       -> "Cannot reach Forge server -- is it running?"
 *   SERVICE_UNAVAILABLE -> "Service unavailable: {message}. Check that the embedding service is running."
 *   *                   -> "Error [{code}]: {message}"
 */
function formatError(code: string, message: string, details?: unknown): string {
  switch (code) {
    case 'NOT_FOUND':
      return `Entity not found: ${message}`
    case 'VALIDATION_ERROR': {
      let text = `Validation failed: ${message}`
      if (details && typeof details === 'object') {
        text += '\n' + JSON.stringify(details, null, 2)
      }
      return text
    }
    case 'CONFLICT':
      return `Conflict: ${message}`
    case 'AI_ERROR':
      return `AI derivation failed -- retry or check server logs. Details: ${message}`
    case 'GATEWAY_TIMEOUT':
      return `AI call timed out -- retry. Details: ${message}`
    case 'NETWORK_ERROR':
      return `Cannot reach Forge server -- is it running? Start with: bun run packages/core/src/index.ts\nDetails: ${message}`
    case 'SERVICE_UNAVAILABLE':
      return `Service unavailable: ${message}. Check that the embedding service is running.`
    default:
      return `Error [${code}]: ${message}`
  }
}
