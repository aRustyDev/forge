import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerGetTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_get_source --

  registerTool(
    server,
    'forge_get_source',
    'Get a single source by ID with full extension data (role/project/education/clearance fields) and associated bullets.',
    {
      source_id: z.string().uuid()
        .describe('Source UUID'),
    },
    async (params) => {
      const result = await sdk.sources.get(params.source_id)
      return mapResult(result)
    },
  )

  // -- forge_get_bullet --

  registerTool(
    server,
    'forge_get_bullet',
    'Get a single bullet by ID with full relations (sources[], technologies[] — a read-only projection of linked skill names since Phase 89).',
    {
      bullet_id: z.string().uuid()
        .describe('Bullet UUID'),
    },
    async (params) => {
      const result = await sdk.bullets.get(params.bullet_id)
      return mapResult(result)
    },
  )

  // -- forge_get_perspective --

  registerTool(
    server,
    'forge_get_perspective',
    'Get a single perspective by ID with full provenance chain (perspective -> bullet -> source).',
    {
      perspective_id: z.string().uuid()
        .describe('Perspective UUID'),
    },
    async (params) => {
      const result = await sdk.perspectives.get(params.perspective_id)
      return mapResult(result)
    },
  )
}
