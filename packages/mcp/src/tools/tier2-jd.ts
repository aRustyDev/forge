import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'
import { parseJobDescription } from '@forge/core/src/parser'

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
    },
    async (params) => {
      // M5a: Run parser on raw_text to auto-populate structured fields
      const parsed = parseJobDescription(params.raw_text)

      const result = await sdk.jobDescriptions.create({
        title: params.title,
        raw_text: params.raw_text,
        organization_id: params.organization_id,
        url: params.url,
        status: params.status,
        salary_range: params.salary_range,
        location: params.location,
        // Parser-derived fields
        salary_min: parsed.salary?.min != null ? Math.round(parsed.salary.min) : undefined,
        salary_max: parsed.salary?.max != null ? Math.round(parsed.salary.max) : undefined,
        salary_period: parsed.salary?.period,
        work_posture: parsed.workPosture ?? undefined,
        parsed_locations: parsed.locations.length > 0 ? JSON.stringify(parsed.locations) : undefined,
        parsed_sections: JSON.stringify(parsed.sections),
      })
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

  // forge_extract_jd_skills -- always available (client-side AI, no feature flag needed)
  registerTool(
    server,
    'forge_extract_jd_skills',
    'Returns JD text, existing skill inventory, and a prompt template for client-side skill extraction. Execute the prompt template, then call forge_tag_jd_skill for each accepted skill. The existing_skills list helps avoid creating duplicate skills.',
    {
      job_description_id: z.string().describe('Job description ID'),
    },
    async (params) => {
      const result = await sdk.jobDescriptions.extractSkills(
        params.job_description_id,
      )
      return respond(result)
    },
  )

  // Feature-flagged: Phase 62
  if (flags.jdSkillExtraction) {
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

  // forge_jd_lookup_by_url -- check if a JD already exists by URL
  registerTool(
    server,
    'forge_jd_lookup_by_url',
    'Check if a job description already exists by URL. Returns the JD if found, NOT_FOUND otherwise. Use before ingesting to prevent duplicates.',
    {
      url: z.string().describe('Job posting URL to look up'),
    },
    async (params) => {
      const result = await sdk.jobDescriptions.lookupByUrl(params.url)
      return respond(result)
    },
  )
}
