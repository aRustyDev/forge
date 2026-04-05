import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

// Cross-ref: see also tier3-assembly.ts for resume-level structural mutations
// (add/remove/reorder entries and skills)

export function registerTier3UpdateTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  registerTool(
    server,
    'forge_update_bullet',
    'Edit bullet content, metrics, domain, or notes. To change the skills/technologies linked to a bullet, use the bullet-skills endpoints (add/remove skill) rather than passing them here — Phase 89 absorbed technologies into the unified skills taxonomy.',
    {
      bullet_id: z.string().describe('Bullet ID'),
      content: z.string().optional().describe('Updated bullet text'),
      metrics: z.string().nullable().optional()
        .describe('Quantifiable metrics (set null to clear)'),
      domain: z.string().nullable().optional()
        .describe('Domain slug (set null to clear)'),
      notes: z.string().nullable().optional()
        .describe('Notes (set null to clear)'),
    },
    async (params) => {
      const { bullet_id, ...input } = params
      const result = await sdk.bullets.update(bullet_id, input)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_perspective',
    'Edit perspective content, domain, framing, or notes.',
    {
      perspective_id: z.string().describe('Perspective ID'),
      content: z.string().optional().describe('Updated perspective text'),
      domain: z.string().nullable().optional()
        .describe('Domain slug (set null to clear)'),
      framing: z.enum(['accomplishment', 'responsibility', 'context']).optional()
        .describe('Perspective framing type'),
      notes: z.string().nullable().optional()
        .describe('Notes (set null to clear)'),
    },
    async (params) => {
      const { perspective_id, ...input } = params
      const result = await sdk.perspectives.update(perspective_id, input)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_resume_entry',
    'Edit a resume entry (copy-on-write). Set content to override perspective text for this resume; set content to null to reset to original.',
    {
      resume_id: z.string().describe('Resume ID'),
      entry_id: z.string().describe('Entry ID'),
      content: z.string().nullable().optional()
        .describe('Content override (null resets to perspective reference)'),
      notes: z.string().nullable().optional()
        .describe('Entry-level notes (set null to clear)'),
    },
    async (params) => {
      const { resume_id, entry_id, ...input } = params
      // NOTE: If SDK UpdateResumeEntry type does not accept `content: null`,
      // cast may be needed. Verify SDK type at implementation time.
      // TODO: Remove `as any` if needed once SDK types confirm nullable content (see Phase 62)
      const result = await sdk.resumes.updateEntry(resume_id, entry_id, input)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_source',
    'Update a source\'s content or metadata.',
    {
      source_id: z.string().describe('Source ID'),
      title: z.string().optional().describe('Updated title'),
      description: z.string().optional().describe('Updated description'),
      notes: z.string().nullable().optional()
        .describe('Notes (set null to clear)'),
      start_date: z.string().nullable().optional()
        .describe('Start date (set null to clear)'),
      end_date: z.string().nullable().optional()
        .describe('End date (set null to clear)'),
    },
    async (params) => {
      const { source_id, ...input } = params
      const result = await sdk.sources.update(source_id, input)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_summary',
    'Edit summary content or metadata.',
    {
      summary_id: z.string().describe('Summary ID'),
      title: z.string().optional().describe('Updated title'),
      role: z.string().nullable().optional()
        .describe('Target role (set null to clear)'),
      tagline: z.string().nullable().optional()
        .describe('One-line tagline (set null to clear)'),
      description: z.string().nullable().optional()
        .describe('Full summary paragraph (set null to clear)'),
      is_template: z.boolean().optional()
        .describe('Mark as reusable template'),
    },
    async (params) => {
      const { summary_id, ...input } = params
      const result = await sdk.summaries.update(summary_id, input)
      return respond(result)
    },
  )
}
