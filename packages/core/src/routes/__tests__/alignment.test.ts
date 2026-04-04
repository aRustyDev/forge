/**
 * Alignment route tests — validation, error handling, and happy paths.
 *
 * Uses a lightweight Hono app with mocked Services to test the alignment
 * route handlers in isolation (no database required).
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Hono } from 'hono'
import { alignmentRoutes } from '../alignment'
import type { Services } from '../../services'
import type { AlignmentReport, RequirementMatchReport } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────

const SAMPLE_ALIGNMENT_REPORT: AlignmentReport = {
  job_description_id: 'jd-1',
  resume_id: 'r-1',
  overall_score: 0.60,
  requirement_matches: [
    {
      requirement_text: 'Experience with Kubernetes and container orchestration',
      requirement_index: 0,
      best_match: {
        entry_id: 'e1',
        perspective_id: 'p1',
        perspective_content: 'Designed and deployed Kubernetes clusters across 3 cloud providers',
        similarity: 0.87,
      },
      verdict: 'strong',
    },
    {
      requirement_text: 'Strong background in Python or Go for backend services',
      requirement_index: 1,
      best_match: {
        entry_id: 'e2',
        perspective_id: 'p2',
        perspective_content: 'Built Python-based ETL pipelines processing 2M records daily',
        similarity: 0.72,
      },
      verdict: 'adjacent',
    },
    {
      requirement_text: 'Familiarity with CI/CD pipelines and GitOps workflows',
      requirement_index: 2,
      best_match: {
        entry_id: 'e3',
        perspective_id: 'p3',
        perspective_content: 'Implemented ArgoCD-driven GitOps deployment pipeline',
        similarity: 0.81,
      },
      verdict: 'strong',
    },
    {
      requirement_text: 'Understanding of zero-trust security architectures',
      requirement_index: 3,
      best_match: null,
      verdict: 'gap',
    },
  ],
  unmatched_entries: [
    {
      entry_id: 'e4',
      perspective_content: 'Created Grafana dashboards for infrastructure monitoring',
      best_requirement_similarity: 0.31,
    },
  ],
  summary: {
    strong: 2,
    adjacent: 1,
    gaps: 1,
    total_requirements: 4,
    total_entries: 4,
  },
  computed_at: '2026-04-03T12:00:00.000Z',
}

const SAMPLE_MATCH_REPORT: RequirementMatchReport = {
  job_description_id: 'jd-1',
  matches: [
    {
      requirement_text: 'Experience with Kubernetes',
      candidates: [
        { entity_id: 'p1', content: 'Deployed K8s clusters', similarity: 0.92 },
        { entity_id: 'p3', content: 'ArgoCD GitOps pipeline', similarity: 0.71 },
      ],
    },
    {
      requirement_text: 'Python backend experience',
      candidates: [
        { entity_id: 'p2', content: 'Built Python ETL pipelines', similarity: 0.85 },
      ],
    },
  ],
  computed_at: '2026-04-03T12:00:00.000Z',
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a Services mock with embedding either present (mocked) or undefined */
function createMockServices(opts: {
  withEmbedding?: boolean
  alignResumeFn?: (...args: unknown[]) => unknown
  matchRequirementsFn?: (...args: unknown[]) => unknown
} = {}): Services {
  const { withEmbedding = true, alignResumeFn, matchRequirementsFn } = opts

  const embedding = withEmbedding
    ? {
        alignResume: alignResumeFn ?? mock(() => Promise.resolve({ ok: true, data: SAMPLE_ALIGNMENT_REPORT })),
        matchRequirements: matchRequirementsFn ?? mock(() => Promise.resolve({ ok: true, data: SAMPLE_MATCH_REPORT })),
      }
    : undefined

  return { embedding } as unknown as Services
}

/** Create a lightweight test app with alignment routes mounted */
function createTestAlignment(services: Services) {
  const app = new Hono()
  app.route('/', alignmentRoutes(services))
  return app
}

/** Make a GET request to the test app */
async function get(app: Hono, path: string): Promise<Response> {
  return app.request(`http://localhost${path}`, { method: 'GET' })
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Alignment Routes', () => {
  // ── /alignment/score ─────────────────────────────────────────────

  describe('GET /alignment/score', () => {
    test('happy path returns 200 with alignment report', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=jd-1&resume_id=r-1')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data.job_description_id).toBe('jd-1')
      expect(body.data.resume_id).toBe('r-1')
      expect(body.data.overall_score).toBe(0.60)
      expect(body.data.requirement_matches).toHaveLength(4)
      expect(body.data.summary.strong).toBe(2)
      expect(body.data.summary.adjacent).toBe(1)
      expect(body.data.summary.gaps).toBe(1)
    })

    test('returns 400 when jd_id is missing', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?resume_id=r-1')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when resume_id is missing', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=jd-1')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when strong_threshold <= adjacent_threshold (inverted)', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(
        app,
        '/alignment/score?jd_id=jd-1&resume_id=r-1&strong_threshold=0.3&adjacent_threshold=0.7',
      )
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('0.3')
      expect(body.error.message).toContain('0.7')
    })

    test('returns 400 when strong_threshold == adjacent_threshold (boundary)', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(
        app,
        '/alignment/score?jd_id=jd-1&resume_id=r-1&strong_threshold=0.5&adjacent_threshold=0.5',
      )
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when strong_threshold is out of range', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(
        app,
        '/alignment/score?jd_id=jd-1&resume_id=r-1&strong_threshold=1.5',
      )
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when strong_threshold is NaN', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(
        app,
        '/alignment/score?jd_id=jd-1&resume_id=r-1&strong_threshold=abc',
      )
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('uses default thresholds when not provided', async () => {
      const alignResumeFn = mock(() => Promise.resolve({ ok: true, data: SAMPLE_ALIGNMENT_REPORT }))
      const services = createMockServices({ alignResumeFn })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=jd-1&resume_id=r-1')
      expect(res.status).toBe(200)

      // Verify alignResume was called with default thresholds
      expect(alignResumeFn).toHaveBeenCalledTimes(1)
      const [jdId, resumeId, opts] = alignResumeFn.mock.calls[0]
      expect(jdId).toBe('jd-1')
      expect(resumeId).toBe('r-1')
      expect(opts).toEqual({
        strong_threshold: 0.75,
        adjacent_threshold: 0.50,
      })
    })

    test('returns 404 when JD not found', async () => {
      const alignResumeFn = mock(() =>
        Promise.resolve({ ok: false, error: { code: 'NOT_FOUND', message: 'JD not found' } }),
      )
      const services = createMockServices({ alignResumeFn })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=missing&resume_id=r-1')
      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    test('returns 422 when embeddings are missing', async () => {
      const alignResumeFn = mock(() =>
        Promise.resolve({
          ok: false,
          error: { code: 'MISSING_EMBEDDINGS', message: 'No embeddings computed' },
        }),
      )
      const services = createMockServices({ alignResumeFn })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=jd-1&resume_id=r-1')
      expect(res.status).toBe(422)

      const body = await res.json()
      expect(body.error.code).toBe('MISSING_EMBEDDINGS')
    })

    test('returns 503 when embedding service is undefined', async () => {
      const services = createMockServices({ withEmbedding: false })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/score?jd_id=jd-1&resume_id=r-1')
      expect(res.status).toBe(503)

      const body = await res.json()
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE')
    })
  })

  // ── /alignment/match ─────────────────────────────────────────────

  describe('GET /alignment/match', () => {
    test('happy path returns 200 with match report', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=perspective')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data.job_description_id).toBe('jd-1')
      expect(body.data.matches).toBeArray()
      expect(body.data.matches.length).toBeGreaterThan(0)
    })

    test('returns 400 when jd_id is missing', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?entity_type=perspective')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when entity_type is invalid', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=summary')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('bullet')
      expect(body.error.message).toContain('perspective')
    })

    test('returns 400 when entity_type is missing', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when limit > 100', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=perspective&limit=200')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when limit < 1', async () => {
      const services = createMockServices()
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=perspective&limit=0')
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('uses default options when threshold and limit not provided', async () => {
      const matchRequirementsFn = mock(() =>
        Promise.resolve({ ok: true, data: SAMPLE_MATCH_REPORT }),
      )
      const services = createMockServices({ matchRequirementsFn })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=perspective')
      expect(res.status).toBe(200)

      expect(matchRequirementsFn).toHaveBeenCalledTimes(1)
      const [jdId, entityType, opts] = matchRequirementsFn.mock.calls[0]
      expect(jdId).toBe('jd-1')
      expect(entityType).toBe('perspective')
      expect(opts).toEqual({ threshold: 0.50, limit: 10 })
    })

    test('returns 503 when embedding service is undefined', async () => {
      const services = createMockServices({ withEmbedding: false })
      const app = createTestAlignment(services)

      const res = await get(app, '/alignment/match?jd_id=jd-1&entity_type=perspective')
      expect(res.status).toBe(503)

      const body = await res.json()
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE')
    })
  })

  // ── Structural invariants ─────────────────────────────────────────

  describe('structural invariants', () => {
    test('all JD requirements appear in matches exactly once', () => {
      const report = SAMPLE_ALIGNMENT_REPORT
      const totalRequirements = report.summary.total_requirements

      // Every requirement_index from 0..N-1 must appear exactly once
      expect(report.requirement_matches).toHaveLength(totalRequirements)

      const indices = report.requirement_matches.map(m => m.requirement_index)
      const expected = Array.from({ length: totalRequirements }, (_, i) => i)
      expect(indices.sort()).toEqual(expected)
    })

    test('candidates in match report are sorted by descending similarity', () => {
      for (const match of SAMPLE_MATCH_REPORT.matches) {
        for (let i = 0; i < match.candidates.length - 1; i++) {
          expect(match.candidates[i].similarity).toBeGreaterThanOrEqual(
            match.candidates[i + 1].similarity,
          )
        }
      }
    })
  })
})
