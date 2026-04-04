import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ForgeClient } from '@forge/sdk'
import { z } from 'zod'
import { registerTool } from '../utils/register-tool'
import { mapResult } from '../utils/error-mapper'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

export function registerExportTools(server: McpServer, sdk: ForgeClient): void {

  registerTool(
    server,
    'forge_export_resume',
    'Export a resume in the specified format. JSON returns the full IR document. Markdown and LaTeX return text content. PDF writes to a temp file and returns the file path.',
    {
      resume_id: z.string().uuid()
        .describe('Resume UUID to export'),
      format: z.enum(['json', 'markdown', 'latex', 'pdf'])
        .describe('Export format'),
    },
    async (params) => {
      const { resume_id, format } = params

      // -- JSON: return IR document --
      if (format === 'json') {
        const result = await sdk.export.resumeAsJson(resume_id)
        return mapResult(result)
      }

      // -- Markdown / LaTeX: return text content --
      if (format === 'markdown' || format === 'latex') {
        const result = await sdk.export.downloadResume(resume_id, format)
        if (!result.ok) {
          return mapResult(result)
        }
        const text = await result.data.text()
        return {
          content: [{ type: 'text' as const, text }],
        }
      }

      // -- PDF: write to temp file, return path --
      if (format === 'pdf') {
        const result = await sdk.export.downloadResume(resume_id, 'pdf')
        if (!result.ok) {
          return mapResult(result)
        }
        const buffer = await result.data.arrayBuffer()
        const filename = `forge-resume-${resume_id}-${Date.now()}.pdf`
        const filePath = join(tmpdir(), filename)
        await writeFile(filePath, Buffer.from(buffer))
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ file_path: filePath, format: 'pdf', size_bytes: buffer.byteLength }, null, 2),
          }],
        }
      }

      // Unreachable (Zod validates format), but TypeScript needs it
      return {
        content: [{ type: 'text' as const, text: `Unsupported format: ${format}` }],
        isError: true,
      }
    },
  )
}
