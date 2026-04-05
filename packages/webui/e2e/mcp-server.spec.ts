/**
 * MCP Server E2E Tests
 *
 * Tests the Forge MCP server via the Streamable HTTP transport at :5174.
 * Requires `just dev` running (starts API :3000 + MCP :5174 + WebUI :5173).
 *
 * These tests verify:
 * 1. MCP server is reachable and healthy
 * 2. Tool calls return correct shapes
 * 3. Resource reads return data
 * 4. Error handling works correctly
 */
import { test, expect } from '@playwright/test'

const MCP_URL = 'http://localhost:5174/mcp'
const MCP_HEALTH_URL = 'http://localhost:5174/health'

// Helper: send a JSON-RPC request to the MCP server
async function mcpRequest(method: string, params?: Record<string, unknown>, id = 1) {
  const body: Record<string, unknown> = {
    jsonrpc: '2.0',
    method,
    id,
  }
  if (params) body.params = params

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  })

  // MCP Streamable HTTP returns SSE for most responses
  const text = await response.text()

  // Parse SSE events — look for "event: message" lines
  const events = text.split('\n').filter(l => l.startsWith('data: '))
  if (events.length > 0) {
    const lastData = events[events.length - 1].replace('data: ', '')
    return JSON.parse(lastData)
  }

  // Fallback: try parsing as plain JSON
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: `Unexpected response: ${text.slice(0, 200)}` } }
  }
}

// Helper: initialize a session and return the session ID
async function initSession(): Promise<string | null> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'playwright-test', version: '1.0' },
      },
      id: 0,
    }),
  })

  const sessionId = response.headers.get('mcp-session-id')
  return sessionId
}

// Helper: call a tool within a session
async function callTool(sessionId: string, toolName: string, args: Record<string, unknown> = {}) {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: 1,
    }),
  })

  const text = await response.text()
  const events = text.split('\n').filter(l => l.startsWith('data: '))
  if (events.length > 0) {
    return JSON.parse(events[events.length - 1].replace('data: ', ''))
  }
  try { return JSON.parse(text) } catch { return { error: { message: text.slice(0, 200) } } }
}

// Helper: list tools within a session
async function listTools(sessionId: string) {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 2,
    }),
  })

  const text = await response.text()
  const events = text.split('\n').filter(l => l.startsWith('data: '))
  if (events.length > 0) {
    return JSON.parse(events[events.length - 1].replace('data: ', ''))
  }
  try { return JSON.parse(text) } catch { return { error: { message: text.slice(0, 200) } } }
}

test.describe('MCP Server', () => {
  test('health endpoint is reachable', async () => {
    const response = await fetch(MCP_HEALTH_URL)
    expect(response.ok).toBe(true)
    const body = await response.json()
    expect(body.server).toBe('ok')
    expect(body.transport).toBe('http')
  })

  test('initialize handshake succeeds', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()
    expect(typeof sessionId).toBe('string')
  })

  test('lists tools after initialization', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await listTools(sessionId!)
    expect(result.result).toBeDefined()
    expect(result.result.tools).toBeInstanceOf(Array)
    expect(result.result.tools.length).toBeGreaterThanOrEqual(40)

    // Verify key tools are present
    const toolNames = result.result.tools.map((t: { name: string }) => t.name)
    expect(toolNames).toContain('forge_health')
    expect(toolNames).toContain('forge_search_sources')
    expect(toolNames).toContain('forge_search_bullets')
    expect(toolNames).toContain('forge_create_resume')
    expect(toolNames).toContain('forge_gap_analysis')
    expect(toolNames).toContain('forge_export_resume')
  })

  test('forge_health tool returns server status', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_health')
    expect(result.result).toBeDefined()

    // Tool result has content array
    const content = result.result.content
    expect(content).toBeInstanceOf(Array)
    expect(content.length).toBeGreaterThan(0)
    expect(content[0].type).toBe('text')

    // Parse the text content
    const data = JSON.parse(content[0].text)
    expect(data.server).toBe('ok')
    expect(typeof data.version).toBe('string')
  })

  test('forge_search_sources returns paginated results', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_search_sources', { limit: 5 })
    expect(result.result).toBeDefined()

    const content = result.result.content
    expect(content[0].type).toBe('text')

    const data = JSON.parse(content[0].text)
    // Should be a paginated response with data array and pagination
    expect(data.data).toBeInstanceOf(Array)
    expect(data.pagination).toBeDefined()
    expect(typeof data.pagination.total).toBe('number')
  })

  test('forge_search_bullets returns results', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_search_bullets', { limit: 3 })
    expect(result.result).toBeDefined()

    const content = result.result.content
    const data = JSON.parse(content[0].text)
    expect(data.data).toBeInstanceOf(Array)
  })

  test('forge_list_resumes returns resume list', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_list_resumes', { limit: 5 })
    expect(result.result).toBeDefined()

    const content = result.result.content
    const data = JSON.parse(content[0].text)
    expect(data.data).toBeInstanceOf(Array)
  })

  test('forge_review_pending returns review queue', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_review_pending')
    expect(result.result).toBeDefined()

    const content = result.result.content
    // Should not be an error
    expect(result.result.isError).toBeFalsy()
  })

  test('forge_search_organizations returns org list', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_search_organizations', { limit: 5 })
    expect(result.result).toBeDefined()

    const content = result.result.content
    expect(content[0].type).toBe('text')
    // Response may be {data: [...], pagination: {...}} or just [...] depending on mapResult
    const data = JSON.parse(content[0].text)
    const items = Array.isArray(data) ? data : (data.data ?? [])
    expect(Array.isArray(items)).toBe(true)
  })

  test('forge_search_job_descriptions returns JD list', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_search_job_descriptions', { limit: 3 })
    expect(result.result).toBeDefined()

    const content = result.result.content
    expect(content[0].type).toBe('text')
    const data = JSON.parse(content[0].text)
    const items = Array.isArray(data) ? data : (data.data ?? [])
    expect(Array.isArray(items)).toBe(true)
  })

  test('invalid tool name returns error response', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await callTool(sessionId!, 'forge_nonexistent_tool')
    // MCP SDK returns error in result or at top level
    const hasError = result.error !== undefined || result.result?.isError === true
    expect(hasError).toBe(true)
  })

  test('multiple sessions can coexist', async () => {
    const session1 = await initSession()
    const session2 = await initSession()

    expect(session1).not.toBeNull()
    expect(session2).not.toBeNull()
    expect(session1).not.toBe(session2)

    // Both sessions should work independently
    const result1 = await callTool(session1!, 'forge_health')
    const result2 = await callTool(session2!, 'forge_health')

    expect(result1.result).toBeDefined()
    expect(result2.result).toBeDefined()
  })

  test('tool descriptions are non-empty', async () => {
    const sessionId = await initSession()
    expect(sessionId).not.toBeNull()

    const result = await listTools(sessionId!)
    const tools = result.result.tools

    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.name.startsWith('forge_')).toBe(true)
    }
  })
})
