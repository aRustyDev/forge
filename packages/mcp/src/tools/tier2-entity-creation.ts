import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2EntityCreationTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  // forge_create_source
  registerTool(
    server,
    'forge_create_source',
    'Create a new experience source (role, project, education, clearance, or general).',
    {
      title: z.string().describe('Source title'),
      description: z.string().describe('Source description'),
      source_type: z.enum(['role', 'project', 'education', 'clearance', 'general'])
        .describe('Type of experience source'),
      start_date: z.string().optional().describe('Start date (ISO 8601)'),
      end_date: z.string().optional().describe('End date (ISO 8601)'),
      notes: z.string().optional().describe('Free-text notes'),
      // Role extension fields
      organization_id: z.string().optional()
        .describe('Organization ID (for role/project/education)'),
      is_current: z.boolean().optional().describe('Currently active (for role)'),
      work_arrangement: z.string().optional()
        .describe('Work arrangement (for role)'),
      // Education extension fields
      education_type: z.enum(['degree', 'certificate', 'course', 'self_taught']).optional()
        .describe('Education type (for education)'),
      degree_level: z.string().optional().describe('Degree level (for education)'),
      field: z.string().optional().describe('Field of study (for education)'),
      // Clearance extension fields
      level: z.string().optional().describe('Clearance level (for clearance)'),
      polygraph: z.string().optional().describe('Polygraph type (for clearance)'),
    },
    async (params) => {
      // Restructure flat params into SDK nested format
      // TODO: Remove `as any` once SDK types are updated (see Phase 62 type alignment)
      const input: any = {
        title: params.title,
        description: params.description,
        source_type: params.source_type,
        start_date: params.start_date,
        end_date: params.end_date,
        notes: params.notes,
      }

      if (params.source_type === 'role') {
        input.role = {
          organization_id: params.organization_id,
          is_current: params.is_current,
          work_arrangement: params.work_arrangement,
        }
      } else if (params.source_type === 'project') {
        input.project = { organization_id: params.organization_id }
      } else if (params.source_type === 'education') {
        input.education = {
          organization_id: params.organization_id,
          education_type: params.education_type,
          degree_level: params.degree_level,
          field: params.field,
        }
      } else if (params.source_type === 'clearance') {
        input.clearance = {
          level: params.level,
          polygraph: params.polygraph,
        }
      }
      // Note: source_type 'general' silently ignores extension fields.
      // Extension fields like organization_id, is_current, etc. are accepted by Zod
      // but not forwarded to the SDK when source_type is 'general'. This is intentional
      // -- the SDK has no extension object for general sources.

      const result = await sdk.sources.create(input)
      return respond(result)
    },
  )

  // forge_create_organization
  registerTool(
    server,
    'forge_create_organization',
    'Create an organization (employer, school, etc).',
    {
      name: z.string().describe('Organization name'),
      org_type: z.enum([
        'company', 'nonprofit', 'government', 'military',
        'education', 'volunteer', 'freelance', 'other',
      ]).describe('Organization type'),
      tag: z.string().optional()
        .describe('Classification tag (e.g., "employer", "defense", "remote")'),
      industry: z.string().optional().describe('Industry sector'),
      website: z.string().optional().describe('Website URL'),
      location: z.string().optional().describe('Primary location'),
      status: z.enum([
        'backlog', 'researching', 'exciting',
        'interested', 'acceptable', 'excluded',
      ]).optional().describe('Pipeline status'),
      notes: z.string().optional().describe('Free-text notes'),
    },
    async (params) => {
      const result = await sdk.organizations.create(params)
      return respond(result)
    },
  )

  // forge_create_summary
  registerTool(
    server,
    'forge_create_summary',
    'Create a resume summary paragraph.',
    {
      title: z.string().describe('Summary title/label'),
      role: z.string().optional().describe('Target role for this summary'),
      tagline: z.string().optional().describe('One-line tagline'),
      description: z.string().optional().describe('Full summary paragraph'),
      is_template: z.boolean().optional()
        .describe('Mark as a reusable template'),
    },
    async (params) => {
      const result = await sdk.summaries.create(params)
      return respond(result)
    },
  )

  // forge_create_skill
  registerTool(
    server,
    'forge_create_skill',
    'Create a skill entry in the skills inventory.',
    {
      name: z.string().describe('Skill name (e.g., "Kubernetes", "Python")'),
      category: z.string().optional()
        .describe('Skill category (e.g., "Infrastructure", "Languages")'),
    },
    async (params) => {
      const result = await sdk.skills.create(params)
      return respond(result)
    },
  )
}
