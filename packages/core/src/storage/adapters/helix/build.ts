/**
 * Build script for HelixDB HQL files.
 *
 * Compiles multi-file db/src/ layouts into single-file db/dist/ bundles
 * and extracts them back. Round-trip invariant: extract(compile(files)) === files.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const MARKER_PREFIX = '// === '
const MARKER_SUFFIX = ' ==='
const MARKER_RE = /^\/\/ === (.+?) ===$/

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Concatenate multiple .hx file contents into a single string with section
 * markers between sections. Files are sorted alphabetically for deterministic
 * output.
 */
export function compile(files: Map<string, string>): string {
  const sorted = [...files.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (sorted.length === 0) return ''

  return sorted
    .map(([name, content]) => `${MARKER_PREFIX}${name}${MARKER_SUFFIX}\n${content}`)
    .join('\n\n')
}

/**
 * Split a compiled single-file string back into individual files using
 * section markers. Content before the first marker is ignored. Trailing
 * whitespace is trimmed from each extracted section.
 */
export function extract(compiled: string): Map<string, string> {
  const result = new Map<string, string>()
  if (!compiled) return result

  const lines = compiled.split('\n')
  let currentFile: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = MARKER_RE.exec(line)
    if (match) {
      // Flush the previous section
      if (currentFile !== null) {
        result.set(currentFile, currentLines.join('\n').trim())
      }
      currentFile = match[1]
      currentLines = []
    } else if (currentFile !== null) {
      currentLines.push(line)
    }
    // Lines before the first marker are silently ignored
  }

  // Flush the last section
  if (currentFile !== null) {
    result.set(currentFile, currentLines.join('\n').trim())
  }

  return result
}

// ---------------------------------------------------------------------------
// File I/O wrappers (for CLI usage)
// ---------------------------------------------------------------------------

/**
 * Read all .hx files from `srcDir`, compile them, and write the result to
 * `distFile`.
 */
export async function compileDir(srcDir: string, distFile: string): Promise<void> {
  const entries = await readdir(srcDir)
  const hxFiles = entries.filter((f) => f.endsWith('.hx')).sort()

  const files = new Map<string, string>()
  for (const name of hxFiles) {
    let content = await readFile(join(srcDir, name), 'utf-8')
    // Strip any existing section marker at the start of the file
    // (source files may already contain their own marker)
    content = content.replace(new RegExp(`^${MARKER_PREFIX}${name.replace(/\./g, '\\.')}${MARKER_SUFFIX}\\n*`), '')
    files.set(name, content.trimEnd())
  }

  const compiled = compile(files)
  await mkdir(dirname(distFile), { recursive: true })
  await writeFile(distFile, compiled + '\n', 'utf-8')
}

/**
 * Read a compiled dist file and extract its sections back into individual
 * files in `srcDir`.
 */
export async function extractFile(distFile: string, srcDir: string): Promise<void> {
  const compiled = await readFile(distFile, 'utf-8')
  const files = extract(compiled)

  await mkdir(srcDir, { recursive: true })
  for (const [name, content] of files) {
    await writeFile(join(srcDir, name), content + '\n', 'utf-8')
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const dbRoot = join(import.meta.dir, 'db')
  const schemasDir = join(dbRoot, 'src', 'schemas')
  const queriesDir = join(dbRoot, 'src', 'queries')
  const distDir = join(dbRoot, 'dist')

  await mkdir(distDir, { recursive: true })

  console.log('Compiling schemas...')
  await compileDir(schemasDir, join(distDir, 'schema.hx'))
  const schemaContent = await readFile(join(distDir, 'schema.hx'), 'utf-8')
  const schemaDefCount = (schemaContent.match(/^(N::|E::|V::)/gm) || []).length
  console.log(`  dist/schema.hx (${schemaDefCount} definitions)`)

  console.log('Compiling queries...')
  await compileDir(queriesDir, join(distDir, 'queries.hx'))
  const queryContent = await readFile(join(distDir, 'queries.hx'), 'utf-8')
  const queryCount = (queryContent.match(/^QUERY /gm) || []).length
  console.log(`  dist/queries.hx (${queryCount} queries)`)

  console.log('\nBuild complete.')
}
