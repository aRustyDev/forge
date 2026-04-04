import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import pkg from '../package.json'
import { registerResources } from './resources'
import { registerTier0Tools } from './tools/tier0'
import { registerSearchTools } from './tools/search'
import { registerGetTools } from './tools/get'
import { registerListTools } from './tools/list'
import { registerDeriveTools } from './tools/derive'
import { registerReviewTools } from './tools/review'
import { registerAssemblyTools } from './tools/assembly'
import { registerAnalysisTools } from './tools/analysis'
import { registerExportTools } from './tools/export'

/**
 * Create and configure the Forge MCP server.
 *
 * Registers all resources and Tier 0 + Tier 1 tools (21 total).
 * Does NOT connect a transport -- the caller handles that.
 */
export function createForgeServer(sdk: ForgeClient): McpServer {
  const server = new McpServer({
    name: 'forge',
    version: pkg.version,
  })

  // Startup-time check for alignment API availability
  if (!sdk.alignment) {
    console.error('[forge:mcp] WARNING: sdk.alignment is not available. forge_align_resume and forge_match_requirements will return errors. Phase 70 must be implemented to enable alignment tools.')
  }

  // Resources (7)
  registerResources(server, sdk)

  // Tier 0: Diagnostics (1 tool)
  registerTier0Tools(server, sdk)

  // Tier 1: Core Workflow (20 tools)
  registerSearchTools(server, sdk)    // 3 tools
  registerGetTools(server, sdk)       // 3 tools
  registerListTools(server, sdk)      // 1 tool
  registerDeriveTools(server, sdk)    // 2 tools
  registerReviewTools(server, sdk)    // 4 tools
  registerAssemblyTools(server, sdk)  // 3 tools
  registerAnalysisTools(server, sdk)  // 3 analysis tools (gap_analysis, align_resume, match_requirements)
  registerExportTools(server, sdk)    // 1 tool

  return server
}
