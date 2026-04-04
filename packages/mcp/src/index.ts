import { ForgeClient } from '@forge/sdk'
import { createForgeServer } from './server'
import { detectFeatures } from './utils/feature-flags'

const baseUrl = process.env.FORGE_API_URL ?? 'http://localhost:3000'
const transport = process.env.FORGE_MCP_TRANSPORT ?? 'stdio'
const mcpPort = parseInt(process.env.FORGE_MCP_PORT ?? '5174', 10)

const sdk = new ForgeClient({ baseUrl })
const flags = detectFeatures(sdk)

if (transport === 'http') {
  // Streamable HTTP — multiple clients, per-session server instances
  const { startHttpTransport } = await import('./transports/http')
  await startHttpTransport(sdk, flags, { port: mcpPort })
} else {
  // STDIO — single client, spawned as child process
  const server = createForgeServer(sdk, flags)
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const stdioTransport = new StdioServerTransport()

  const shutdown = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await server.connect(stdioTransport)
}
