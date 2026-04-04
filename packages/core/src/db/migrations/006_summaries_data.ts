/**
 * Data migration for 006_summaries.
 *
 * Reads each resume with a non-null header JSON blob, extracts the tagline
 * (and role from target_role), creates a summary row with a TypeScript-generated
 * UUID, and links it to the resume via summary_id.
 *
 * This approach avoids the fragile pure-SQL UUID generation + correlated subquery
 * pattern that silently drops rows when target_role is NULL.
 */

import type { Database } from 'bun:sqlite'

interface ResumeHeaderRow {
  id: string
  name: string
  target_role: string | null
  header: string | null
}

interface ParsedHeader {
  tagline?: string
  name?: string
  [key: string]: unknown
}

export function migrateHeadersToSummaries(db: Database): { migrated: number; skipped: number } {
  // Re-entrant guard: skip if all resumes already have summary_id set
  const unmigrated = db.query('SELECT COUNT(*) as cnt FROM resumes WHERE header IS NOT NULL AND summary_id IS NULL').get() as { cnt: number }
  if (unmigrated.cnt === 0) return { migrated: 0, skipped: 0 } // already migrated

  const resumes = db
    .query('SELECT id, name, target_role, header FROM resumes WHERE header IS NOT NULL')
    .all() as ResumeHeaderRow[]

  let migrated = 0
  let skipped = 0

  const insertSummary = db.prepare(
    `INSERT INTO summaries (id, title, role, tagline, description, is_template, notes)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`
  )

  const updateResume = db.prepare(
    `UPDATE resumes SET summary_id = ? WHERE id = ?`
  )

  const txn = db.transaction(() => {
    for (const resume of resumes) {
      // Parse the header JSON; skip if malformed
      let parsed: ParsedHeader = {}
      try {
        parsed = JSON.parse(resume.header!) as ParsedHeader
      } catch {
        // Malformed JSON -- create summary from target_role fallback
      }

      const summaryId = crypto.randomUUID()
      const tagline = parsed.tagline ?? resume.target_role ?? null
      const role = resume.target_role ?? null
      // Title is an internal label -- use resume name + role for clarity
      const title = role
        ? `${resume.name} - ${role}`
        : resume.name

      insertSummary.run(summaryId, title, role, tagline, null)
      updateResume.run(summaryId, resume.id)
      migrated++
    }
  })

  txn()

  // Count resumes without headers (they get no summary)
  const totalResumes = (db.query('SELECT COUNT(*) AS cnt FROM resumes').get() as { cnt: number }).cnt
  skipped = totalResumes - migrated

  return { migrated, skipped }
}
