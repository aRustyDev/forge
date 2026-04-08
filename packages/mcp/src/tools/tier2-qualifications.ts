/**
 * Tier 2 MCP tools for the Qualifications entities (Phase 88 T88.3).
 *
 * 8 tools:
 *   forge_search_credentials     List/filter credentials by type
 *   forge_create_credential      Create a credential with type-specific details
 *   forge_update_credential      Update credential fields
 *   forge_search_certifications  List certifications with skills
 *   forge_create_certification   Create a certification
 *   forge_update_certification   Update certification fields
 *   forge_add_certification_skill    Link a skill to a certification
 *   forge_remove_certification_skill Unlink a skill from a certification
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2QualificationsTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
): void {
  // ── Credentials ────────────────────────────────────────────────

  registerTool(
    server,
    'forge_search_credentials',
    'List all credentials (clearances, licenses, admissions). Optionally filter by type.',
    {
      type: z.enum(['clearance', 'drivers_license', 'bar_admission', 'medical_license']).optional()
        .describe('Filter by credential type'),
    },
    async (params) => {
      const result = params.type
        ? await sdk.credentials.list({ type: params.type })
        : await sdk.credentials.list()
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_create_credential',
    'Create a credential (clearance, driver\'s license, bar admission, or medical license) with type-specific details JSON.',
    {
      credential_type: z.enum(['clearance', 'drivers_license', 'bar_admission', 'medical_license'])
        .describe('Type of credential'),
      label: z.string().describe('Human-readable label (e.g., "Top Secret / SCI")'),
      status: z.enum(['active', 'inactive', 'expired']).optional()
        .describe('Status (default: active)'),
      organization_id: z.string().optional()
        .describe('Sponsor/issuing organization ID'),
      details: z.record(z.string(), z.unknown())
        .describe('Type-specific details JSON. Clearance: {level, polygraph?, clearance_type, access_programs?}. License: {class, state, endorsements?}. Bar: {jurisdiction, bar_number?}. Medical: {license_type, state, license_number?}.'),
      issued_date: z.string().optional().describe('Issue date (ISO 8601)'),
      expiry_date: z.string().optional().describe('Expiry date (ISO 8601)'),
    },
    async (params) => {
      const result = await sdk.credentials.create(params as any)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_credential',
    'Update a credential\'s label, status, organization, dates, or type-specific details (partial merge).',
    {
      credential_id: z.string().describe('Credential ID'),
      label: z.string().optional().describe('Updated label'),
      status: z.enum(['active', 'inactive', 'expired']).optional()
        .describe('Updated status'),
      organization_id: z.string().nullable().optional()
        .describe('Updated sponsor org (null to clear)'),
      details: z.record(z.string(), z.unknown()).optional()
        .describe('Partial details update (merged with existing)'),
      issued_date: z.string().nullable().optional()
        .describe('Updated issue date (null to clear)'),
      expiry_date: z.string().nullable().optional()
        .describe('Updated expiry date (null to clear)'),
    },
    async (params) => {
      const { credential_id, ...input } = params
      const result = await sdk.credentials.update(credential_id, input as any)
      return respond(result)
    },
  )

  // ── Certifications ─────────────────────────────────────────────

  registerTool(
    server,
    'forge_search_certifications',
    'List all certifications with their linked skills populated.',
    {},
    async () => {
      const result = await sdk.certifications.list()
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_create_certification',
    'Create a certification (e.g., AWS SA Pro, CISSP, PMP).',
    {
      name: z.string().describe('Certification name'),
      issuer: z.string().optional().describe('Issuing body (e.g., "ISC2", "Amazon Web Services")'),
      date_earned: z.string().optional().describe('Date earned (ISO 8601)'),
      expiry_date: z.string().optional().describe('Expiry date (ISO 8601)'),
      credential_id: z.string().optional().describe('Issuer credential ID string'),
      credential_url: z.string().optional().describe('Verification URL'),
      education_source_id: z.string().optional()
        .describe('Link to an education-type source (optional)'),
    },
    async (params) => {
      const result = await sdk.certifications.create(params)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_update_certification',
    'Update a certification\'s name, issuer, dates, or links.',
    {
      certification_id: z.string().describe('Certification ID'),
      name: z.string().optional().describe('Updated name'),
      issuer: z.string().nullable().optional().describe('Updated issuer (null to clear)'),
      date_earned: z.string().nullable().optional().describe('Updated date earned'),
      expiry_date: z.string().nullable().optional().describe('Updated expiry date'),
      credential_id: z.string().nullable().optional().describe('Updated credential ID'),
      credential_url: z.string().nullable().optional().describe('Updated verification URL'),
      education_source_id: z.string().nullable().optional()
        .describe('Updated education source link (null to clear)'),
    },
    async (params) => {
      const { certification_id, ...input } = params
      const result = await sdk.certifications.update(certification_id, input as any)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_add_certification_skill',
    'Link a skill to a certification. Idempotent — re-linking returns the same state.',
    {
      certification_id: z.string().describe('Certification ID'),
      skill_id: z.string().describe('Skill ID to link'),
    },
    async (params) => {
      const result = await sdk.certifications.addSkill(params.certification_id, params.skill_id)
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_remove_certification_skill',
    'Unlink a skill from a certification. Idempotent — removing a non-existent link is a no-op.',
    {
      certification_id: z.string().describe('Certification ID'),
      skill_id: z.string().describe('Skill ID to unlink'),
    },
    async (params) => {
      const result = await sdk.certifications.removeSkill(params.certification_id, params.skill_id)
      return respond(result)
    },
  )
}
