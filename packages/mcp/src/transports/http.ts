/**
 * Streamable HTTP transport for the Forge MCP server.
 *
 * Creates a new transport + server connection per session. Each MCP client
 * (Claude Code, Claude Desktop, Cursor) gets its own session identified by
 * the mcp-session-id header.
 *
 * Endpoint: POST /mcp   (JSON-RPC messages + SSE responses)
 *           GET  /mcp   (SSE stream for server-initiated notifications)
 *           DELETE /mcp (session teardown)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { createForgeServer } from '../server'

export interface HttpTransportOptions {
  port: number
  cors?: string[]
}

/**
 * Start the MCP HTTP endpoint with per-session transport management.
 *
 * Each new client connection (no mcp-session-id header) creates a fresh
 * McpServer + transport pair. Subsequent requests with the same session ID
 * route to the existing transport. This enables multiple simultaneous clients.
 */
export async function startHttpTransport(
  sdk: ForgeClient,
  flags: FeatureFlags,
  options: HttpTransportOptions,
): Promise<void> {
  const { port, cors } = options

  // Session store: maps session ID → transport instance
  const sessions = new Map<string, {
    transport: WebStandardStreamableHTTPServerTransport
    server: McpServer
  }>()

  const httpServer = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(cors) })
      }

      // Health check (non-MCP)
      if (url.pathname === '/health') {
        return Response.json({
          server: 'ok',
          transport: 'http',
          port,
          active_sessions: sessions.size,
        })
      }

      // MCP endpoint
      if (url.pathname === '/mcp') {
        const sessionId = req.headers.get('mcp-session-id')

        // Existing session — route to its transport
        if (sessionId && sessions.has(sessionId)) {
          try {
            const session = sessions.get(sessionId)!
            const response = await session.transport.handleRequest(req)
            addCorsHeaders(response, cors)
            return response
          } catch (err) {
            console.error(`[forge:mcp:http] Session ${sessionId} error:`, err)
            return errorResponse(500, 'Internal server error', cors)
          }
        }

        // New session — create transport + server, handle the initialize request
        if (req.method === 'POST') {
          try {
            const transport = new WebStandardStreamableHTTPServerTransport({
              sessionIdGenerator: () => crypto.randomUUID(),
            })

            // Create a fresh MCP server for this session
            const server = createForgeServer(sdk, flags)
            await server.connect(transport)

            // Handle the request (should be initialize)
            const response = await transport.handleRequest(req)

            // Store the session if a session ID was assigned
            if (transport.sessionId) {
              sessions.set(transport.sessionId, { transport, server })
              console.error(`[forge:mcp:http] New session: ${transport.sessionId}`)

              // Clean up on close
              transport.onclose = () => {
                sessions.delete(transport.sessionId!)
                console.error(`[forge:mcp:http] Session closed: ${transport.sessionId}`)
              }
            }

            addCorsHeaders(response, cors)
            return response
          } catch (err) {
            console.error('[forge:mcp:http] Session creation error:', err)
            return errorResponse(500, 'Failed to create session', cors)
          }
        }

        // GET/DELETE without session ID
        return errorResponse(400, 'Missing mcp-session-id header', cors)
      }

      return errorResponse(404, 'Not found. MCP endpoint is at /mcp', cors)
    },
  })

  console.error(`[forge:mcp] Streamable HTTP transport listening on http://localhost:${httpServer.port}/mcp`)

  // Graceful shutdown — close all sessions
  const shutdown = async () => {
    console.error(`[forge:mcp] Shutting down (${sessions.size} active sessions)...`)
    for (const [id, session] of sessions) {
      await session.server.close().catch(() => {})
      sessions.delete(id)
    }
    httpServer.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive
  await new Promise(() => {})
}

function corsHeaders(origins?: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origins?.join(', ') ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
    'Access-Control-Expose-Headers': 'mcp-session-id',
  }
}

function addCorsHeaders(response: Response, origins?: string[]): void {
  for (const [key, value] of Object.entries(corsHeaders(origins))) {
    response.headers.set(key, value)
  }
}

function errorResponse(status: number, message: string, origins?: string[]): Response {
  return Response.json(
    { error: message },
    { status, headers: corsHeaders(origins) },
  )
}
