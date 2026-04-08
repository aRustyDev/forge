/**
 * Tier 3 MCP tools for bullet-level mutations (job-hunting-e35).
 *
 * 3 tools:
 *   forge_create_bullet        Create a bullet manually (starts as draft)
 *   forge_add_bullet_skill     Link a skill to a bullet (by ID or by name)
 *   forge_remove_bullet_skill  Unlink a skill from a bullet
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier3BulletTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  registerTool(
    server,
    'forge_create_bullet',
    'Create a bullet manually (no AI derivation). Starts as draft status. Optionally link technologies (skills) and sources at creation time.',
    {
      content: z.string().describe('Bullet text'),
      source_content_snapshot: z.string().optional()
        .describe('Original source text this bullet was derived from (defaults to content)'),
      metrics: z.string().nullable().optional()
        .describe('Quantitative metrics (e.g., "10x improvement", "50K users")'),
      domain: z.string().nullable().optional()
        .describe('Domain tag (e.g., "engineering", "operations")'),
      technologies: z.array(z.string()).optional()
        .describe('Skill names to auto-create and link as bullet_skills'),
      source_ids: z.array(z.object({
        id: z.string().describe('Source ID'),
        is_primary: z.boolean().optional().describe('Mark as primary source'),
      })).optional().describe('Source associations'),
    },
    async (params) => {
      const result = await sdk.bullets.create(params)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_add_bullet_skill',
    'Link a skill to a bullet. Provide either skill_id (existing) or name (create-then-link). Idempotent.',
    {
      bullet_id: z.string().describe('Bullet ID'),
      skill_id: z.string().optional().describe('Existing skill ID to link'),
      name: z.string().optional().describe('Skill name — creates the skill if it does not exist, then links'),
      category: z.string().optional()
        .describe('Category for newly created skill (language, framework, platform, tool, library, methodology, protocol, concept, soft_skill)'),
    },
    async (params) => {
      const input = params.skill_id
        ? { skill_id: params.skill_id }
        : { name: params.name!, category: params.category }
      const result = await sdk.bullets.addSkill(params.bullet_id, input)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_remove_bullet_skill',
    'Unlink a skill from a bullet. The skill itself is not deleted. Idempotent.',
    {
      bullet_id: z.string().describe('Bullet ID'),
      skill_id: z.string().describe('Skill ID to unlink'),
    },
    async (params) => {
      const result = await sdk.bullets.removeSkill(params.bullet_id, params.skill_id)
      return respond(result)
    },
  )
}
