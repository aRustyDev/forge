import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'

/**
 * Register all 7 MCP resources on the server.
 *
 * Static resources (polled on session start):
 *   forge://profile     -> sdk.profile.get()
 *   forge://archetypes  -> sdk.archetypes.list()
 *   forge://domains     -> sdk.domains.list()
 *   forge://templates   -> sdk.templates.list()
 *
 * Parameterized resources (fetched by ID):
 *   forge://resume/{id}    -> sdk.resumes.get(id)
 *   forge://resume/{id}/ir -> sdk.resumes.ir(id)
 *   forge://job/{id}       -> sdk.jobDescriptions.get(id)
 */
export function registerResources(server: McpServer, sdk: ForgeClient): void {
  // -- Static resources --

  server.resource(
    'forge-profile',
    'forge://profile',
    { description: 'User profile: name, contact info, clearance level' },
    async (uri) => {
      const result = await sdk.profile.get()
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  server.resource(
    'forge-archetypes',
    'forge://archetypes',
    { description: 'Career archetypes with domain associations (e.g., platform-engineer, security-engineer)' },
    async (uri) => {
      const result = await sdk.archetypes.list()
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  server.resource(
    'forge-domains',
    'forge://domains',
    { description: 'Skill domain taxonomy (e.g., infrastructure, security, ai_ml, cloud)' },
    async (uri) => {
      const result = await sdk.domains.list()
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  server.resource(
    'forge-templates',
    'forge://templates',
    { description: 'Resume templates with section structures' },
    async (uri) => {
      const result = await sdk.templates.list()
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  // -- Parameterized resources (resource templates) --

  server.resource(
    'forge-resume',
    'forge://resume/{id}',
    { description: 'Resume with sections and entries. Re-read after any mutating tool call.' },
    async (uri, params) => {
      const id = params.id as string
      const result = await sdk.resumes.get(id)
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  server.resource(
    'forge-resume-ir',
    'forge://resume/{id}/ir',
    { description: 'Compiled resume intermediate representation (IR) for rendering to Markdown/LaTeX/PDF' },
    async (uri, params) => {
      const id = params.id as string
      const result = await sdk.resumes.ir(id)
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )

  server.resource(
    'forge-job',
    'forge://job/{id}',
    { description: 'Job description with organization details, raw text, and status' },
    async (uri, params) => {
      const id = params.id as string
      const result = await sdk.jobDescriptions.get(id)
      if (!result.ok) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: result.error }),
          }],
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2),
        }],
      }
    },
  )
}
