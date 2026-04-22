import { describe, expect, test } from 'bun:test'
import { compile, extract } from '../build'

describe('compile', () => {
  test('concatenates files with section markers', () => {
    const files = new Map([
      ['content.hx', 'N::Bullets { id: String }'],
      ['taxonomy.hx', 'N::Skills { id: String }'],
    ])
    const result = compile(files)
    expect(result).toContain('// === content.hx ===')
    expect(result).toContain('N::Bullets { id: String }')
    expect(result).toContain('// === taxonomy.hx ===')
    expect(result).toContain('N::Skills { id: String }')
  })

  test('sorts files alphabetically for deterministic output', () => {
    const files = new Map([
      ['taxonomy.hx', 'B'],
      ['content.hx', 'A'],
    ])
    const result = compile(files)
    const contentIdx = result.indexOf('// === content.hx ===')
    const taxonomyIdx = result.indexOf('// === taxonomy.hx ===')
    expect(contentIdx).toBeLessThan(taxonomyIdx)
  })

  test('handles empty map', () => {
    const files = new Map<string, string>()
    const result = compile(files)
    expect(result).toBe('')
  })

  test('handles single file', () => {
    const files = new Map([['only.hx', 'content here']])
    const result = compile(files)
    expect(result).toContain('// === only.hx ===')
    expect(result).toContain('content here')
  })
})

describe('extract', () => {
  test('splits compiled output back into files by section markers', () => {
    const compiled = [
      '// === content.hx ===',
      'N::Bullets { id: String }',
      '',
      '// === taxonomy.hx ===',
      'N::Skills { id: String }',
    ].join('\n')

    const files = extract(compiled)
    expect(files.size).toBe(2)
    expect(files.get('content.hx')!.trim()).toBe('N::Bullets { id: String }')
    expect(files.get('taxonomy.hx')!.trim()).toBe('N::Skills { id: String }')
  })

  test('returns empty map for empty string', () => {
    const files = extract('')
    expect(files.size).toBe(0)
  })

  test('ignores content before first section marker', () => {
    const compiled = [
      '// preamble comment',
      '// === content.hx ===',
      'N::Bullets { id: String }',
    ].join('\n')

    const files = extract(compiled)
    expect(files.size).toBe(1)
    expect(files.get('content.hx')!.trim()).toBe('N::Bullets { id: String }')
  })
})

describe('round-trip', () => {
  test('extract(compile(files)) === files', () => {
    const original = new Map([
      ['content.hx', 'N::Bullets {\n    UNIQUE INDEX id: String,\n    content: String\n}'],
      ['taxonomy.hx', 'N::Skills {\n    UNIQUE INDEX id: String,\n    name: String\n}'],
    ])

    const compiled = compile(original)
    const extracted = extract(compiled)

    expect(extracted.size).toBe(original.size)
    for (const [name, content] of original) {
      expect(extracted.get(name)!.trim()).toBe(content.trim())
    }
  })

  test('round-trips multiline content with blank lines', () => {
    const original = new Map([
      ['queries.hx', 'QUERY GetBullets(id: String) =>\n    N<Bullets>({id: id})\n\nQUERY AddBullets(content: String) =>\n    AddN<Bullets>({content: content})'],
    ])

    const compiled = compile(original)
    const extracted = extract(compiled)

    expect(extracted.get('queries.hx')!.trim()).toBe(original.get('queries.hx')!.trim())
  })
})
