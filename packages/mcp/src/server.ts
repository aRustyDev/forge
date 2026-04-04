import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from './utils/feature-flags'
import { mapResult } from './utils/error-mapper'
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
// Tier 2
import { registerTier2EntityCreationTools } from './tools/tier2-entity-creation'
import { registerTier2ResumeMetadataTools } from './tools/tier2-resume-metadata'
import { registerTier2JDTools } from './tools/tier2-jd'
import { registerTier2JDLinkageTools } from './tools/tier2-linkage'
import { registerTier2MonitoringTools } from './tools/tier2-monitoring'
import { registerTier2SearchTools } from './tools/tier2-search'
// Tier 3
import { registerTier3UpdateTools } from './tools/tier3-update'
import { registerTier3AssemblyTools } from './tools/tier3-assembly'
import { registerTier3WorkflowTools } from './tools/tier3-workflow'
import { registerTier3NoteTools } from './tools/tier3-notes'
import { registerTier3JDUpdateTool } from './tools/tier3-jd-update'

/**
 * Create and configure the Forge MCP server.
 *
 * Registers all resources and tools across Tiers 0-3.
 * Does NOT connect a transport -- the caller handles that.
 */
export function createForgeServer(sdk: ForgeClient, flags: FeatureFlags): McpServer {
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

  // Tier 2: Data Management (up to 18 tools, some feature-flagged)
  registerTier2EntityCreationTools(server, sdk, mapResult)   // 4 tools
  registerTier2ResumeMetadataTools(server, sdk, mapResult)   // 3 tools
  registerTier2JDTools(server, sdk, mapResult, flags)        // 1-4 tools (3 feature-flagged)
  registerTier2JDLinkageTools(server, sdk, mapResult, flags) // 0-2 tools (feature-flagged)
  registerTier2MonitoringTools(server, sdk, mapResult, flags) // 0-2 tools (feature-flagged)
  registerTier2SearchTools(server, sdk, mapResult)           // 3 tools

  // Tier 3: Refinement (up to 18 tools, some feature-flagged)
  registerTier3UpdateTools(server, sdk, mapResult)           // 5 tools
  registerTier3AssemblyTools(server, sdk, mapResult, flags)  // 4-5 tools (1 feature-flagged)
  registerTier3WorkflowTools(server, sdk, mapResult)         // 5 tools
  registerTier3NoteTools(server, sdk, mapResult, flags)      // 0-2 tools (feature-flagged)
  registerTier3JDUpdateTool(server, sdk, mapResult)          // 1 tool

  return server
}
