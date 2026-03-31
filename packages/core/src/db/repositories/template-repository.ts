/**
 * TemplateRepository -- pure data access for the resume_templates table.
 *
 * Note: Built-in protection is NOT enforced here. The service layer
 * checks `is_builtin` before calling remove(). This allows admin/migration
 * code to bypass the check if needed.
 */

import type { Database } from 'bun:sqlite'
import type { ResumeTemplate, CreateResumeTemplate, UpdateResumeTemplate } from '../../types'

interface TemplateRow {
  id: string
  name: string
  description: string | null
  sections: string   // JSON string in the DB
  is_builtin: number
  created_at: string
  updated_at: string
}

/**
 * Deserialize a DB row into a ResumeTemplate.
 * Parses the JSON `sections` column. Does NOT convert `is_builtin` to boolean.
 */
function deserialize(row: TemplateRow): ResumeTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sections: JSON.parse(row.sections),
    is_builtin: row.is_builtin,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function list(db: Database): ResumeTemplate[] {
  const rows = db
    .query('SELECT * FROM resume_templates ORDER BY is_builtin DESC, name ASC')
    .all() as TemplateRow[]
  return rows.map(deserialize)
}

export function get(db: Database, id: string): ResumeTemplate | null {
  const row = db
    .query('SELECT * FROM resume_templates WHERE id = ?')
    .get(id) as TemplateRow | null
  return row ? deserialize(row) : null
}

export function create(db: Database, input: CreateResumeTemplate): ResumeTemplate {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO resume_templates (id, name, description, sections, is_builtin)
       VALUES (?, ?, ?, ?, 0)
       RETURNING *`
    )
    .get(id, input.name, input.description ?? null, JSON.stringify(input.sections)) as TemplateRow

  return deserialize(row)
}

export function update(db: Database, id: string, patch: UpdateResumeTemplate): ResumeTemplate | null {
  const sets: string[] = []
  const params: unknown[] = []

  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(patch.name)
  }
  if (patch.description !== undefined) {
    sets.push('description = ?')
    params.push(patch.description)
  }
  if (patch.sections !== undefined) {
    sets.push('sections = ?')
    params.push(JSON.stringify(patch.sections))
  }

  if (sets.length === 0) {
    return get(db, id)
  }

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  params.push(id)

  const row = db
    .query(`UPDATE resume_templates SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as TemplateRow | null

  return row ? deserialize(row) : null
}

export function remove(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM resume_templates WHERE id = ?', [id])
  return result.changes > 0
}
