import { describe, test, expect } from 'bun:test'
import { createForgeServer } from '../server'
import { detectFeatures, type FeatureFlags } from '../utils/feature-flags'

// ---------- Mock SDK factory ----------

function createMockSdk(options: { allFeatures?: boolean } = {}) {
  const ok = <T>(data: T) => ({ ok: true as const, data })

  const baseSdk: any = {
    health: async () => ok({ server: 'ok', api_version: '1.0.0', database: 'ok' }),
    alignment: {
      align: async () => ok({ overall_score: 0.85, section_scores: [] }),
      match: async () => ok({ candidates: [{ id: 'p1', score: 0.9 }], match_count: 1 }),
      gap: async () => ok({ covered: ['infra'], missing: ['ml'], thin: [] }),
    },
    sources: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      get: async () => ok({ id: 's1', title: 'Test Source', source_type: 'role' }),
      create: async (input: any) => ok({ id: 's-new', ...input }),
      update: async (id: string, input: any) => ok({ id, ...input }),
    },
    bullets: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      get: async () => ok({ id: 'b1', content: 'Test bullet' }),
      derive: async () => ok({ bullets: [{ id: 'b1', content: 'Derived bullet' }] }),
      approve: async (id: string) => ok({ id, status: 'approved' }),
      reject: async (id: string) => ok({ id, status: 'rejected' }),
      update: async (id: string, input: any) => ok({ id, ...input }),
      reopen: async (id: string) => ok({ id, status: 'pending_review' }),
    },
    perspectives: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      get: async () => ok({ perspective: { id: 'p1' }, bullet: { id: 'b1' }, source: { id: 's1' } }),
      derive: async () => ok({ perspectives: [{ id: 'p1', content: 'Derived perspective' }] }),
      approve: async (id: string) => ok({ id, status: 'approved' }),
      reject: async (id: string) => ok({ id, status: 'rejected' }),
      update: async (id: string, input: any) => ok({ id, ...input }),
      reopen: async (id: string) => ok({ id, status: 'pending_review' }),
    },
    resumes: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      create: async (input: any) => ok({ id: 'r1', ...input, sections: [] }),
      addEntry: async () => ok({ id: 'e1', perspective_id: 'p1' }),
      createSection: async () => ok({ id: 'sec1', title: 'Experience' }),
      export: async () => ok({ content: '# Resume\n\n## Experience\n- Did things' }),
      updateHeader: async (id: string, header: any) => ok({ id, header }),
      update: async (id: string, input: any) => ok({ id, ...input }),
      updateEntry: async (rId: string, eId: string, input: any) => ok({ id: eId, resume_id: rId, ...input }),
      removeEntry: async (rId: string, eId: string) => ok({ id: eId, removed: true }),
      addSkill: async (rId: string, sId: string, skId: string) => ok({ resume_id: rId, section_id: sId, skill_id: skId }),
      removeSkill: async (rId: string, sId: string, skId: string) => ok({ resume_id: rId, section_id: sId, skill_id: skId, removed: true }),
      reorderSkills: async (rId: string, sId: string, skills: any[]) => ok({ resume_id: rId, section_id: sId, skills }),
      saveAsTemplate: async (rId: string, input: any) => ok({ id: 'tmpl1', resume_id: rId, ...input }),
    },
    templates: {
      list: async () => ok([]),
      createResumeFromTemplate: async (input: any) => ok({ id: 'r1', ...input, sections: [{ id: 'sec1' }] }),
    },
    organizations: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      create: async (input: any) => ok({ id: 'org1', ...input }),
    },
    skills: {
      create: async (input: any) => ok({ id: 'sk1', ...input }),
    },
    summaries: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      create: async (input: any) => ok({ id: 'sum1', ...input }),
      update: async (id: string, input: any) => ok({ id, ...input }),
      clone: async (id: string) => ok({ id: 'sum2', cloned_from: id }),
    },
    jobDescriptions: {
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
      create: async (input: any) => ok({ id: 'jd1', ...input }),
      update: async (id: string, input: any) => ok({ id, ...input }),
    },
    profile: {
      get: async () => ok({ name: 'Test User', email: 'test@test.com' }),
      update: async (input: any) => ok({ ...input }),
    },
    archetypes: { list: async () => ok([]) },
    domains: { list: async () => ok([]) },
  }

  if (options.allFeatures) {
    // Add Phase 60 methods
    baseSdk.jobDescriptions.linkResume = async (jdId: string, rId: string) =>
      ok({ job_description_id: jdId, resume_id: rId })
    baseSdk.jobDescriptions.unlinkResume = async (jdId: string, rId: string) =>
      ok({ job_description_id: jdId, resume_id: rId, unlinked: true })

    // Add Phase 62 methods
    baseSdk.jobDescriptions.extractSkills = async (jdId: string) =>
      ok({ job_description_id: jdId, skills: [{ id: 'sk1', confidence: 0.9 }] })
    baseSdk.jobDescriptions.addSkill = async (jdId: string, skId: string) =>
      ok({ job_description_id: jdId, skill_id: skId })
    baseSdk.jobDescriptions.removeSkill = async (jdId: string, skId: string) =>
      ok({ job_description_id: jdId, skill_id: skId, removed: true })

    // Add reorderEntries
    baseSdk.resumes.reorderEntries = async (rId: string, entries: any[]) =>
      ok({ resume_id: rId, entries })

    // Add review/integrity/notes resources
    baseSdk.review = {
      pending: async () => ok({ bullets: [], perspectives: [] }),
    }
    baseSdk.integrity = {
      drift: async () => ok({ stale_entries: [], stale_embeddings: [] }),
    }
    baseSdk.notes = {
      create: async (input: any) => ok({ id: 'note1', ...input }),
      addReference: async (noteId: string, ref: any) => ok({ note_id: noteId, ...ref }),
      list: async () => ({ ok: true, data: [], pagination: { offset: 0, limit: 20, total: 0 } }),
    }
  }

  return baseSdk
}

// ---------- Test helpers ----------

/** Call an MCP tool by name using the server's internal handler registry */
async function callTool(server: any, name: string, args: Record<string, unknown> = {}) {
  // McpServer stores tools in a private map. We use the public API approach:
  // server.tool() registers handlers; to call them we need to simulate a request.
  // Instead, we test at the registration level by checking tool count and
  // verifying the server was created without errors.
  // For actual E2E calls, we'd need a transport. Here we verify registration.
  return null // placeholder -- tool calling tested via integration.test.ts
}

// ---------- Tests ----------

describe('Full Resume Build Workflow (E2E)', () => {
  // These tests verify that all tools register correctly and the server
  // initializes without errors. Actual tool invocation is tested in
  // integration.test.ts via a real STDIO transport.

  test('server creates successfully with full mock SDK', () => {
    const sdk = createMockSdk({ allFeatures: true })
    const flags = detectFeatures(sdk)
    const server = createForgeServer(sdk, flags)
    expect(server).toBeDefined()
  })

  test('server creates successfully with minimal mock SDK', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    const server = createForgeServer(sdk, flags)
    expect(server).toBeDefined()
  })
})

describe('Feature-flagged tool behavior', () => {
  test('detects all features when all SDK methods present', () => {
    const sdk = createMockSdk({ allFeatures: true })
    const flags = detectFeatures(sdk)
    expect(flags.jdResumeLinkage).toBe(true)
    expect(flags.jdSkillExtraction).toBe(true)
    expect(flags.reviewAvailable).toBe(true)
    expect(flags.integrityAvailable).toBe(true)
    expect(flags.notesAvailable).toBe(true)
  })

  test('skips Phase 60 tools when SDK methods missing', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    expect(flags.jdResumeLinkage).toBe(false)
  })

  test('skips Phase 62 tools when SDK methods missing', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    expect(flags.jdSkillExtraction).toBe(false)
  })

  test('skips review when sdk.review missing', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    expect(flags.reviewAvailable).toBe(false)
  })

  test('skips integrity when sdk.integrity missing', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    expect(flags.integrityAvailable).toBe(false)
  })

  test('skips notes when sdk.notes missing', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags = detectFeatures(sdk)
    expect(flags.notesAvailable).toBe(false)
  })

  test('partial feature detection: only Phase 60 present', () => {
    const sdk = createMockSdk({ allFeatures: false })
    // Add only Phase 60 methods
    sdk.jobDescriptions.linkResume = async () => ({ ok: true, data: {} })
    sdk.jobDescriptions.unlinkResume = async () => ({ ok: true, data: {} })
    const flags = detectFeatures(sdk)
    expect(flags.jdResumeLinkage).toBe(true)
    expect(flags.jdSkillExtraction).toBe(false)
  })

  test('jdSkillExtraction requires all 3 methods', () => {
    const sdk = createMockSdk({ allFeatures: false })
    // Add only extractSkills but not addSkill/removeSkill
    sdk.jobDescriptions.extractSkills = async () => ({ ok: true, data: {} })
    const flags = detectFeatures(sdk)
    expect(flags.jdSkillExtraction).toBe(false)

    // Add all 3
    sdk.jobDescriptions.addSkill = async () => ({ ok: true, data: {} })
    sdk.jobDescriptions.removeSkill = async () => ({ ok: true, data: {} })
    const flags2 = detectFeatures(sdk)
    expect(flags2.jdSkillExtraction).toBe(true)
  })
})

describe('Contract: MCP server tool definitions', () => {
  test('all tool registrations succeed without throwing', () => {
    const sdk = createMockSdk({ allFeatures: true })
    const flags = detectFeatures(sdk)
    // This will throw if any tool registration fails (bad Zod schema, etc.)
    expect(() => createForgeServer(sdk, flags)).not.toThrow()
  })

  test('server creates with all features disabled without errors', () => {
    const sdk = createMockSdk({ allFeatures: false })
    const flags: FeatureFlags = {
      jdResumeLinkage: false,
      jdSkillExtraction: false,
      reviewAvailable: false,
      integrityAvailable: false,
      notesAvailable: false,
    }
    expect(() => createForgeServer(sdk, flags)).not.toThrow()
  })
})
