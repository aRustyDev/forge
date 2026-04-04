import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2JDTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
  flags: FeatureFlags,
): void {
  // forge_ingest_job_description -- always available
  registerTool(
    server,
    'forge_ingest_job_description',
    'Store a job description. Triggers requirement parsing and embedding if available.',
    {
      title: z.string().describe('Job title'),
      raw_text: z.string().describe('Full job description text'),
      organization_id: z.string().optional().describe('Organization ID'),
      url: z.string().optional().describe('Original posting URL'),
      status: z.enum([
        'interested', 'analyzing', 'applied', 'interviewing',
        'offered', 'rejected', 'withdrawn', 'closed',
      ]).optional().describe('Application pipeline status (default: interested)'),
      salary_range: z.string().optional().describe('Salary range'),
      location: z.string().optional().describe('Job location'),
      notes: z.string().optional().describe('Free-text notes'),
    },
    async (params) => {
      const result = await sdk.jobDescriptions.create(params)
      if (!result.ok) {
        return respond(result)
      }
      // Ensure embedding_status is always present in response (null if absent)
      const data = {
        ...result.data,
        embedding_status: (result.data as any).embedding_status ?? null,
      }
      return respond({ ok: true, data })
    },
  )

  // Feature-flagged: Phase 62
  if (flags.jdSkillExtraction) {
    registerTool(
      server,
      'forge_extract_jd_skills',
      'Trigger AI-powered skill extraction from a job description. Returns suggested skills with confidence scores.',
      {
        job_description_id: z.string().describe('Job description ID'),
      },
      async (params) => {
        // TODO: Remove `as any` once Phase 62 SDK types are available (see Phase 62)
        const result = await (sdk.jobDescriptions as any).extractSkills(
          params.job_description_id,
        )
        return respond(result)
      },
    )

    registerTool(
      server,
      'forge_tag_jd_skill',
      'Associate a skill with a job description (confirm an extracted skill).',
      {
        job_description_id: z.string().describe('Job description ID'),
        skill_id: z.string().describe('Skill ID to associate'),
      },
      async (params) => {
        // TODO: Remove `as any` once Phase 62 SDK types are available (see Phase 62)
        const result = await (sdk.jobDescriptions as any).addSkill(
          params.job_description_id,
          params.skill_id,
        )
        return respond(result)
      },
    )

    registerTool(
      server,
      'forge_untag_jd_skill',
      'Remove a skill association from a job description.',
      {
        job_description_id: z.string().describe('Job description ID'),
        skill_id: z.string().describe('Skill ID to remove'),
      },
      async (params) => {
        // TODO: Remove `as any` once Phase 62 SDK types are available (see Phase 62)
        const result = await (sdk.jobDescriptions as any).removeSkill(
          params.job_description_id,
          params.skill_id,
        )
        return respond(result)
      },
    )
  }
}
