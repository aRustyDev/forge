import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2SearchTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  registerTool(
    server,
    'forge_search_organizations',
    'Search organizations by name, type, status, or tag.',
    {
      search: z.string().optional().describe('Full-text search on name'),
      org_type: z.enum([
        'company', 'nonprofit', 'government', 'military',
        'education', 'volunteer', 'freelance', 'other',
      ]).optional().describe('Filter by organization type'),
      status: z.enum([
        'backlog', 'researching', 'exciting',
        'interested', 'acceptable', 'excluded',
      ]).optional().describe('Filter by pipeline status'),
      tag: z.string().optional()
        .describe('Filter by tag (e.g., "employer", "defense", "remote")'),
      offset: z.number().optional().describe('Pagination offset (default 0)'),
      limit: z.number().optional().describe('Page size (default 20)'),
    },
    async (params) => {
      const result = await sdk.organizations.list(params)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_search_job_descriptions',
    'Search job descriptions by status, organization, or text.',
    {
      status: z.enum([
        'interested', 'analyzing', 'applied', 'interviewing',
        'offered', 'rejected', 'withdrawn', 'closed',
      ]).optional().describe('Filter by pipeline status'),
      organization_id: z.string().optional()
        .describe('Filter by organization ID'),
      search: z.string().optional().describe('Full-text search'),
      offset: z.number().optional().describe('Pagination offset (default 0)'),
      limit: z.number().optional().describe('Page size (default 20)'),
    },
    async (params) => {
      const result = await sdk.jobDescriptions.list(params)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_search_summaries',
    'Search summaries by template flag or text content.',
    {
      is_template: z.boolean().optional()
        .describe('Filter to templates only'),
      search: z.string().optional().describe('Full-text search'),
      offset: z.number().optional().describe('Pagination offset (default 0)'),
      limit: z.number().optional().describe('Page size (default 20)'),
    },
    async (params) => {
      const result = await sdk.summaries.list(params)
      return respond(result)
    },
  )
}
