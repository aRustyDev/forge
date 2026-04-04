import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { invokeClaude, parseClaudeEnvelope, stripCodeFences } from '../claude-cli'

// ---------------------------------------------------------------------------
// Unit tests for pure helpers (no mocking needed)
// ---------------------------------------------------------------------------

describe('stripCodeFences', () => {
  it('strips ```json fences', () => {
    const input = '```json\n{"bullets":[]}\n```'
    expect(stripCodeFences(input)).toBe('{"bullets":[]}')
  })

  it('strips bare ``` fences', () => {
    const input = '```\n{"content":"hello"}\n```'
    expect(stripCodeFences(input)).toBe('{"content":"hello"}')
  })

  it('returns trimmed input when no fences present', () => {
    const input = '  {"content":"hello"}  '
    expect(stripCodeFences(input)).toBe('{"content":"hello"}')
  })

  it('handles fences with extra whitespace', () => {
    const input = '```json  \n  {"ok": true}  \n```'
    expect(stripCodeFences(input)).toBe('{"ok": true}')
  })
})

describe('parseClaudeEnvelope', () => {
  it('parses a well-formed envelope with code-fenced JSON', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: '\n\n```json\n{"bullets":[{"content":"test","technologies":[],"metrics":null}]}\n```\n',
      is_error: false,
    })
    const result = parseClaudeEnvelope(envelope)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.data as any).bullets).toHaveLength(1)
      expect((result.data as any).bullets[0].content).toBe('test')
    }
  })

  it('parses an envelope where result has no code fences', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: '{"content":"hello","reasoning":"because"}',
      is_error: false,
    })
    const result = parseClaudeEnvelope(envelope)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.data as any).content).toBe('hello')
    }
  })

  it('returns error when envelope is not valid JSON', () => {
    const result = parseClaudeEnvelope('not json at all')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Failed to parse CLI envelope')
    }
  })

  it('returns error when envelope reports is_error: true', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: 'Something went wrong',
      is_error: true,
    })
    const result = parseClaudeEnvelope(envelope)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Something went wrong')
    }
  })

  it('returns error when .result is not a string', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: 42,
      is_error: false,
    })
    const result = parseClaudeEnvelope(envelope)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('not a string')
    }
  })

  it('returns error when inner JSON is malformed', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: '```json\n{bad json}\n```',
      is_error: false,
    })
    const result = parseClaudeEnvelope(envelope)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Failed to parse inner JSON')
    }
  })
})

// ---------------------------------------------------------------------------
// Integration-style tests for invokeClaude (mocked Bun.spawn)
// ---------------------------------------------------------------------------

describe('invokeClaude', () => {
  const originalSpawn = Bun.spawn

  afterEach(() => {
    // Restore original Bun.spawn after each test
    ;(Bun as any).spawn = originalSpawn
  })

  /**
   * Helper: create a mock Bun.spawn that returns the given stdout/stderr/exitCode.
   */
  function mockSpawn(opts: {
    stdout?: string
    stderr?: string
    exitCode?: number
    throwOnSpawn?: Error
    throwOnRead?: Error
  }) {
    ;(Bun as any).spawn = (_cmd: string[], _opts: any) => {
      if (opts.throwOnSpawn) {
        throw opts.throwOnSpawn
      }

      const stdoutBlob = new Blob([opts.stdout ?? ''])
      const stderrBlob = new Blob([opts.stderr ?? ''])

      return {
        stdout: opts.throwOnRead
          ? { getReader: () => { throw opts.throwOnRead } }
          : stdoutBlob.stream(),
        stderr: stderrBlob.stream(),
        exited: Promise.resolve(opts.exitCode ?? 0),
        pid: 12345,
        kill: () => {},
      }
    }
  }

  it('returns parsed data on success', async () => {
    const payload = { bullets: [{ content: 'test', technologies: [], metrics: null }] }
    const envelope = JSON.stringify({
      type: 'result',
      result: '```json\n' + JSON.stringify(payload) + '\n```',
      is_error: false,
    })
    mockSpawn({ stdout: envelope })

    const result = await invokeClaude({ prompt: 'test prompt' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.data as any).bullets).toHaveLength(1)
      expect(result.rawResponse).toBe(envelope)
    }
  })

  it('returns NOT_FOUND when binary is missing (ENOENT)', async () => {
    const err = new Error('spawn claude ENOENT')
    mockSpawn({ throwOnSpawn: err })

    const result = await invokeClaude({ prompt: 'test', claudePath: 'claude' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('NOT_FOUND')
      expect(result.message).toContain('Claude Code CLI not found')
      expect(result.message).toContain('https://claude.ai/claude-code')
    }
  })

  it('returns PROCESS_ERROR on non-zero exit code', async () => {
    mockSpawn({ stdout: '', stderr: 'fatal error', exitCode: 1 })

    const result = await invokeClaude({ prompt: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PROCESS_ERROR')
      expect(result.message).toContain('exited with code 1')
      expect(result.message).toContain('fatal error')
    }
  })

  it('returns PARSE_ERROR when envelope is not JSON', async () => {
    mockSpawn({ stdout: 'not json' })

    const result = await invokeClaude({ prompt: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PARSE_ERROR')
      expect(result.rawResponse).toBe('not json')
    }
  })

  it('returns PARSE_ERROR when inner JSON is malformed', async () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: '```json\n{bad}\n```',
      is_error: false,
    })
    mockSpawn({ stdout: envelope })

    const result = await invokeClaude({ prompt: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PARSE_ERROR')
      expect(result.message).toContain('Failed to parse inner JSON')
    }
  })

  it('returns TIMEOUT when AbortSignal fires', async () => {
    // Simulate the abort error that Bun throws when a signal fires
    ;(Bun as any).spawn = (_cmd: string[], _opts: any) => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      return {
        stdout: new Blob(['']).stream(),
        stderr: new Blob(['']).stream(),
        // The promise rejects with an abort error
        exited: Promise.reject(abortError),
        pid: 12345,
        kill: () => {},
      }
    }

    const result = await invokeClaude({ prompt: 'test', timeout: 100 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('TIMEOUT')
      expect(result.message).toContain('timed out')
    }
  })

  it('returns PROCESS_ERROR for generic spawn errors', async () => {
    const err = new Error('permission denied')
    mockSpawn({ throwOnSpawn: err })

    const result = await invokeClaude({ prompt: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PROCESS_ERROR')
      expect(result.message).toContain('permission denied')
    }
  })

  it('uses custom claudePath when provided', async () => {
    let capturedCmd: string[] = []
    ;(Bun as any).spawn = (cmd: string[], _opts: any) => {
      capturedCmd = cmd
      const envelope = JSON.stringify({
        type: 'result',
        result: '{"ok":true}',
        is_error: false,
      })
      return {
        stdout: new Blob([envelope]).stream(),
        stderr: new Blob(['']).stream(),
        exited: Promise.resolve(0),
        pid: 12345,
        kill: () => {},
      }
    }

    await invokeClaude({ prompt: 'hello', claudePath: '/usr/local/bin/claude' })
    expect(capturedCmd[0]).toBe('/usr/local/bin/claude')
    expect(capturedCmd).toContain('-p')
    expect(capturedCmd).toContain('hello')
    expect(capturedCmd).toContain('--output-format')
    expect(capturedCmd).toContain('json')
  })
})
