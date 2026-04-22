import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

// Cross-ref: see also tier3-update.ts for entry-level content mutations
// (update bullet/perspective/entry/source/summary)

export function registerTier3AssemblyTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
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

  registerTool(
    server,
    'forge_reorder_resume_entries',
    'Reorder entries (bullets) within a resume section by specifying new positions. Use this to reorder bullets within an experience subheading or any other section.',
    {
      resume_id: z.string().describe('Resume ID'),
      entries: z.array(z.object({
        id: z.string().describe('Entry ID'),
        section_id: z.string().describe('Section ID the entry belongs to'),
        position: z.number().describe('New position (0-based)'),
      })).describe('Array of entry ID + section_id + position tuples'),
    },
    async (params) => {
      const result = await sdk.resumes.reorderEntries(
        params.resume_id,
        params.entries,
      )
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_delete_resume_section',
    'Delete a resume section and all its entries. Cascade-deletes entries and skills in the section. Use forge://resume/{id} resource to see current sections before deleting.',
    {
      resume_id: z.string().uuid().describe('Resume UUID'),
      section_id: z.string().uuid().describe('Section UUID to delete'),
    },
    async (params) => {
      const result = await sdk.resumes.deleteSection(
        params.resume_id,
        params.section_id,
      )
      return respond(result)
    },
  )

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
