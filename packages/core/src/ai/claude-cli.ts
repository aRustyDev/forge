/**
 * Claude Code CLI wrapper for programmatic AI invocation.
 *
 * Shells out to `claude -p <prompt> --output-format json` and parses the
 * JSON envelope returned by the CLI.  The envelope shape is:
 *
 *   { type: "result", result: "<markdown-wrapped JSON>", is_error: false, ... }
 *
 * The inner payload lives in `.result` and is typically wrapped in markdown
 * code fences which must be stripped before parsing the actual JSON.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeOptions {
  prompt: string
  /** Timeout in ms. Defaults to FORGE_CLAUDE_TIMEOUT env or 60 000 ms. */
  timeout?: number
  /** Absolute path to the claude binary. Defaults to FORGE_CLAUDE_PATH env or "claude". */
  claudePath?: string
}

export type ClaudeResult =
  | { ok: true; data: unknown; rawResponse: string }
  | {
      ok: false
      error: 'TIMEOUT' | 'PARSE_ERROR' | 'PROCESS_ERROR' | 'NOT_FOUND'
      message: string
      rawResponse?: string
    }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CODE_FENCE_RE = /```(?:json)?\s*\n?([\s\S]*?)```/

/**
 * Strip markdown code fences from a string, returning the inner content.
 * If no fences are found the original string is returned as-is.
 */
export function stripCodeFences(raw: string): string {
  const match = CODE_FENCE_RE.exec(raw)
  return match ? match[1].trim() : raw.trim()
}

/**
 * Given the raw stdout from `claude --output-format json`, extract and parse
 * the inner JSON payload from the envelope's `.result` field.
 */
export function parseClaudeEnvelope(
  raw: string,
): { ok: true; data: unknown } | { ok: false; message: string } {
  // Step 1 — parse the outer envelope
  let envelope: Record<string, unknown>
  try {
    envelope = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { ok: false, message: `Failed to parse CLI envelope as JSON` }
  }

  // Check for envelope-level errors
  if (envelope.is_error === true) {
    const msg =
      typeof envelope.result === 'string'
        ? envelope.result
        : 'Claude CLI reported an error'
    return { ok: false, message: msg }
  }

  // Step 2 — extract the .result field
  const inner = envelope.result
  if (typeof inner !== 'string') {
    return {
      ok: false,
      message: `Envelope .result is not a string (got ${typeof inner})`,
    }
  }

  // Step 3 — strip code fences and parse inner JSON
  const stripped = stripCodeFences(inner)
  try {
    const data: unknown = JSON.parse(stripped)
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      message: `Failed to parse inner JSON after stripping code fences`,
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function invokeClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  const {
    prompt,
    timeout = Number(process.env.FORGE_CLAUDE_TIMEOUT) || 60_000,
    claudePath = process.env.FORGE_CLAUDE_PATH || 'claude',
  } = options

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn([claudePath, '-p', prompt, '--output-format', 'json'], {
      stdout: 'pipe',
      stderr: 'pipe',
      signal: AbortSignal.timeout(timeout),
    })
  } catch (err: unknown) {
    // Bun.spawn throws synchronously when the binary is not found
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ENOENT') || msg.includes('not found') || msg.includes('No such file')) {
      return {
        ok: false,
        error: 'NOT_FOUND',
        message: `Claude Code CLI not found at "${claudePath}". Install from https://claude.ai/claude-code`,
      }
    }
    return {
      ok: false,
      error: 'PROCESS_ERROR',
      message: `Failed to spawn claude process: ${msg}`,
    }
  }

  // Collect stdout + stderr
  let rawStdout: string
  let rawStderr: string
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    rawStdout = stdout
    rawStderr = stderr

    if (exitCode !== 0) {
      return {
        ok: false,
        error: 'PROCESS_ERROR',
        message: `claude exited with code ${exitCode}: ${rawStderr || '(no stderr)'}`,
        rawResponse: rawStdout,
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // AbortSignal.timeout produces an AbortError / TimeoutError
    if (
      msg.includes('abort') ||
      msg.includes('Abort') ||
      msg.includes('timeout') ||
      msg.includes('Timeout') ||
      msg.includes('The operation was aborted')
    ) {
      return {
        ok: false,
        error: 'TIMEOUT',
        message: `AI derivation timed out after ${timeout}ms`,
      }
    }
    return {
      ok: false,
      error: 'PROCESS_ERROR',
      message: `Error reading claude output: ${msg}`,
    }
  }

  // Parse the envelope and extract inner JSON
  const parsed = parseClaudeEnvelope(rawStdout)
  if (!parsed.ok) {
    return {
      ok: false,
      error: 'PARSE_ERROR',
      message: parsed.message,
      rawResponse: rawStdout,
    }
  }

  return { ok: true, data: parsed.data, rawResponse: rawStdout }
}
