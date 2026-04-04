import { ForgeClient } from '@forge/sdk'
import { createForgeServer } from './server'
import { detectFeatures } from './utils/feature-flags'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const baseUrl = process.env.FORGE_API_URL ?? 'http://localhost:3000'
const sdk = new ForgeClient({ baseUrl })

// Phase 72: Detect feature flags before server creation
const flags = detectFeatures(sdk)

const server = createForgeServer(sdk, flags)
const transport = new StdioServerTransport()

// Graceful shutdown
const shutdown = async () => {
  await server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await server.connect(transport)
