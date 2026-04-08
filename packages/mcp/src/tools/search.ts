import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapPaginatedResult } from '../utils/error-mapper'

export function registerSearchTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_search_sources --

  registerTool(
    server,
    'forge_search_sources',
    'Search experience sources by employer, type, date range, status. Sources with status "deriving" are locked by an in-progress derivation -- do not call forge_prepare_derivation on them. Poll forge_search_sources with status filter to check if derivation has completed, or use forge_review_pending to check the review queue.',
    {
      source_type: z.enum(['role', 'project', 'education', 'clearance', 'general']).optional()
        .describe('Filter by source type'),
      status: z.enum(['draft', 'approved', 'deriving']).optional()
        .describe('Filter by source status'),
      search: z.string().optional()
        .describe('Full-text search on title + description'),
      offset: z.number().int().min(0).default(0)
        .describe('Pagination offset (default 0)'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Results per page (default 20, max 100)'),
    },
    async (params) => {
      const result = await sdk.sources.list(params)
      return mapPaginatedResult(result)
    },
  )

  // -- forge_search_bullets --

  registerTool(
    server,
    'forge_search_bullets',
    'Search bullet inventory by domain, status, source, content. Each bullet includes sources[] and technologies[] (a read-only projection of linked skill names since Phase 89 — use bullet-skills endpoints to mutate).',
    {
      domain: z.string().optional()
        .describe('Filter by domain slug (e.g., "infrastructure", "security")'),
      status: z.enum(['draft', 'pending_review', 'approved', 'rejected']).optional()
        .describe('Filter by bullet status'),
      source_id: z.string().uuid().optional()
        .describe('Filter by source ID'),
      search: z.string().optional()
        .describe('Full-text search on bullet content'),
      offset: z.number().int().min(0).default(0)
        .describe('Pagination offset (default 0)'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Results per page (default 20, max 100)'),
    },
    async (params) => {
      const result = await sdk.bullets.list(params)
      return mapPaginatedResult(result)
    },
  )

  // -- forge_search_perspectives --

  registerTool(
    server,
    'forge_search_perspectives',
    'Search perspectives by archetype, domain, framing, status. Perspectives are the final resume-ready statements derived from bullets.',
    {
      archetype: z.string().optional()
        .describe('Filter by archetype slug (e.g., "platform-engineer")'),
      domain: z.string().optional()
        .describe('Filter by domain slug'),
      framing: z.enum(['accomplishment', 'responsibility', 'context']).optional()
        .describe('Filter by perspective framing type'),
      status: z.enum(['draft', 'pending_review', 'approved', 'rejected']).optional()
        .describe('Filter by perspective status'),
      search: z.string().optional()
        .describe('Full-text search on perspective content'),
      offset: z.number().int().min(0).default(0)
        .describe('Pagination offset (default 0)'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Results per page (default 20, max 100)'),
    },
    async (params) => {
      const result = await sdk.perspectives.list(params)
      return mapPaginatedResult(result)
    },
  )
}
