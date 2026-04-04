import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2ResumeMetadataTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  // forge_update_resume_header
  registerTool(
    server,
    'forge_update_resume_header',
    'Set resume header fields (headline, contact override). Overrides profile defaults for this resume.',
    {
      resume_id: z.string().describe('Resume ID'),
      header: z.object({
        headline: z.string().optional().describe('Resume headline / professional title'),
        name: z.string().optional().describe('Name override'),
        email: z.string().optional().describe('Email override'),
        phone: z.string().optional().describe('Phone override'),
        location: z.string().optional().describe('Location override'),
        linkedin: z.string().optional().describe('LinkedIn URL override'),
        github: z.string().optional().describe('GitHub URL override'),
        website: z.string().optional().describe('Website URL override'),
      }).describe('Header fields to set'),
    },
    async (params) => {
      const result = await sdk.resumes.updateHeader(params.resume_id, params.header)
      return respond(result)
    },
  )

  // forge_set_resume_summary
  registerTool(
    server,
    'forge_set_resume_summary',
    'Link a summary to a resume. The summary appears at the top of the resume.',
    {
      resume_id: z.string().describe('Resume ID'),
      summary_id: z.string().describe('Summary ID to link'),
    },
    async (params) => {
      const result = await sdk.resumes.update(params.resume_id, {
        summary_id: params.summary_id,
      })
      return respond(result)
    },
  )

  // forge_update_profile
  registerTool(
    server,
    'forge_update_profile',
    'Update the user profile (singleton). Only provided fields are modified.',
    {
      name: z.string().optional().describe('Full name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      location: z.string().optional().describe('Location / city'),
      linkedin: z.string().optional().describe('LinkedIn URL'),
      github: z.string().optional().describe('GitHub URL'),
      website: z.string().optional().describe('Personal website URL'),
      clearance: z.string().optional().describe('Security clearance'),
    },
    async (params) => {
      const result = await sdk.profile.update(params)
      return respond(result)
    },
  )
}
