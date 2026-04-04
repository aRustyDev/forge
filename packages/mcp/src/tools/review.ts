import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerReviewTools(server: McpServer, sdk: ForgeClient): void {

  // -- forge_approve_bullet --

  registerTool(
    server,
    'forge_approve_bullet',
    'Approve a bullet (pending_review -> approved). Only pending_review bullets can be approved.',
    {
      bullet_id: z.string().uuid()
        .describe('Bullet UUID to approve'),
    },
    async (params) => {
      const result = await sdk.bullets.approve(params.bullet_id)
      return mapResult(result)
    },
  )

  // -- forge_reject_bullet --

  registerTool(
    server,
    'forge_reject_bullet',
    'Reject a bullet with a reason (pending_review -> rejected). The rejection reason is stored for audit and improvement.',
    {
      bullet_id: z.string().uuid()
        .describe('Bullet UUID to reject'),
      rejection_reason: z.string().min(1)
        .describe('Why this bullet was rejected (required, non-empty)'),
    },
    async (params) => {
      const result = await sdk.bullets.reject(params.bullet_id, {
        rejection_reason: params.rejection_reason,
      })
      return mapResult(result)
    },
  )

  // -- forge_approve_perspective --

  registerTool(
    server,
    'forge_approve_perspective',
    'Approve a perspective (pending_review -> approved). Only approved perspectives can be added to resumes.',
    {
      perspective_id: z.string().uuid()
        .describe('Perspective UUID to approve'),
    },
    async (params) => {
      const result = await sdk.perspectives.approve(params.perspective_id)
      return mapResult(result)
    },
  )

  // -- forge_reject_perspective --

  registerTool(
    server,
    'forge_reject_perspective',
    'Reject a perspective with a reason (pending_review -> rejected).',
    {
      perspective_id: z.string().uuid()
        .describe('Perspective UUID to reject'),
      rejection_reason: z.string().min(1)
        .describe('Why this perspective was rejected (required, non-empty)'),
    },
    async (params) => {
      const result = await sdk.perspectives.reject(params.perspective_id, {
        rejection_reason: params.rejection_reason,
      })
      return mapResult(result)
    },
  )
}
