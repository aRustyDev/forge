import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier3JDUpdateTool(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  registerTool(
    server,
    'forge_update_job_description',
    'Update a job description\'s status, text, or notes.',
    {
      job_description_id: z.string().describe('Job description ID'),
      status: z.enum([
        'interested', 'analyzing', 'applied', 'interviewing',
        'offered', 'rejected', 'withdrawn', 'closed',
      ]).optional().describe('Pipeline status'),
      raw_text: z.string().optional().describe('Updated job description text'),
    },
    async (params) => {
      const { job_description_id, ...input } = params
      const result = await sdk.jobDescriptions.update(job_description_id, input)
      return respond(result)
    },
  )
}
