import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerAssemblyTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_create_resume --

  registerTool(
    server,
    'forge_create_resume',
    'Create a new resume, optionally from a template. If template_id is provided, the resume is created with predefined sections from the template. Otherwise, a blank resume is created and sections must be added manually with forge_create_resume_section.',
    {
      name: z.string().min(1)
        .describe('Resume name (e.g., "Platform Engineer - Acme Corp")'),
      target_role: z.string().min(1)
        .describe('Target job role (e.g., "Senior Platform Engineer")'),
      target_employer: z.string().min(1)
        .describe('Target employer name'),
      archetype: z.string().min(1).regex(/^[a-z0-9-]+$/)
        .describe('Archetype slug (e.g., "platform-engineer"). Must be lowercase alphanumeric with hyphens. Full validation happens server-side. Use forge://archetypes resource to see available archetypes.'),
      template_id: z.string().uuid().optional()
        .describe('Optional template UUID. Use forge://templates resource to see available templates.'),
    },
    async (params) => {
      // Template branching: use the appropriate SDK call path
      if (params.template_id) {
        const result = await sdk.templates.createResumeFromTemplate({
          template_id: params.template_id,
          name: params.name,
          target_role: params.target_role,
          target_employer: params.target_employer,
          archetype: params.archetype,
        })
        return mapResult(result)
      } else {
        const result = await sdk.resumes.create({
          name: params.name,
          target_role: params.target_role,
          target_employer: params.target_employer,
          archetype: params.archetype,
        })
        return mapResult(result)
      }
    },
  )

  // -- forge_add_resume_entry --

  registerTool(
    server,
    'forge_add_resume_entry',
    'Add an entry to a resume section. Provide EITHER perspective_id (for experience/project bullets — must be approved) OR source_id (for education entries, clearances, and other source-only records). Get section IDs from the forge://resume/{id} resource.',
    {
      resume_id: z.string().uuid()
        .describe('Resume UUID'),
      section_id: z.string().uuid()
        .describe('Section UUID (FK to resume_sections). Get from forge://resume/{id} resource.'),
      perspective_id: z.string().uuid().optional()
        .describe('Perspective UUID (must have status "approved"). Use for experience/project entries.'),
      source_id: z.string().uuid().optional()
        .describe('Source UUID. Use for education, clearance, and other entries without perspectives.'),
      position: z.number().int().min(0).optional()
        .describe('Position within the section (0-indexed). Omit to append at end.'),
    },
    async (params) => {
      if (!params.perspective_id && !params.source_id) {
        return {
          content: [{ type: 'text' as const, text: 'Validation failed: provide either perspective_id or source_id' }],
          isError: true,
        }
      }
      const result = await sdk.resumes.addEntry(params.resume_id, {
        section_id: params.section_id,
        perspective_id: params.perspective_id,
        source_id: params.source_id,
        position: params.position,
      })
      return mapResult(result)
    },
  )

  // -- forge_create_resume_section --

  registerTool(
    server,
    'forge_create_resume_section',
    'Create a section in a resume (e.g., "Professional Experience", "Technical Skills"). Each section has an entry_type that determines what kind of content it holds.',
    {
      resume_id: z.string().uuid()
        .describe('Resume UUID'),
      title: z.string().min(1)
        .describe('Section title (e.g., "Professional Experience", "Technical Skills", "Education")'),
      entry_type: z.enum([
        'experience',
        'skills',
        'education',
        'projects',
        'certifications',
        'presentations',
        'awards',
        'freeform',
      ])
        .describe('Section content type. "freeform" is for custom sections that do not fit standard categories.'),
      position: z.number().int().min(0).optional()
        .describe('Position in section ordering (0-indexed). Omit to append at end.'),
    },
    async (params) => {
      const result = await sdk.resumes.createSection(params.resume_id, {
        title: params.title,
        entry_type: params.entry_type,
        position: params.position,
      })
      return mapResult(result)
    },
  )
}
