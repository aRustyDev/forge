import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier0Tools(server: McpServer, sdk: ForgeClient): void {
  registerTool(
    server,
    'forge_health',
    'Check connectivity to the Forge HTTP server. Call this at session start to verify the server is running.',
    {},  // no parameters
    async () => {
      const result = await sdk.health()
      return mapResult(result)
    },
  )
}
