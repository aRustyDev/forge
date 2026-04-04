import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { z, ZodRawShape } from 'zod'

/**
 * Register an MCP tool with standardized error handling.
 *
 * Wraps the handler in try/catch so unhandled exceptions (e.g., Zod parse
 * failures, unexpected SDK errors) become MCP error responses instead of
 * crashing the server.
 *
 * Success logging is gated behind FORGE_MCP_DEBUG env var to avoid noise.
 * Error logging is unconditional.
 *
 * @param server - The McpServer instance
 * @param name - Tool name (e.g., 'forge_search_sources')
 * @param description - Human-readable tool description for AI clients
 * @param schema - Zod schema shape defining the tool's parameters
 * @param handler - Async function that receives validated params and returns an MCP response
 */
export function registerTool<S extends ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  schema: S,
  handler: (params: z.objectOutputType<z.ZodObject<S>, z.ZodTypeAny>) => Promise<{
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
  }>,
): void {
  server.tool(name, description, schema, async (params) => {
    const start = performance.now()
    try {
      const result = await handler(params)
      const duration = Math.round(performance.now() - start)
      if (result.isError) {
        console.error(`[forge:mcp] ${name} ERROR ${duration}ms`)
      } else if (process.env.FORGE_MCP_DEBUG) {
        console.error(`[forge:mcp] ${name} ok ${duration}ms`)
      }
      return result
    } catch (err) {
      const duration = Math.round(performance.now() - start)
      console.error(`[forge:mcp] ${name} UNHANDLED_ERROR ${duration}ms: ${String(err)}`)
      return {
        content: [{ type: 'text' as const, text: `Internal error in ${name}: ${String(err)}` }],
        isError: true,
      }
    }
  })
}
