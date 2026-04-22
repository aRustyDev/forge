// packages/core/src/scripts/backfill-parser.ts
//
// Re-parse existing JDs through the M3 parser to populate
// parsed_sections, work_posture, parsed_locations, salary_period,
// and (where missing) salary_min/salary_max.
//
// Usage: bun run packages/core/src/scripts/backfill-parser.ts [db-path]
// Default db-path: data/forge.db

import { Database } from 'bun:sqlite'
import { parseJobDescription } from '../parser'

const dbPath = process.argv[2] ?? 'data/forge.db'
const db = new Database(dbPath)

interface JDRow {
  id: string
  raw_text: string
}

const rows = db
  .query<JDRow, []>(
    'SELECT id, raw_text FROM job_descriptions WHERE parsed_sections IS NULL AND raw_text IS NOT NULL',
  )
  .all()

console.log(`Backfilling ${rows.length} job descriptions...`)

const update = db.prepare(`
  UPDATE job_descriptions
  SET parsed_sections = ?1,
      work_posture = ?2,
      parsed_locations = ?3,
      salary_period = ?4,
      salary_min = COALESCE(salary_min, ?5),
      salary_max = COALESCE(salary_max, ?6),
      updated_at = ?7
  WHERE id = ?8
`)

let count = 0
for (const row of rows) {
  const parsed = parseJobDescription(row.raw_text)
  update.run(
    JSON.stringify(parsed.sections),
    parsed.workPosture,
    JSON.stringify(parsed.locations),
    parsed.salary?.period ?? null,
    parsed.salary?.min != null ? Math.round(parsed.salary.min) : null,
    parsed.salary?.max != null ? Math.round(parsed.salary.max) : null,
    new Date().toISOString(),
    row.id,
  )
  count++
}

console.log(`Done. Updated ${count} job descriptions.`)
db.close()
