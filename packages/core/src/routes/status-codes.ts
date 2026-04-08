/**
 * HTTP status code mapping for Forge error codes.
 *
 * Extracted from server.ts to prevent circular dependencies
 * (alignment routes import this, server.ts imports alignment routes).
 */

export function mapStatusCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400
    case 'NOT_FOUND':
    case 'SUMMARY_NOT_FOUND':
      return 404
    case 'CONFLICT':
      return 409
    case 'GONE':
      return 410
    case 'MISSING_EMBEDDINGS':
      return 422
    case 'AI_ERROR':
      return 502
    case 'SERVICE_UNAVAILABLE':
      return 503
    case 'GATEWAY_TIMEOUT':
      return 504
    default:
      return 500
  }
}
