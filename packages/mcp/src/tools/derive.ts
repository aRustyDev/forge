import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerDeriveTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_derive_bullets --

  registerTool(
    server,
    'forge_derive_bullets',
    'Trigger AI bullet derivation from a source. Returns generated bullets in pending_review status. The source must be in "approved" or "draft" status. If the source is "deriving", returns a CONFLICT error -- wait and retry. This calls Forge\'s AI module (not the MCP client). This call may take up to 60 seconds as it invokes the AI module.',
    {
      source_id: z.string().uuid()
        .describe('Source UUID to derive bullets from'),
    },
    async (params) => {
      const result = await sdk.sources.deriveBullets(params.source_id)
      return mapResult(result)
    },
  )

  // -- forge_derive_perspective --

  registerTool(
    server,
    'forge_derive_perspective',
    'Trigger AI perspective derivation from an approved bullet. The bullet must be in "approved" status. Only approved bullets can derive perspectives. Returns a single perspective in pending_review status. This call may take up to 60 seconds as it invokes the AI module.',
    {
      bullet_id: z.string().uuid()
        .describe('Bullet UUID to derive perspective from (must be approved)'),
      archetype: z.string()
        .describe('Target archetype slug (e.g., "platform-engineer")'),
      domain: z.string()
        .describe('Target domain slug (e.g., "infrastructure")'),
      framing: z.enum(['accomplishment', 'responsibility', 'context'])
        .describe('Perspective framing: accomplishment (what you achieved), responsibility (what you owned), or context (background/setup)'),
    },
    async (params) => {
      const result = await sdk.bullets.derivePerspectives(params.bullet_id, {
        archetype: params.archetype,
        domain: params.domain,
        framing: params.framing,
      })
      return mapResult(result)
    },
  )
}
