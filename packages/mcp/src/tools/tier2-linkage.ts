import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2JDLinkageTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
  flags: FeatureFlags,
): void {
  if (!flags.jdResumeLinkage) return

  registerTool(
    server,
    'forge_link_resume_to_jd',
    'Link a resume to a job description. Tracks which resume targets which job.',
    {
      job_description_id: z.string().describe('Job description ID'),
      resume_id: z.string().describe('Resume ID to link'),
    },
    async (params) => {
      // TODO: Remove `as any` once Phase 60 SDK types are available (see Phase 60)
      const result = await (sdk.jobDescriptions as any).linkResume(
        params.job_description_id,
        params.resume_id,
      )
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_unlink_resume_from_jd',
    'Remove the link between a resume and a job description.',
    {
      job_description_id: z.string().describe('Job description ID'),
      resume_id: z.string().describe('Resume ID to unlink'),
    },
    async (params) => {
      // TODO: Remove `as any` once Phase 60 SDK types are available (see Phase 60)
      const result = await (sdk.jobDescriptions as any).unlinkResume(
        params.job_description_id,
        params.resume_id,
      )
      return respond(result)
    },
  )
}
