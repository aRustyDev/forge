import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'
import { truncateResponse } from '../utils/truncation'

export function registerTier3NoteTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
  flags: FeatureFlags,
): void {
  if (!flags.notesAvailable) return

  // Known deviation from spec: Note creation is NOT atomic.
  // The SDK CreateNote type does not include references[].
  // This handler creates the note first, then calls addReference() for each reference.
  // If any reference fails, the note still exists but the response includes _warnings.
  // Follow-up: file SDK issue to support references[] in CreateNote for atomic creation.
  registerTool(
    server,
    'forge_create_note',
    'Create a note with optional entity references. References are added after creation (not atomic -- see known deviations).',
    {
      title: z.string().optional().describe('Note title'),
      content: z.string().describe('Note content'),
      references: z.array(z.object({
        entity_type: z.enum([
          'source', 'bullet', 'perspective', 'resume_entry',
          'resume', 'skill', 'organization', 'job_description',
          'contact', 'credential', 'certification',
        ]).describe('Entity type'),
        entity_id: z.string().describe('Entity ID'),
      })).optional().describe('Entities to reference from this note'),
    },
    async (params) => {
      // Step 1: Create the note
      const noteResult = await (sdk as any).notes.create({
        title: params.title,
        content: params.content,
      })

      if (!noteResult.ok) {
        return respond(noteResult)
      }

      // Step 2: Attach references (best-effort)
      const warnings: string[] = []
      if (params.references?.length) {
        for (const ref of params.references) {
          try {
            const refResult = await (sdk as any).notes.addReference(noteResult.data.id, {
              entity_type: ref.entity_type,
              entity_id: ref.entity_id,
            })
            if (!refResult.ok) {
              warnings.push(
                `Failed to add reference ${ref.entity_type}:${ref.entity_id}: ${refResult.error.message}`,
              )
            }
          } catch (err) {
            warnings.push(
              `Failed to add reference ${ref.entity_type}:${ref.entity_id}: ${String(err)}`,
            )
          }
        }
      }

      // Step 3: Return note with warnings if any, applying truncation
      const data = warnings.length > 0
        ? { ...noteResult.data, _warnings: warnings }
        : noteResult.data

      const { text } = truncateResponse(data)
      return {
        content: [{
          type: 'text' as const,
          text,
        }],
      }
    },
  )

  registerTool(
    server,
    'forge_search_notes',
    'Search notes by content or title.',
    {
      search: z.string().optional().describe('Full-text search on title + content'),
      offset: z.coerce.number().optional().describe('Pagination offset (default 0)'),
      limit: z.coerce.number().optional().describe('Page size (default 20)'),
    },
    async (params) => {
      const result = await (sdk as any).notes.list(params)
      return respond(result)
    },
  )

  const ENTITY_TYPES = z.enum([
    'source', 'bullet', 'perspective', 'resume_entry',
    'resume', 'skill', 'organization', 'job_description',
    'contact', 'credential', 'certification',
  ])

  registerTool(
    server,
    'forge_link_note',
    'Link an existing note to an entity (source, bullet, skill, etc.).',
    {
      note_id: z.string().describe('Note ID'),
      entity_type: ENTITY_TYPES.describe('Entity type to link'),
      entity_id: z.string().describe('Entity ID to link'),
    },
    async (params) => {
      const result = await (sdk as any).notes.addReference(params.note_id, {
        entity_type: params.entity_type,
        entity_id: params.entity_id,
      })
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_unlink_note',
    'Remove a link between a note and an entity.',
    {
      note_id: z.string().describe('Note ID'),
      entity_type: ENTITY_TYPES.describe('Entity type to unlink'),
      entity_id: z.string().describe('Entity ID to unlink'),
    },
    async (params) => {
      const result = await (sdk as any).notes.removeReference(
        params.note_id,
        params.entity_type,
        params.entity_id,
      )
      return respond(result)
    },
  )

  registerTool(
    server,
    'forge_get_entity_notes',
    'Get all notes linked to a specific entity.',
    {
      entity_type: ENTITY_TYPES.describe('Entity type'),
      entity_id: z.string().describe('Entity ID'),
    },
    async (params) => {
      const result = await (sdk as any).notes.getNotesForEntity(
        params.entity_type,
        params.entity_id,
      )
      return respond(result)
    },
  )
}
