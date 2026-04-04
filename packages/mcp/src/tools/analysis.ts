import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerAnalysisTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_gap_analysis --

  registerTool(
    server,
    'forge_gap_analysis',
    'Get domain coverage gaps for a resume vs. its archetype\'s expected domains. Returns covered, missing, and thin domains with entry counts. A domain is "thin" if it has fewer than 2 approved perspectives. Use this to identify what content is needed before export.',
    {
      resume_id: z.string().uuid()
        .describe('Resume UUID to analyze'),
    },
    async (params) => {
      const result = await sdk.resumes.gaps(params.resume_id)
      return mapResult(result)
    },
  )

  // -- forge_align_resume --

  registerTool(
    server,
    'forge_align_resume',
    'Programmatic JD-to-Resume alignment using embedding similarity. Returns an AlignmentReport with per-requirement match scores, coverage summary, and unmatched entries. Requires the embedding service to have vectors for both the JD requirements and the resume\'s perspective entries.',
    {
      job_description_id: z.string().uuid()
        .describe('Job description UUID'),
      resume_id: z.string().uuid()
        .describe('Resume UUID'),
      strong_threshold: z.number().min(0).max(1).default(0.75)
        .describe('Similarity threshold for "strong" match (default 0.75)'),
      adjacent_threshold: z.number().min(0).max(1).default(0.50)
        .describe('Similarity threshold for "adjacent" match (default 0.50). Between this and strong = adjacent; below = gap.'),
    },
    async (params) => {
      // Guard: alignment resource may not exist if Phase 70 is not landed
      // TODO: Remove guard once Phase 70 lands AlignmentResource on ForgeClient
      if (!sdk.alignment) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Alignment API not available -- Phase 70 (alignment API in SDK) must be implemented first. forge_gap_analysis is available as an alternative for domain-level coverage analysis.',
          }],
          isError: true,
        }
      }
      const result = await sdk.alignment.score(
        params.job_description_id,
        params.resume_id,
        {
          strong_threshold: params.strong_threshold,
          adjacent_threshold: params.adjacent_threshold,
        },
      )
      return mapResult(result)
    },
  )

  // -- forge_match_requirements --

  registerTool(
    server,
    'forge_match_requirements',
    'Match JD requirements against the full bullet or perspective inventory, independent of any resume. Use this BEFORE creating a resume to discover which approved content best matches a JD. Returns per-requirement candidate matches ranked by embedding similarity.',
    {
      job_description_id: z.string().uuid()
        .describe('Job description UUID'),
      entity_type: z.enum(['bullet', 'perspective'])
        .describe('Search bullets or perspectives'),
      threshold: z.number().min(0).max(1).default(0.50)
        .describe('Minimum similarity threshold (default 0.50)'),
      limit: z.number().int().min(1).max(50).default(10)
        .describe('Max matches per requirement (default 10)'),
    },
    async (params) => {
      // Guard: alignment resource may not exist if Phase 70 is not landed
      // TODO: Remove guard once Phase 70 lands AlignmentResource on ForgeClient
      if (!sdk.alignment) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Alignment API not available -- Phase 70 (alignment API in SDK) must be implemented first.',
          }],
          isError: true,
        }
      }
      const result = await sdk.alignment.matchRequirements(
        params.job_description_id,
        params.entity_type,
        {
          threshold: params.threshold,
          limit: params.limit,
        },
      )
      return mapResult(result)
    },
  )
}
