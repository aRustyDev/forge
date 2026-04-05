/**
 * ResumeRepository — pure data access for the resumes table,
 * resume_sections table, resume_skills table, and resume_entries table.
 *
 * Handles CRUD for resumes, section management, skills management,
 * and adding/removing/reordering/updating entries within resume sections.
 * Does NOT enforce business rules — services handle status transition
 * validation etc.
 */

import type { Database } from 'bun:sqlite'
import type {
  Resume,
  CreateResume,
  UpdateResume,
  ResumeWithEntries,
  ResumeEntry,
  AddResumeEntry,
  ResumeSectionEntity,
  ResumeSkill,
} from '../../types'

// ── Row types ────────────────────────────────────────────────────────

interface ResumeRow {
  id: string
  name: string
  target_role: string
  target_employer: string
  archetype: string
  status: string
  notes: string | null
  header: string | null
  summary_id: string | null
  markdown_override: string | null
  markdown_override_updated_at: string | null
  latex_override: string | null
  latex_override_updated_at: string | null
  created_at: string
  updated_at: string
}

interface EntryJoinRow {
  // resume_entries fields
  entry_id: string
  section_id: string
  position: number
  entry_content: string | null
  perspective_content_snapshot: string | null
  entry_notes: string | null
  entry_created_at: string
  entry_updated_at: string
  // perspectives fields (nullable for freeform entries)
  perspective_id: string | null
  bullet_id: string | null
  perspective_content: string | null
  // resume_sections fields
  section_title: string
  section_entry_type: string
  section_position: number
}

// ── Helpers ──────────────────────────────────────────────────────────

function rowToResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    name: row.name,
    target_role: row.target_role,
    target_employer: row.target_employer,
    archetype: row.archetype,
    status: row.status as Resume['status'],
    notes: row.notes ?? null,
    header: row.header ?? null,
    summary_id: row.summary_id ?? null,
    markdown_override: row.markdown_override ?? null,
    markdown_override_updated_at: row.markdown_override_updated_at ?? null,
    latex_override: row.latex_override ?? null,
    latex_override_updated_at: row.latex_override_updated_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ── Repository ───────────────────────────────────────────────────────

export const ResumeRepository = {
  /**
   * Insert a new resume record.
   * Generates a UUID, sets status to 'draft'.
   */
  create(db: Database, input: CreateResume): Resume {
    const id = crypto.randomUUID()

    const row = db
      .query(
        `INSERT INTO resumes (id, name, target_role, target_employer, archetype)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .get(
        id,
        input.name,
        input.target_role,
        input.target_employer,
        input.archetype,
      ) as ResumeRow

    return rowToResume(row)
  },

  /**
   * Retrieve a single resume by ID.
   * Returns null when no row matches.
   */
  get(db: Database, id: string): Resume | null {
    const row = db
      .query('SELECT * FROM resumes WHERE id = ?')
      .get(id) as ResumeRow | null

    if (!row) return null
    return rowToResume(row)
  },

  /**
   * Retrieve a resume with all its entries grouped by section.
   *
   * JOINs resume_entries -> resume_sections, LEFT JOINs perspectives,
   * groups by section_id, orders by section position then entry position.
   * Returns null if the resume does not exist.
   *
   * Each entry includes `perspective_content` which is the current
   * content from the perspective (null for freeform entries).
   */
  getWithEntries(db: Database, id: string): ResumeWithEntries | null {
    const resume = ResumeRepository.get(db, id)
    if (!resume) return null

    const rows = db
      .query(
        `SELECT
           re.id AS entry_id,
           re.section_id,
           re.position,
           re.content AS entry_content,
           re.perspective_content_snapshot,
           re.notes AS entry_notes,
           re.created_at AS entry_created_at,
           re.updated_at AS entry_updated_at,
           re.perspective_id,
           p.bullet_id,
           p.content AS perspective_content,
           rs.title AS section_title,
           rs.entry_type AS section_entry_type,
           rs.position AS section_position
         FROM resume_entries re
         JOIN resume_sections rs ON rs.id = re.section_id
         LEFT JOIN perspectives p ON p.id = re.perspective_id
         WHERE re.resume_id = ?
         ORDER BY rs.position, re.position`,
      )
      .all(id) as EntryJoinRow[]

    // Also fetch all sections (including empty ones with no entries)
    const allSections = db
      .query(
        `SELECT id, title, entry_type, position
         FROM resume_sections WHERE resume_id = ? ORDER BY position`
      )
      .all(id) as Array<{ id: string; title: string; entry_type: string; position: number }>

    // Build sections map, starting with all sections (even empty ones)
    const sectionMap = new Map<string, {
      id: string
      title: string
      entry_type: string
      position: number
      entries: Array<ResumeEntry & { perspective_content: string | null }>
    }>()

    for (const sec of allSections) {
      sectionMap.set(sec.id, {
        id: sec.id,
        title: sec.title,
        entry_type: sec.entry_type,
        position: sec.position,
        entries: [],
      })
    }

    // Populate entries into their sections
    for (const row of rows) {
      const section = sectionMap.get(row.section_id)
      if (!section) continue
      section.entries.push({
        id: row.entry_id,
        resume_id: id,
        section_id: row.section_id,
        perspective_id: row.perspective_id,
        content: row.entry_content,
        perspective_content_snapshot: row.perspective_content_snapshot,
        position: row.position,
        notes: row.entry_notes,
        created_at: row.entry_created_at,
        updated_at: row.entry_updated_at,
        perspective_content: row.perspective_content,
      })
    }

    const sections = [...sectionMap.values()].sort((a, b) => a.position - b.position)

    return { ...resume, sections }
  },

  /**
   * List resumes with pagination.
   * Returns data array and total count (before pagination).
   */
  list(
    db: Database,
    offset = 0,
    limit = 50,
  ): { data: Resume[]; total: number } {
    const countRow = db
      .query('SELECT COUNT(*) AS total FROM resumes')
      .get() as { total: number }

    const rows = db
      .query(
        'SELECT * FROM resumes ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(limit, offset) as ResumeRow[]

    return {
      data: rows.map(rowToResume),
      total: countRow.total,
    }
  },

  /**
   * Partially update a resume.
   * Only the fields present in `input` are changed. `updated_at` is
   * always refreshed. Returns null if the resume does not exist.
   */
  update(db: Database, id: string, input: UpdateResume): Resume | null {
    const existing = ResumeRepository.get(db, id)
    if (!existing) return null

    const sets: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      sets.push('name = ?')
      params.push(input.name)
    }
    if (input.target_role !== undefined) {
      sets.push('target_role = ?')
      params.push(input.target_role)
    }
    if (input.target_employer !== undefined) {
      sets.push('target_employer = ?')
      params.push(input.target_employer)
    }
    if (input.archetype !== undefined) {
      sets.push('archetype = ?')
      params.push(input.archetype)
    }
    if (input.status !== undefined) {
      sets.push('status = ?')
      params.push(input.status)
    }
    if (input.header !== undefined) {
      sets.push('header = ?')
      params.push(input.header)
    }
    if (input.summary_id !== undefined) {
      sets.push('summary_id = ?')
      params.push(input.summary_id)
    }
    if (input.markdown_override !== undefined) {
      sets.push('markdown_override = ?')
      params.push(input.markdown_override)
      sets.push('markdown_override_updated_at = ?')
      params.push(input.markdown_override !== null ? new Date().toISOString() : null)
    }
    if (input.latex_override !== undefined) {
      sets.push('latex_override = ?')
      params.push(input.latex_override)
      sets.push('latex_override_updated_at = ?')
      params.push(input.latex_override !== null ? new Date().toISOString() : null)
    }

    // Always update updated_at
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

    params.push(id)

    const row = db
      .query(`UPDATE resumes SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
      .get(...params) as ResumeRow | null

    if (!row) return null
    return rowToResume(row)
  },

  /**
   * Delete a resume by ID.
   * Cascades to resume_sections -> resume_entries (ON DELETE CASCADE).
   * Returns true if a row was deleted, false if not found.
   */
  delete(db: Database, id: string): boolean {
    const result = db.run('DELETE FROM resumes WHERE id = ?', [id])
    return result.changes > 0
  },

  /**
   * Add an entry to a resume, linking a perspective to a section.
   *
   * Generates a UUID for the entry. If `input.position` is omitted, the
   * entry is appended at the next available position for the section
   * (MAX(position) + 1, or 0 for the first entry). This lets callers that
   * just want "add to the end" skip pre-computing the index — the source
   * of truth for "what position is next" stays inside the repository so
   * every caller gets consistent behavior.
   *
   * Returns the created entry.
   */
  addEntry(db: Database, resumeId: string, input: AddResumeEntry): ResumeEntry {
    const id = crypto.randomUUID()
    const position = input.position ?? (
      (db
        .query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM resume_entries WHERE section_id = ?')
        .get(input.section_id) as { next: number }
      ).next
    )
    db.run(
      `INSERT INTO resume_entries (id, resume_id, section_id, perspective_id, content, position, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, resumeId, input.section_id, input.perspective_id ?? null, input.content ?? null,
       position, input.notes ?? null],
    )
    return db.query('SELECT * FROM resume_entries WHERE id = ?').get(id) as ResumeEntry
  },

  /**
   * Remove an entry from a resume.
   * Returns false if the entry was not found.
   */
  removeEntry(db: Database, resumeId: string, entryId: string): boolean {
    const result = db.run(
      'DELETE FROM resume_entries WHERE id = ? AND resume_id = ?',
      [entryId, resumeId],
    )
    return result.changes > 0
  },

  /**
   * Reorder entries within a resume.
   *
   * Wrapped in a transaction: updates section_id and position for each
   * entry. If anything fails the entire operation rolls back.
   */
  reorderEntries(db: Database, resumeId: string, entries: Array<{ id: string; section_id: string; position: number }>): void {
    const txn = db.transaction(() => {
      const stmt = db.prepare(
        `UPDATE resume_entries SET section_id = ?, position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? AND resume_id = ?`,
      )
      for (const entry of entries) {
        stmt.run(entry.section_id, entry.position, entry.id, resumeId)
      }
    })
    txn()
  },

  /**
   * Update a resume entry's content and/or position.
   *
   * Supports copy-on-write: setting `content` to a string enters clone
   * mode and captures a snapshot; setting it to `null` resets to
   * reference mode.
   */
  updateEntry(db: Database, entryId: string, input: {
    content?: string | null
    section_id?: string
    position?: number
    notes?: string | null
  }): ResumeEntry | null {
    const sets: string[] = []
    const params: unknown[] = []

    // content: undefined = no change, null = reset to reference mode, string = clone/edit
    if ('content' in input) {
      sets.push('content = ?')
      params.push(input.content)
      // If setting content (clone), capture snapshot
      if (input.content !== null && input.content !== undefined) {
        sets.push('perspective_content_snapshot = (SELECT content FROM perspectives WHERE id = (SELECT perspective_id FROM resume_entries WHERE id = ?))')
        params.push(entryId)
      } else {
        // Reset to reference mode, clear snapshot
        sets.push('perspective_content_snapshot = NULL')
      }
    }
    if (input.section_id !== undefined) { sets.push('section_id = ?'); params.push(input.section_id) }
    if (input.position !== undefined) { sets.push('position = ?'); params.push(input.position) }
    if ('notes' in input) { sets.push('notes = ?'); params.push(input.notes ?? null) }

    if (sets.length === 0) {
      return db.query('SELECT * FROM resume_entries WHERE id = ?').get(entryId) as ResumeEntry | null
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
    params.push(entryId)

    const row = db
      .query(`UPDATE resume_entries SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
      .get(...params) as ResumeEntry | null

    return row
  },

  /**
   * Update the resume header JSON blob.
   */
  updateHeader(db: Database, id: string, header: Record<string, unknown>): Resume | null {
    const row = db
      .query(
        `UPDATE resumes SET header = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`
      )
      .get(JSON.stringify(header), id) as ResumeRow | null
    if (!row) return null
    return rowToResume(row)
  },

  /**
   * Store or clear the markdown override.
   * Sets markdown_override_updated_at when content is non-null, clears it when null.
   */
  updateMarkdownOverride(db: Database, id: string, content: string | null): Resume | null {
    const row = db
      .query(
        `UPDATE resumes SET
          markdown_override = ?,
          markdown_override_updated_at = CASE WHEN ? IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`
      )
      .get(content, content, id) as ResumeRow | null
    if (!row) return null
    return rowToResume(row)
  },

  /**
   * Store or clear the latex override.
   * Sets latex_override_updated_at when content is non-null, clears it when null.
   */
  updateLatexOverride(db: Database, id: string, content: string | null): Resume | null {
    const row = db
      .query(
        `UPDATE resumes SET
          latex_override = ?,
          latex_override_updated_at = CASE WHEN ? IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`
      )
      .get(content, content, id) as ResumeRow | null
    if (!row) return null
    return rowToResume(row)
  },

  // ── Section CRUD ──────────────────────────────────────────────────

  createSection(db: Database, resumeId: string, input: { title: string; entry_type: string; position?: number }): ResumeSectionEntity {
    const id = crypto.randomUUID()
    const position = input.position ?? 0
    const row = db
      .query(
        `INSERT INTO resume_sections (id, resume_id, title, entry_type, position)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(id, resumeId, input.title, input.entry_type, position) as ResumeSectionEntity
    return row
  },

  getSection(db: Database, sectionId: string): ResumeSectionEntity | null {
    return db.query('SELECT * FROM resume_sections WHERE id = ?').get(sectionId) as ResumeSectionEntity | null
  },

  listSections(db: Database, resumeId: string): ResumeSectionEntity[] {
    return db.query('SELECT * FROM resume_sections WHERE resume_id = ? ORDER BY position').all(resumeId) as ResumeSectionEntity[]
  },

  updateSection(db: Database, sectionId: string, input: { title?: string; position?: number }): ResumeSectionEntity | null {
    const sets: string[] = []
    const params: unknown[] = []
    if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
    if (input.position !== undefined) { sets.push('position = ?'); params.push(input.position) }
    if (sets.length === 0) return ResumeRepository.getSection(db, sectionId)
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
    params.push(sectionId)
    return db.query(`UPDATE resume_sections SET ${sets.join(', ')} WHERE id = ? RETURNING *`).get(...params) as ResumeSectionEntity | null
  },

  deleteSection(db: Database, sectionId: string): boolean {
    const result = db.run('DELETE FROM resume_sections WHERE id = ?', [sectionId])
    return result.changes > 0
  },

  // ── Skills CRUD ────────────────────────────────────────────────────

  addSkill(db: Database, sectionId: string, skillId: string, position?: number): ResumeSkill {
    const id = crypto.randomUUID()
    const pos = position ?? 0
    const row = db
      .query(
        `INSERT INTO resume_skills (id, section_id, skill_id, position)
         VALUES (?, ?, ?, ?)
         RETURNING *`
      )
      .get(id, sectionId, skillId, pos) as ResumeSkill
    return row
  },

  removeSkill(db: Database, sectionId: string, skillId: string): boolean {
    const result = db.run('DELETE FROM resume_skills WHERE section_id = ? AND skill_id = ?', [sectionId, skillId])
    return result.changes > 0
  },

  listSkillsForSection(db: Database, sectionId: string): ResumeSkill[] {
    return db.query('SELECT * FROM resume_skills WHERE section_id = ? ORDER BY position').all(sectionId) as ResumeSkill[]
  },

  reorderSkills(db: Database, sectionId: string, skills: Array<{ skill_id: string; position: number }>): void {
    const txn = db.transaction(() => {
      const stmt = db.prepare(
        'UPDATE resume_skills SET position = ? WHERE section_id = ? AND skill_id = ?'
      )
      for (const s of skills) {
        stmt.run(s.position, sectionId, s.skill_id)
      }
    })
    txn()
  },
}
