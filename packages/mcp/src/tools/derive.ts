import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerDerivationTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_prepare_derivation --

  registerTool(
    server,
    'forge_prepare_derivation',
    'Prepare a derivation for a source or bullet entity. Returns a derivation_id and a prompt to execute client-side. Execute the returned prompt, then call forge_commit_derivation with the derivation_id and the AI-generated results.',
    {
      entity_type: z.enum(['source', 'bullet'])
        .describe('Entity type to derive from: "source" produces bullets, "bullet" produces a perspective'),
      entity_id: z.string().uuid()
        .describe('UUID of the source or bullet to derive from'),
      archetype: z.string().optional()
        .describe('Target archetype slug (e.g., "platform-engineer"). Required for bullet→perspective.'),
      domain: z.string().optional()
        .describe('Target domain slug (e.g., "infrastructure"). Required for bullet→perspective.'),
      framing: z.string().optional()
        .describe('Perspective framing: accomplishment, responsibility, or context. Required for bullet→perspective.'),
    },
    async (params) => {
      const derivParams = (params.archetype || params.domain || params.framing)
        ? { archetype: params.archetype!, domain: params.domain!, framing: params.framing! }
        : undefined
      const result = await sdk.derivations.prepare({
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        client_id: 'mcp',
        params: derivParams,
      })
      return mapResult(result)
    },
  )

  // -- forge_commit_derivation --

  registerTool(
    server,
    'forge_commit_derivation',
    'Commit the results of a client-side derivation. After executing the prompt from forge_prepare_derivation, call this with the derivation_id and either: bullets (array of strings) for source→bullets, or content + reasoning for bullet→perspective.',
    {
      derivation_id: z.string()
        .describe('Derivation ID returned by forge_prepare_derivation'),
      bullets: z.array(z.string()).optional()
        .describe('Generated bullet strings (for source→bullets derivation)'),
      content: z.string().optional()
        .describe('Generated perspective content (for bullet→perspective derivation)'),
      reasoning: z.string().optional()
        .describe('Reasoning behind the perspective (for bullet→perspective derivation)'),
    },
    async (params) => {
      if (params.bullets !== undefined) {
        const result = await sdk.derivations.commitBullets(params.derivation_id, {
          bullets: params.bullets,
        })
        return mapResult(result)
      }
      if (params.content !== undefined && params.reasoning !== undefined) {
        const result = await sdk.derivations.commitPerspective(params.derivation_id, {
          content: params.content,
          reasoning: params.reasoning,
        })
        return mapResult(result)
      }
      return {
        content: [{ type: 'text' as const, text: 'Error: must provide either bullets (array) or both content and reasoning' }],
        isError: true,
      }
    },
  )
}
