import { describe, test, expect } from 'bun:test'

describe('PDF cache', () => {
  test('PDF_CACHE_DIR constant is exported', async () => {
    const { PDF_CACHE_DIR } = await import('../services/resume-service')
    expect(PDF_CACHE_DIR).toBe('/tmp/forge-pdf-cache')
  })

  test('hashLatexContent produces consistent SHA-256 hex', async () => {
    const { hashLatexContent } = await import('../services/resume-service')
    const hash1 = hashLatexContent('\\documentclass{article}')
    const hash2 = hashLatexContent('\\documentclass{article}')
    const hash3 = hashLatexContent('\\documentclass{report}')
    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toHaveLength(64)
  })
})
