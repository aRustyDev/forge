/**
 * SDK Debug Store — structured logging and ring buffer for Forge SDK requests.
 */

// ---------------------------------------------------------------------------
// Dev mode detection
// ---------------------------------------------------------------------------

/**
 * Detect dev mode across Vite (browser/SvelteKit) and Bun (CLI/tests).
 *
 * Detection paths:
 * 1. Vite: `import.meta.env.DEV` is injected at build time and is `true` in dev mode.
 * 2. Bun/Node.js: Falls back to `process.env.NODE_ENV !== 'production'`.
 * 3. FORGE_DEBUG override: `process.env.FORGE_DEBUG === 'true'` forces dev mode on
 *    even in production builds (useful for one-off CLI debugging).
 */
export function isDevMode(): boolean {
  try {
    // Vite injects import.meta.env.DEV as a boolean at build time.
    // In Bun, import.meta.env is an object of env vars (strings), so DEV
    // will be undefined unless explicitly set. Only use this path when DEV
    // is actually a boolean (i.e., Vite-injected).
    if (
      typeof import.meta !== 'undefined' &&
      typeof (import.meta as any).env !== 'undefined' &&
      typeof (import.meta as any).env.DEV === 'boolean'
    ) {
      return (import.meta as any).env.DEV === true
    }
  } catch {}
  // Fallback for Bun, Node.js, and other non-Vite runtimes
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production' || process.env.FORGE_DEBUG === 'true'
  }
  return false
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SDKLogEntry {
  /** ISO 8601 timestamp of when the entry was created. */
  timestamp: string
  /** Whether this is a response or error entry. Request-direction entries are only logged to console.debug. */
  direction: 'response' | 'error'
  /** HTTP method (GET, POST, PATCH, DELETE). */
  method: string
  /** Request path (e.g. /api/resumes/abc-123). */
  path: string
  /** HTTP status code (response only). */
  status?: number
  /** Time from request start to response in milliseconds. */
  duration_ms?: number
  /** Whether the Result.ok value was true. */
  ok?: boolean
  /** ForgeError.code if error. */
  error_code?: string
  /** ForgeError.message if error. */
  error_message?: string
  /** X-Request-Id from response header. */
  request_id?: string
  /** Response body size in bytes (approximate). */
  payload_size?: number
  /** Request body size in bytes (POST/PATCH/PUT only). */
  request_body_size?: number
  /** Total count from paginated response (requestList only). */
  pagination_total?: number
  /** Offset used in paginated request (requestList only). */
  pagination_offset?: number
  /** Limit used in paginated request (requestList only). */
  pagination_limit?: number
  /** Request body (when logPayloads: true, POST/PATCH only). */
  request_body?: unknown
  /** Response body (when logPayloads: true, truncated to 10KB). */
  response_body?: unknown
}

export interface DebugOptions {
  /** Whether to log to console.debug. Default: true. */
  logToConsole?: boolean
  /** Maximum number of entries in the ring buffer. Default: 100. */
  storeSize?: number
  /** Whether to log request/response bodies. Default: false. */
  logPayloads?: boolean
}

// ---------------------------------------------------------------------------
// DebugStore
// ---------------------------------------------------------------------------

/**
 * Ring buffer that captures SDK request/response log entries for debugging.
 * Access via `forge.debug` on a ForgeClient instance.
 *
 * The store operates as a FIFO ring buffer: when entries exceed `maxSize`,
 * the oldest entries are evicted first. When `enabled` is false, `push()`
 * is a no-op but query methods still work on any existing entries.
 */
export class DebugStore {
  /** Whether the store is accepting new entries. */
  readonly enabled: boolean
  /** Whether to log entries to console.debug. */
  readonly logToConsole: boolean
  /** Whether to capture request/response bodies. */
  readonly logPayloads: boolean
  /** Maximum number of entries before oldest are evicted. */
  readonly maxSize: number
  private entries_: SDKLogEntry[] = []

  constructor(options?: boolean | DebugOptions) {
    if (typeof options === 'boolean') {
      this.enabled = options
      this.logToConsole = options
      this.logPayloads = false
      this.maxSize = 100
    } else if (options) {
      this.enabled = true
      this.logToConsole = options.logToConsole ?? true
      this.logPayloads = options.logPayloads ?? false
      this.maxSize = options.storeSize ?? 100
    } else {
      // Auto-detect from runtime environment
      const dev = isDevMode()
      this.enabled = dev
      this.logToConsole = dev
      this.logPayloads = false
      this.maxSize = 100
    }
  }

  /** Push a log entry to the ring buffer. Evicts oldest entry if at capacity (FIFO). */
  push(entry: SDKLogEntry): void {
    if (!this.enabled) return
    this.entries_.push(entry)
    if (this.entries_.length > this.maxSize) {
      this.entries_.shift()
    }
  }

  /** Remove all entries from the buffer. */
  clear(): void {
    this.entries_ = []
  }

  /** Get all entries in chronological order (oldest first). Returns a shallow copy. */
  getAll(): SDKLogEntry[] {
    return [...this.entries_]
  }

  /** Get only error entries (where ok === false). */
  getErrors(): SDKLogEntry[] {
    return this.entries_.filter((e) => e.ok === false)
  }

  /** Get entries matching a path prefix (e.g., '/api/resumes'). */
  getByPath(pathPrefix: string): SDKLogEntry[] {
    return this.entries_.filter((e) => e.path.startsWith(pathPrefix))
  }

  /** Get entries slower than the given threshold in milliseconds. */
  getSlow(thresholdMs: number): SDKLogEntry[] {
    return this.entries_.filter(
      (e) => e.duration_ms !== undefined && e.duration_ms > thresholdMs,
    )
  }
}
