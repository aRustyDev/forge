/**
 * Tests for M5a: Parser wiring in forge_ingest_job_description MCP tool.
 *
 * Verifies that when raw_text is passed to the ingest handler, the parser
 * auto-populates salary, work_posture, locations, and sections fields before
 * delegating to sdk.jobDescriptions.create().
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { parseJobDescription } from '@forge/core/src/parser'
import { registerTier2JDTools } from '../src/tools/tier2-jd'
import { mapResult } from '../src/utils/error-mapper'

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const RAW_TEXT = `
## About the Role
Senior Software Engineer at Acme Corp.

## Compensation
The salary range for this role is $150,000 - $200,000 per year.

## Location
San Francisco, CA (Hybrid)

## Requirements
- 5+ years experience
`

// ---------------------------------------------------------------------------
// 1. Parser produces expected output for our fixture
// ---------------------------------------------------------------------------

describe('parseJobDescription (fixture sanity check)', () => {
  test('extracts salary, locations, workPosture, and sections', () => {
    const parsed = parseJobDescription(RAW_TEXT)

    expect(parsed.salary).not.toBeNull()
    expect(parsed.salary!.min).toBe(150_000)
    expect(parsed.salary!.max).toBe(200_000)
    expect(parsed.salary!.period).toBe('annual')

    expect(parsed.workPosture).toBe('hybrid')

    expect(parsed.locations.length).toBeGreaterThan(0)
    expect(parsed.locations).toContain('San Francisco, CA')

    expect(parsed.sections.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 2. MCP handler wires parser output into SDK create call
// ---------------------------------------------------------------------------

describe('forge_ingest_job_description parser wiring', () => {
  // Capture what gets passed to sdk.jobDescriptions.create()
  let createMock: ReturnType<typeof mock>
  let registeredHandlers: Map<string, (params: Record<string, unknown>) => Promise<unknown>>

  beforeEach(() => {
    createMock = mock(() =>
      Promise.resolve({
        ok: true,
        data: {
          id: 'jd-001',
          title: 'Senior Software Engineer',
          raw_text: RAW_TEXT,
          salary_min: 150_000,
          salary_max: 200_000,
          salary_period: 'annual',
          work_posture: 'hybrid',
          parsed_locations: '["San Francisco, CA"]',
          parsed_sections: '[]',
          status: 'interested',
          salary_range: null,
          location: null,
          organization_id: null,
          url: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      }),
    )

    registeredHandlers = new Map()

    // Minimal mock McpServer that captures tool registrations
    const mockServer = {
      tool: (
        name: string,
        description: string,
        schema: unknown,
        handler: (params: Record<string, unknown>) => Promise<unknown>,
      ) => {
        registeredHandlers.set(name, handler)
      },
    }

    const mockSdk = {
      jobDescriptions: {
        create: createMock,
        extractSkills: mock(() => Promise.resolve({ ok: true, data: {} })),
        lookupByUrl: mock(() => Promise.resolve({ ok: true, data: null })),
      },
    }

    const flags = {
      jdResumeLinkage: false,
      jdSkillExtraction: false,
      reviewAvailable: false,
      integrityAvailable: false,
      notesAvailable: false,
    }

    registerTier2JDTools(
      mockServer as any,
      mockSdk as any,
      mapResult,
      flags,
    )
  })

  test('auto-populates salary from raw_text', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!
    expect(handler).toBeDefined()

    await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>

    expect(createArgs.salary_min).toBe(150_000)
    expect(createArgs.salary_max).toBe(200_000)
    expect(createArgs.salary_period).toBe('annual')
  })

  test('auto-populates work_posture from raw_text', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
    })

    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>
    expect(createArgs.work_posture).toBe('hybrid')
  })

  test('auto-populates parsed_locations from raw_text', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
    })

    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>
    expect(createArgs.parsed_locations).toBeTruthy()
    const locations = JSON.parse(createArgs.parsed_locations as string)
    expect(locations).toContain('San Francisco, CA')
  })

  test('auto-populates parsed_sections from raw_text', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
    })

    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>
    expect(createArgs.parsed_sections).toBeTruthy()
    const sections = JSON.parse(createArgs.parsed_sections as string)
    expect(sections.length).toBeGreaterThan(0)
  })

  test('preserves explicit params alongside parser-derived fields', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
      organization_id: 'org-123',
      url: 'https://example.com/job',
      status: 'applied',
      salary_range: '$150k-$200k',
      location: 'SF Bay Area',
    })

    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>

    // Explicit params preserved
    expect(createArgs.title).toBe('Senior Software Engineer')
    expect(createArgs.raw_text).toBe(RAW_TEXT)
    expect(createArgs.organization_id).toBe('org-123')
    expect(createArgs.url).toBe('https://example.com/job')
    expect(createArgs.status).toBe('applied')
    expect(createArgs.salary_range).toBe('$150k-$200k')
    expect(createArgs.location).toBe('SF Bay Area')

    // Parser-derived fields also present
    expect(createArgs.salary_min).toBe(150_000)
    expect(createArgs.salary_max).toBe(200_000)
  })

  test('handles raw_text with no salary gracefully', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    await handler({
      title: 'Junior Developer',
      raw_text: 'Looking for a junior developer. Remote position.',
    })

    const createArgs = createMock.mock.calls[0]![0] as Record<string, unknown>

    // No salary found - should be undefined (not passed)
    expect(createArgs.salary_min).toBeUndefined()
    expect(createArgs.salary_max).toBeUndefined()
    expect(createArgs.salary_period).toBeUndefined()
  })

  test('returns MCP response with embedding_status', async () => {
    const handler = registeredHandlers.get('forge_ingest_job_description')!

    const result = (await handler({
      title: 'Senior Software Engineer',
      raw_text: RAW_TEXT,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean }

    expect(result.isError).toBeFalsy()
    expect(result.content).toBeDefined()
    expect(result.content.length).toBe(1)

    const responseData = JSON.parse(result.content[0]!.text)
    expect(responseData.embedding_status).toBeDefined()
  })
})
