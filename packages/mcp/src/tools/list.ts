import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapPaginatedResult } from '../utils/error-mapper'

export function registerListTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_list_resumes --

  registerTool(
    server,
    'forge_list_resumes',
    'List all resumes with pagination. Returns resume summaries (id, name, target_role, target_employer, archetype, created_at, updated_at). Use forge://resume/{id} resource to get full resume with sections and entries.',
    {
      offset: z.number().int().min(0).default(0)
        .describe('Pagination offset (default 0)'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Results per page (default 20, max 100)'),
    },
    async (params) => {
      const result = await sdk.resumes.list(params)
      return mapPaginatedResult(result)
    },
  )
}
