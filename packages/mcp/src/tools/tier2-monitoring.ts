import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import type { FeatureFlags } from '../utils/feature-flags'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'

export function registerTier2MonitoringTools(
  server: McpServer,
  sdk: ForgeClient,
  respond: typeof mapResult,
  flags: FeatureFlags,
): void {
  if (flags.reviewAvailable) {
    registerTool(
      server,
      'forge_review_pending',
      'Get all bullets and perspectives awaiting human review.',
      {},
      async () => {
        const result = await (sdk as any).review.pending()
        return respond(result)
      },
    )
  }

  if (flags.integrityAvailable) {
    registerTool(
      server,
      'forge_check_drift',
      'Detect stale content snapshots in derivation chains and stale embeddings.',
      {},
      async () => {
        const result = await (sdk as any).integrity.drift()
        return respond(result)
      },
    )
  }
}
