/**
 * Streamable HTTP transport for the Forge MCP server.
 *
 * Uses the Web Standard transport from @modelcontextprotocol/sdk which
 * is compatible with Bun.serve(). Handles multiple concurrent MCP sessions
 * over a single HTTP endpoint.
 *
 * Endpoint: POST /mcp (JSON-RPC messages + SSE responses)
 *           GET  /mcp (SSE stream for server-initiated notifications)
 *           DELETE /mcp (session teardown)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

export interface HttpTransportOptions {
  port: number
  /** Optional: restrict to specific origins (default: allow all) */
  cors?: string[]
}

/**
 * Start the MCP server with Streamable HTTP transport on a Bun HTTP server.
 *
 * Each incoming request creates or resumes an MCP session. The transport
 * handles session multiplexing (multiple Claude Code / Claude Desktop
 * clients can connect simultaneously).
 */
export async function startHttpTransport(
  server: McpServer,
  options: HttpTransportOptions,
): Promise<void> {
  const { port, cors } = options

  // Create the web-standard transport
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  })

  // Connect the MCP server to the transport
  await server.connect(transport)

  // Start Bun HTTP server
  const httpServer = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(cors),
        })
      }

      // Health check (non-MCP)
      if (url.pathname === '/health') {
        return Response.json({ server: 'ok', transport: 'http', port })
      }

      // MCP endpoint
      if (url.pathname === '/mcp') {
        try {
          const response = await transport.handleRequest(req)
          // Add CORS headers to response
          for (const [key, value] of Object.entries(corsHeaders(cors))) {
            response.headers.set(key, value)
          }
          return response
        } catch (err) {
          console.error('[forge:mcp:http] Request handling error:', err)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders(cors) },
          )
        }
      }

      return Response.json(
        { error: 'Not found. MCP endpoint is at /mcp' },
        { status: 404, headers: corsHeaders(cors) },
      )
    },
  })

  console.error(`[forge:mcp] Streamable HTTP transport listening on http://localhost:${httpServer.port}/mcp`)

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[forge:mcp] Shutting down HTTP transport...')
    await server.close()
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
