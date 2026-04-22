import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// Guard: skip test suite if Forge server is not reachable
const FORGE_API_URL = process.env.FORGE_API_URL ?? 'http://localhost:3000'
let forgeReachable = false
try {
  const res = await fetch(`${FORGE_API_URL}/api/health`)
  forgeReachable = res.ok
} catch {
  forgeReachable = false
}

const describeFn = forgeReachable ? describe : describe.skip

describeFn('MCP Integration', () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    // Start MCP server as a child process
    transport = new StdioClientTransport({
      command: 'bun',
      args: ['run', 'packages/mcp/src/index.ts'],
      env: { ...process.env, FORGE_API_URL },
    })

    client = new Client({ name: 'test-client', version: '1.0.0' })
    try {
      await client.connect(transport)
    } catch (err) {
      console.error('[test] Failed to connect MCP client:', err)
      throw err
    }
  })

  afterAll(async () => {
    try {
      await client.close()
    } catch {
      // Best-effort cleanup
    }
    // Transport cleanup: kill MCP child process if still running
    try {
      await transport.close()
    } catch {
      // Best-effort cleanup
    }
  })

  test('forge_health returns server status', async () => {
    const result = await client.callTool({ name: 'forge_health', arguments: {} })
    // If Forge is running: should get ok response
    // If not: should get isError with helpful message
    expect(result.content).toBeDefined()
    expect((result.content as any[]).length).toBeGreaterThan(0)
  })

  test('forge_search_sources returns paginated results', async () => {
    const result = await client.callTool({
      name: 'forge_search_sources',
      arguments: { limit: 5 },
    })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse((result.content as any)[0].text)
    expect(parsed.pagination).toBeDefined()
    expect(parsed.pagination.limit).toBe(5)
  })

  test('forge_get_source with nonexistent entity returns error', async () => {
    const result = await client.callTool({
      name: 'forge_get_source',
      arguments: { source_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect(result.isError).toBe(true)
    expect((result.content as any)[0].text).toContain('not found')
  })

  test('forge_list_resumes returns paginated results', async () => {
    const result = await client.callTool({
      name: 'forge_list_resumes',
      arguments: { limit: 5 },
    })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse((result.content as any)[0].text)
    expect(parsed.pagination).toBeDefined()
  })

  test('resources can be read', async () => {
    const result = await client.readResource({ uri: 'forge://profile' })
    expect(result.contents).toBeDefined()
    expect(result.contents.length).toBeGreaterThan(0)
    expect(result.contents[0].mimeType).toBe('application/json')
  })

  test('forge_export_resume with nonexistent entity returns error', async () => {
    const result = await client.callTool({
      name: 'forge_export_resume',
      arguments: {
        resume_id: '00000000-0000-0000-0000-000000000000',
        format: 'json',
      },
    })
    expect(result.isError).toBe(true)
  })

  test('listTools returns registered tools (21 base + up to 36 from Phase 72)', async () => {
    const tools = await client.listTools()
    // 69+ tools (reorderEntries no longer feature-flagged)
    expect(tools.tools.length).toBeGreaterThanOrEqual(65)
    expect(tools.tools.length).toBeLessThanOrEqual(75)
    // Verify all tools have the forge_ prefix
    for (const tool of tools.tools) {
      expect(tool.name).toMatch(/^forge_/)
    }
  })

  test('listResources returns registered resources', async () => {
    const resources = await client.listResources()
    expect(resources.resources).toBeDefined()
  })

  test('forge://resume/{id}/ir resource with nonexistent ID returns error JSON', async () => {
    const result = await client.readResource({ uri: 'forge://resume/00000000-0000-0000-0000-000000000000/ir' })
    expect(result.contents).toBeDefined()
    expect(result.contents.length).toBeGreaterThan(0)
    const parsed = JSON.parse(result.contents[0].text as string)
    expect(parsed.error).toBeDefined()
  })

  test('MCP server shuts down gracefully on SIGTERM', async () => {
    // Spawn a separate MCP server process for shutdown testing
    const { spawn } = await import('node:child_process')
    const child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
      env: { ...process.env, FORGE_API_URL },
      stdio: 'pipe',
    })

    // Give it time to start
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Send SIGTERM
    child.kill('SIGTERM')

    // Wait for exit with timeout
    const exitCode = await new Promise<number | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000)
      child.on('exit', (code) => {
        clearTimeout(timeout)
        resolve(code)
      })
    })

    expect(exitCode).toBe(0)
  })

  test('MCP server with invalid FORGE_API_URL returns error on resource read', async () => {
    // Spawn MCP server pointing to a bad URL
    const badTransport = new StdioClientTransport({
      command: 'bun',
      args: ['run', 'packages/mcp/src/index.ts'],
      env: { ...process.env, FORGE_API_URL: 'http://localhost:19999' },
    })
    const badClient = new Client({ name: 'test-bad', version: '1.0.0' })

    try {
      await badClient.connect(badTransport)
      const result = await badClient.readResource({ uri: 'forge://profile' })
      expect(result.contents).toBeDefined()
      const parsed = JSON.parse(result.contents[0].text as string)
      expect(parsed.error).toBeDefined()
    } finally {
      try { await badClient.close() } catch {}
      try { await badTransport.close() } catch {}
    }
  })
})
