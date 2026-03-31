import { ArchetypesResource } from './resources/archetypes'
import { BulletsResource } from './resources/bullets'
import { DebugStore } from './debug'
import type { DebugOptions, SDKLogEntry } from './debug'
import { DomainsResource } from './resources/domains'
import { IntegrityResource } from './resources/integrity'
import { NotesResource } from './resources/notes'
import { OrganizationsResource } from './resources/organizations'
import { PerspectivesResource } from './resources/perspectives'
import { ResumesResource } from './resources/resumes'
import { ReviewResource } from './resources/review'
import { ProfileResource } from './resources/profile'
import { SkillsResource } from './resources/skills'
import { SourcesResource } from './resources/sources'
import { JobDescriptionsResource } from './resources/job-descriptions'
import { TemplatesResource } from './resources/templates'
import type { ForgeError, PaginatedResult, Result } from './types'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ForgeClientOptions {
  /** Base URL of the Forge API server, e.g. "http://localhost:3000" or "/api". */
  baseUrl: string
  /** Enable debug logging and ring buffer. true = on, false = off, undefined = auto-detect. */
  debug?: boolean | DebugOptions
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ForgeClient {
  private baseUrl: string

  /** Debug store for programmatic inspection of SDK requests. */
  public debug: DebugStore

  /** Source CRUD + deriveBullets. */
  public sources: SourcesResource
  /** Bullet listing, status transitions, derivePerspectives. */
  public bullets: BulletsResource
  /** Perspective listing, status transitions. */
  public perspectives: PerspectivesResource
  /** Resume CRUD, entry management, gaps, export. */
  public resumes: ResumesResource
  /** Review queue. */
  public review: ReviewResource
  /** Organization CRUD. */
  public organizations: OrganizationsResource
  /** User notes CRUD + references. */
  public notes: NotesResource
  /** Integrity / drift detection. */
  public integrity: IntegrityResource
  /** Domain CRUD. */
  public domains: DomainsResource
  /** Archetype CRUD + domain associations. */
  public archetypes: ArchetypesResource
  /** User profile (contact info). */
  public profile: ProfileResource
  /** Skills CRUD. */
  public skills: SkillsResource
  /** Job description CRUD. */
  public jobDescriptions: JobDescriptionsResource
  /** Resume template CRUD. */
  public templates: TemplatesResource

  constructor(options: ForgeClientOptions) {
    // Strip trailing slash so callers can pass "http://localhost:3000/" without
    // producing double-slash URLs.
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')

    // Initialize debug store BEFORE binding request methods
    if (typeof options.debug === 'boolean' || typeof options.debug === 'object') {
      this.debug = new DebugStore(options.debug)
    } else {
      this.debug = new DebugStore() // auto-detect
    }

    const req = this.request.bind(this)
    const reqList = this.requestList.bind(this)

    this.sources = new SourcesResource(req, reqList)
    this.bullets = new BulletsResource(req, reqList)
    this.perspectives = new PerspectivesResource(req, reqList)
    this.resumes = new ResumesResource(req, reqList, this.baseUrl, this.debug)
    this.review = new ReviewResource(req)
    this.organizations = new OrganizationsResource(req, reqList)
    this.notes = new NotesResource(req, reqList)
    this.integrity = new IntegrityResource(req)
    this.domains = new DomainsResource(req, reqList)
    this.archetypes = new ArchetypesResource(req, reqList)
    this.profile = new ProfileResource(req)
    this.skills = new SkillsResource(req)
    this.jobDescriptions = new JobDescriptionsResource(req, reqList)
    this.templates = new TemplatesResource(req)
  }

  // -------------------------------------------------------------------------
  // Internal helpers — public so resource sub-clients can call them via
  // bound references, but they are NOT re-exported from the barrel (index.ts).
  // -------------------------------------------------------------------------

  /**
   * Single-entity request.
   *
   * 1. Build the full URL from baseUrl + path.
   * 2. Set Content-Type only when a body is provided.
   * 3. Handle 204 No Content (DELETE responses).
   * 4. Unwrap the standard `{ data }` / `{ error }` envelope.
   * 5. Catch network errors and non-JSON error responses.
   * 6. Log request/response to debug store and console.debug.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Result<T>> {
    const start = performance.now()
    const bodySize = body !== undefined ? JSON.stringify(body).length : undefined

    // Log outgoing request
    if (this.debug.enabled && this.debug.logToConsole) {
      console.debug(`[forge:sdk] → ${method} ${path}`)
    }

    try {
      const headers: Record<string, string> = {}
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      const duration = performance.now() - start
      const requestId = response.headers.get('X-Request-Id') ?? undefined

      // 204 No Content — typically DELETE
      if (response.status === 204) {
        const entry: SDKLogEntry = {
          timestamp: new Date().toISOString(),
          direction: 'response',
          method,
          path,
          status: 204,
          duration_ms: Math.round(duration * 10) / 10,
          ok: true,
          request_id: requestId,
          request_body_size: bodySize,
        }
        this.logResponse(entry)
        return { ok: true, data: undefined as T }
      }

      // Attempt to parse JSON. If the server returned a non-JSON body (e.g.
      // an HTML error page from a reverse proxy) this will throw and we fall
      // through to the UNKNOWN_ERROR handler below.
      let json: Record<string, unknown>
      let rawText: string | undefined
      try {
        rawText = await response.text()
        json = JSON.parse(rawText) as Record<string, unknown>
      } catch {
        const entry: SDKLogEntry = {
          timestamp: new Date().toISOString(),
          direction: 'response',
          method,
          path,
          status: response.status,
          duration_ms: Math.round(duration * 10) / 10,
          ok: false,
          error_code: 'UNKNOWN_ERROR',
          error_message: `HTTP ${response.status}: non-JSON response`,
          request_id: requestId,
          payload_size: rawText?.length,
          request_body_size: bodySize,
        }
        this.logResponse(entry)
        return {
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: non-JSON response`,
          },
        }
      }

      if (!response.ok) {
        const error = json.error as ForgeError | undefined
        const errorObj = error ?? {
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${response.status}`,
        }
        const entry: SDKLogEntry = {
          timestamp: new Date().toISOString(),
          direction: 'response',
          method,
          path,
          status: response.status,
          duration_ms: Math.round(duration * 10) / 10,
          ok: false,
          error_code: errorObj.code,
          error_message: errorObj.message,
          request_id: requestId,
          payload_size: rawText?.length,
          request_body_size: bodySize,
          ...(this.debug.logPayloads
            ? {
                request_body: body,
                response_body:
                  rawText && rawText.length <= 10240 ? json : undefined,
              }
            : {}),
        }
        this.logResponse(entry)
        return { ok: false, error: errorObj }
      }

      const entry: SDKLogEntry = {
        timestamp: new Date().toISOString(),
        direction: 'response',
        method,
        path,
        status: response.status,
        duration_ms: Math.round(duration * 10) / 10,
        ok: true,
        request_id: requestId,
        payload_size: rawText?.length,
        request_body_size: bodySize,
        ...(this.debug.logPayloads
          ? {
              request_body: body,
              response_body:
                rawText && rawText.length <= 10240 ? json : undefined,
            }
          : {}),
      }
      this.logResponse(entry)
      return { ok: true, data: json.data as T }
    } catch (err) {
      const duration = performance.now() - start
      const entry: SDKLogEntry = {
        timestamp: new Date().toISOString(),
        direction: 'error',
        method,
        path,
        duration_ms: Math.round(duration * 10) / 10,
        ok: false,
        error_code: 'NETWORK_ERROR',
        error_message: String(err),
        request_body_size: bodySize,
      }
      if (this.debug.enabled && this.debug.logToConsole) {
        console.debug(
          `[forge:sdk] ✗ ${method} ${path} NETWORK_ERROR (${(entry.error_message ?? '').slice(0, 80)})`,
        )
      }
      this.debug.push(entry)
      return {
        ok: false,
        error: { code: 'NETWORK_ERROR', message: String(err) },
      }
    }
  }

  /**
   * List / paginated request.
   *
   * Serializes `params` as a query string appended to `path`, then unwraps
   * the `{ data, pagination }` envelope. Logs request/response to debug store.
   */
  async requestList<T>(
    method: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<PaginatedResult<T>> {
    const start = performance.now()

    if (this.debug.enabled && this.debug.logToConsole) {
      const qs =
        params && Object.keys(params).length > 0
          ? `?${new URLSearchParams(params).toString()}`
          : ''
      console.debug(`[forge:sdk] → ${method} ${path}${qs}`)
    }

    try {
      let url = `${this.baseUrl}${path}`
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(params).toString()
        url += `?${qs}`
      }

      const response = await fetch(url, { method })
      const duration = performance.now() - start
      const requestId = response.headers.get('X-Request-Id') ?? undefined

      let json: Record<string, unknown>
      let rawText: string | undefined
      try {
        rawText = await response.text()
        json = JSON.parse(rawText) as Record<string, unknown>
      } catch {
        const entry: SDKLogEntry = {
          timestamp: new Date().toISOString(),
          direction: 'response',
          method,
          path,
          status: response.status,
          duration_ms: Math.round(duration * 10) / 10,
          ok: false,
          error_code: 'UNKNOWN_ERROR',
          error_message: `HTTP ${response.status}: non-JSON response`,
          request_id: requestId,
          payload_size: rawText?.length,
        }
        this.logResponse(entry)
        return {
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: non-JSON response`,
          },
        }
      }

      if (!response.ok) {
        const error = json.error as ForgeError | undefined
        const errorObj = error ?? {
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${response.status}`,
        }
        const entry: SDKLogEntry = {
          timestamp: new Date().toISOString(),
          direction: 'response',
          method,
          path,
          status: response.status,
          duration_ms: Math.round(duration * 10) / 10,
          ok: false,
          error_code: errorObj.code,
          error_message: errorObj.message,
          request_id: requestId,
          payload_size: rawText?.length,
        }
        this.logResponse(entry)
        return { ok: false, error: errorObj }
      }

      const pagination = json.pagination as {
        total: number
        offset: number
        limit: number
      }
      const entry: SDKLogEntry = {
        timestamp: new Date().toISOString(),
        direction: 'response',
        method,
        path,
        status: response.status,
        duration_ms: Math.round(duration * 10) / 10,
        ok: true,
        request_id: requestId,
        payload_size: rawText?.length,
        pagination_total: pagination?.total,
        pagination_offset: pagination?.offset,
        pagination_limit: pagination?.limit,
      }
      this.logResponse(entry)
      return { ok: true, data: json.data as T[], pagination }
    } catch (err) {
      const duration = performance.now() - start
      const entry: SDKLogEntry = {
        timestamp: new Date().toISOString(),
        direction: 'error',
        method,
        path,
        duration_ms: Math.round(duration * 10) / 10,
        ok: false,
        error_code: 'NETWORK_ERROR',
        error_message: String(err),
      }
      if (this.debug.enabled && this.debug.logToConsole) {
        console.debug(
          `[forge:sdk] ✗ ${method} ${path} NETWORK_ERROR (${String(err).slice(0, 80)})`,
        )
      }
      this.debug.push(entry)
      return {
        ok: false,
        error: { code: 'NETWORK_ERROR', message: String(err) },
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Log a response entry to console.debug and push to the debug store. */
  private logResponse(entry: SDKLogEntry): void {
    if (this.debug.enabled && this.debug.logToConsole) {
      const status = entry.ok ? 'ok' : `ERROR ${entry.error_code}`
      const rid = entry.request_id ? ` [${entry.request_id}]` : ''
      console.debug(
        `[forge:sdk] ← ${entry.method} ${entry.path} ${entry.status} ${entry.duration_ms}ms${rid} ${status}`,
      )
    }
    this.debug.push(entry)
  }
}
