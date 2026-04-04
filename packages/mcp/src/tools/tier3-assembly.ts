import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

// Cross-ref: see also tier3-update.ts for entry-level content mutations
// (update bullet/perspective/entry/source/summary)

export function registerTier3AssemblyTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
  flags: FeatureFlags,
): void {
  registerTool(
    server,
    'forge_remove_resume_entry',
    'Remove an entry from a resume section. The underlying perspective is not deleted.',
    {
      resume_id: z.string().describe('Resume ID'),
      entry_id: z.string().describe('Entry ID to remove'),
    },
    async (params) => {
      const result = await sdk.resumes.removeEntry(
        params.resume_id,
        params.entry_id,
      )
      return respond(result)
    },
  )

  // Feature-flagged: reorderEntries not in SDK yet
  if (flags.reorderEntries) {
    registerTool(
      server,
      'forge_reorder_resume_entries',
      'Reorder entries within a resume by specifying new positions.',
      {
        resume_id: z.string().describe('Resume ID'),
        entries: z.array(z.object({
          id: z.string().describe('Entry ID'),
          position: z.number().describe('New position (0-based)'),
        })).describe('Array of entry ID + position pairs'),
      },
      async (params) => {
        // TODO: Remove `as any` once SDK exposes reorderEntries (see Phase 62)
        const result = await (sdk.resumes as any).reorderEntries(
          params.resume_id,
          params.entries,
        )
        return respond(result)
      },
    )
  }

  registerTool(
    server,
    'forge_add_resume_skill',
    'Add a skill to a resume section (skills-type sections only).',
    {
      resume_id: z.string().describe('Resume ID'),
      section_id: z.string().describe('Section ID (must be skills-type)'),
      skill_id: z.string().describe('Skill ID to add'),
    },
    async (params) => {
      const result = await sdk.resumes.addSkill(
        params.resume_id,
        params.section_id,
        params.skill_id,
      )
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_remove_resume_skill',
    'Remove a skill from a resume section.',
    {
      resume_id: z.string().describe('Resume ID'),
      section_id: z.string().describe('Section ID'),
      skill_id: z.string().describe('Skill ID to remove'),
    },
    async (params) => {
      const result = await sdk.resumes.removeSkill(
        params.resume_id,
        params.section_id,
        params.skill_id,
      )
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_reorder_resume_skills',
    'Reorder skills within a resume section by specifying new positions.',
    {
      resume_id: z.string().describe('Resume ID'),
      section_id: z.string().describe('Section ID'),
      skills: z.array(z.object({
        skill_id: z.string().describe('Skill ID'),
        position: z.number().describe('New position (0-based)'),
      })).describe('Array of skill ID + position pairs'),
    },
    async (params) => {
      const result = await sdk.resumes.reorderSkills(
        params.resume_id,
        params.section_id,
        params.skills,
      )
      return respond(result)
    },
  )
}
