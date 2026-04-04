import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier3WorkflowTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  registerTool(
    server,
    'forge_reopen_bullet',
    'Reopen a rejected bullet for re-review (rejected -> pending_review).',
    {
      bullet_id: z.string().describe('Bullet ID to reopen'),
    },
    async (params) => {
      const result = await sdk.bullets.reopen(params.bullet_id)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_reopen_perspective',
    'Reopen a rejected perspective for re-review (rejected -> pending_review).',
    {
      perspective_id: z.string().describe('Perspective ID to reopen'),
    },
    async (params) => {
      const result = await sdk.perspectives.reopen(params.perspective_id)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_clone_summary',
    'Duplicate a summary for creating variations. Returns the new copy.',
    {
      summary_id: z.string().describe('Summary ID to clone'),
    },
    async (params) => {
      const result = await sdk.summaries.clone(params.summary_id)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_trace_chain',
    'Get full provenance chain for a perspective: perspective -> bullet -> source.',
    {
      perspective_id: z.string().describe('Perspective ID to trace'),
    },
    async (params) => {
      const result = await sdk.perspectives.get(params.perspective_id)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_save_as_template',
    'Save a resume\'s section structure as a reusable template.',
    {
      resume_id: z.string().describe('Resume ID to save as template'),
      name: z.string().describe('Template name'),
      description: z.string().optional().describe('Template description'),
    },
    async (params) => {
      const result = await sdk.resumes.saveAsTemplate(params.resume_id, {
        name: params.name,
        description: params.description,
      })
      return respond(result)
    },
  )
}
