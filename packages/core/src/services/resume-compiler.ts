/**
 * Resume IR Compiler — assembles a ResumeDocument from database state.
 *
 * Reads resume_sections from the database and dispatches to section-type
 * builders. Each builder queries entries via section_id instead of
 * hardcoded section strings.
 */

import type { Database } from 'bun:sqlite'
import type {
  ResumeDocument,
  ResumeHeader,
  IRSection,
  IRSectionType,
  IRSectionItem,
  ExperienceGroup,
  ExperienceSubheading,
  ExperienceBullet,
  SkillGroup,
  EducationItem,
  ProjectItem,
  CertificationGroup,
  ClearanceItem,
  PresentationItem,
  SummaryItem,
  UserProfile,
} from '../types'

/** Truncate text to `len` characters, appending '...' if truncated. */
function truncate(text: string | null, len = 60): string {
  if (!text) return ''
  if (text.length <= len) return text
  return text.slice(0, len) + '...'
}

// ── Row types for query results ─────────────────────────────────────

interface ResumeRow {
  id: string
  name: string
  target_role: string
  header: string | null  // JSON blob
}

interface ResumeSectionRow {
  id: string
  resume_id: string
  title: string
  entry_type: string
  position: number
}

interface ExperienceEntryRow {
  entry_id: string
  entry_content: string | null
  perspective_id: string
  perspective_content: string
  bullet_id: string
  bullet_content: string
  source_id: string
  source_title: string
  organization_id: string | null
  org_name: string | null
  start_date: string | null
  end_date: string | null
  is_current: number
  position: number
}

interface SkillRow {
  category: string | null
  skill_name: string
}

// ── Compiler ─────────────────────────────────────────────────────────

/**
 * Compile a resume into the IR format.
 *
 * Returns null if the resume does not exist.
 */
export function compileResumeIR(db: Database, resumeId: string): ResumeDocument | null {
  // 1. Fetch resume base data
  const resume = db
    .query('SELECT id, name, target_role, header FROM resumes WHERE id = ?')
    .get(resumeId) as ResumeRow | null

  if (!resume) return null

  // 2. Fetch user profile for contact fields
  const profile = db
    .query('SELECT * FROM user_profile LIMIT 1')
    .get() as UserProfile | null

  // 3. Parse header — contact fields from profile, content fields from resume
  const header = parseHeader(resume, profile)

  // 4. Fetch sections from resume_sections table
  const sectionRows = db
    .query('SELECT * FROM resume_sections WHERE resume_id = ? ORDER BY position')
    .all(resumeId) as ResumeSectionRow[]

  // 5. Build IR sections from DB sections
  const sections: IRSection[] = sectionRows.map(section => {
    const items = buildSectionItems(db, section)
    return {
      id: section.id,  // real UUID from DB, not synthetic
      type: section.entry_type as IRSectionType,
      title: section.title,
      display_order: section.position,
      items,
    }
  })

  return { resume_id: resumeId, header, sections }
}

/**
 * Dispatch to the correct builder based on entry_type.
 */
function buildSectionItems(db: Database, section: ResumeSectionRow): IRSectionItem[] {
  switch (section.entry_type) {
    case 'experience': return buildExperienceItems(db, section.id)
    case 'skills': return buildSkillItems(db, section.id)
    case 'education': return buildEducationItems(db, section.id)
    case 'projects': return buildProjectItems(db, section.id)
    case 'clearance': return buildClearanceItems(db, section.id)
    case 'presentations': return buildPresentationItems(db, section.id)
    case 'freeform': return buildFreeformItems(db, section.id)
    case 'awards': return buildFreeformItems(db, section.id)
    case 'certifications': return buildCertificationItems(db, section.id)
    default: return []
  }
}

// ── Section builders ─────────────────────────────────────────────────

function parseHeader(resume: ResumeRow, profile: UserProfile | null): ResumeHeader {
  // Content fields from the resume-specific header JSON
  let tagline: string | null = resume.target_role
  if (resume.header) {
    try {
      const parsed = JSON.parse(resume.header)
      tagline = parsed.tagline ?? tagline
    } catch {
      // Fall through — tagline defaults to target_role
    }
  }

  // Contact fields from profile (single source of truth)
  return {
    name: profile?.name ?? resume.name,
    tagline,
    location: profile?.location ?? null,
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
    linkedin: profile?.linkedin ?? null,
    github: profile?.github ?? null,
    website: profile?.website ?? null,
    clearance: profile?.clearance ?? null,
  }
}

function buildFreeformItems(db: Database, sectionId: string): SummaryItem[] {
  const rows = db
    .query(
      `SELECT re.id AS entry_id, re.content
       FROM resume_entries re
       WHERE re.section_id = ?
       ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{ entry_id: string; content: string | null }>

  return rows.filter(r => r.content).map(r => ({
    kind: 'summary' as const,
    content: r.content!,
    entry_id: r.entry_id,
  }))
}

function buildExperienceItems(db: Database, sectionId: string): ExperienceGroup[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        re.position,
        p.content AS perspective_content,
        p.bullet_id,
        b.content AS bullet_content,
        bs.source_id,
        s.title AS source_title,
        sr.organization_id,
        sr.start_date,
        sr.end_date,
        sr.is_current,
        o.name AS org_name
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullets b ON b.id = p.bullet_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_roles sr ON sr.source_id = s.id
      LEFT JOIN organizations o ON o.id = sr.organization_id
      WHERE re.section_id = ?
      ORDER BY sr.is_current DESC, sr.start_date DESC, re.position ASC`
    )
    .all(sectionId) as ExperienceEntryRow[]

  // Group by org_name, then sub-group by source_title (role)
  const orgMap = new Map<string, Map<string, ExperienceEntryRow[]>>()

  for (const row of rows) {
    const orgKey = row.org_name ?? 'Other'
    if (!orgMap.has(orgKey)) orgMap.set(orgKey, new Map())
    const roleMap = orgMap.get(orgKey)!
    const roleKey = row.source_title
    if (!roleMap.has(roleKey)) roleMap.set(roleKey, [])
    roleMap.get(roleKey)!.push(row)
  }

  const groups: ExperienceGroup[] = []

  for (const [orgName, roleMap] of orgMap) {
    const subheadings: ExperienceSubheading[] = []

    for (const [roleTitle, entries] of roleMap) {
      const first = entries[0]
      const dateRange = formatDateRange(first.start_date, first.end_date, !!first.is_current)

      const bullets: ExperienceBullet[] = entries.map(e => ({
        content: e.entry_content ?? e.perspective_content,
        entry_id: e.entry_id,
        source_chain: {
          source_id: e.source_id,
          source_title: truncate(e.source_title, 60),
          bullet_id: e.bullet_id,
          bullet_preview: truncate(e.bullet_content, 60),
          perspective_id: e.perspective_id,
          perspective_preview: truncate(e.perspective_content, 60),
        },
        is_cloned: e.entry_content !== null,
      }))

      subheadings.push({
        id: syntheticUUID('subheading', `${orgName}-${roleTitle}`),
        title: roleTitle,
        date_range: dateRange,
        source_id: first.source_id,
        bullets,
      })
    }

    groups.push({
      kind: 'experience_group',
      id: syntheticUUID('org', orgName),
      organization: orgName,
      subheadings,
    })
  }

  return groups
}

function buildSkillItems(db: Database, sectionId: string): SkillGroup[] {
  const rows = db
    .query(
      `SELECT s.name AS skill_name, s.category
       FROM resume_skills rs
       JOIN skills s ON s.id = rs.skill_id
       WHERE rs.section_id = ?
       ORDER BY rs.position`
    )
    .all(sectionId) as Array<{ skill_name: string; category: string | null }>

  if (rows.length === 0) return []

  // Group by category
  const catMap = new Map<string, string[]>()
  for (const row of rows) {
    const cat = row.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(row.skill_name)
  }

  return [{
    kind: 'skill_group',
    categories: Array.from(catMap.entries()).map(([label, skills]) => ({
      label,
      skills,
    })),
  }]
}

function buildEducationItems(db: Database, sectionId: string): EducationItem[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        bs.source_id,
        se.institution,
        se.field,
        se.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_education se ON se.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_content: string
      source_id: string
      institution: string | null
      field: string | null
      end_date: string | null
    }>

  return rows.map(row => ({
    kind: 'education' as const,
    institution: row.institution ?? 'Unknown',
    degree: row.entry_content ?? row.perspective_content,
    date: row.end_date ? new Date(row.end_date).getFullYear().toString() : '',
    entry_id: row.entry_id,
    source_id: row.source_id,
  }))
}

function buildProjectItems(db: Database, sectionId: string): ProjectItem[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        b.content AS bullet_content,
        bs.source_id,
        s.title AS source_title,
        sp.start_date,
        sp.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullets b ON b.id = p.bullet_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_projects sp ON sp.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string
      perspective_content: string
      bullet_id: string
      bullet_content: string
      source_id: string
      source_title: string
      start_date: string | null
      end_date: string | null
    }>

  // Group by source_title (project name)
  const projectMap = new Map<string, typeof rows>()
  for (const row of rows) {
    if (!projectMap.has(row.source_title)) projectMap.set(row.source_title, [])
    projectMap.get(row.source_title)!.push(row)
  }

  return Array.from(projectMap.entries()).map(([name, entries]) => ({
    kind: 'project' as const,
    name,
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map(e => ({
      content: e.entry_content ?? e.perspective_content,
      entry_id: e.entry_id,
      source_chain: {
        source_id: e.source_id,
        source_title: truncate(e.source_title, 60),
        bullet_id: e.bullet_id,
        bullet_preview: truncate(e.bullet_content, 60),
        perspective_id: e.perspective_id,
        perspective_preview: truncate(e.perspective_content, 60),
      },
      is_cloned: e.entry_content !== null,
    })),
  }))
}

function buildClearanceItems(db: Database, sectionId: string): ClearanceItem[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        bs.source_id,
        sc.level,
        sc.polygraph,
        sc.status AS clearance_status
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_clearances sc ON sc.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_content: string
      source_id: string
      level: string | null
      polygraph: string | null
      clearance_status: string | null
    }>

  return rows.map(row => {
    // Build clearance string from structured data if available
    let content = row.entry_content ?? row.perspective_content
    if (row.level) {
      content = row.level
      if (row.polygraph) content += ` with ${row.polygraph}`
      if (row.clearance_status) content += ` - ${row.clearance_status}`
    }
    return {
      kind: 'clearance' as const,
      content,
      entry_id: row.entry_id,
      source_id: row.source_id,
    }
  })
}

function buildPresentationItems(db: Database, sectionId: string): PresentationItem[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        b.content AS bullet_content,
        bs.source_id,
        s.title AS source_title,
        s.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullets b ON b.id = p.bullet_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string
      perspective_content: string
      bullet_id: string
      bullet_content: string
      source_id: string
      source_title: string
      end_date: string | null
    }>

  // Group by source_title (presentation name)
  const presMap = new Map<string, typeof rows>()
  for (const row of rows) {
    if (!presMap.has(row.source_title)) presMap.set(row.source_title, [])
    presMap.get(row.source_title)!.push(row)
  }

  return Array.from(presMap.entries()).map(([title, entries]) => ({
    kind: 'presentation' as const,
    title,
    venue: '', // TODO: extract from source metadata when available
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map(e => ({
      content: e.entry_content ?? e.perspective_content,
      entry_id: e.entry_id,
      source_chain: {
        source_id: e.source_id,
        source_title: truncate(e.source_title, 60),
        bullet_id: e.bullet_id,
        bullet_preview: truncate(e.bullet_content, 60),
        perspective_id: e.perspective_id,
        perspective_preview: truncate(e.perspective_content, 60),
      },
      is_cloned: e.entry_content !== null,
    })),
  }))
}

function buildCertificationItems(db: Database, sectionId: string): CertificationGroup[] {
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        bs.source_id,
        s.title AS source_title,
        se.institution,
        se.field,
        se.credential_id,
        se.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_education se ON se.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string
      perspective_content: string
      source_id: string
      source_title: string
      institution: string | null
      field: string | null
      credential_id: string | null
      end_date: string | null
    }>

  if (rows.length === 0) return []

  // Group by institution (issuing body)
  const catMap = new Map<string, Array<{ name: string; entry_id: string; source_id: string }>>()

  for (const row of rows) {
    const label = row.institution ?? 'Other'
    if (!catMap.has(label)) catMap.set(label, [])
    catMap.get(label)!.push({
      name: row.entry_content ?? row.perspective_content,
      entry_id: row.entry_id,
      source_id: row.source_id,
    })
  }

  return [{
    kind: 'certification_group',
    categories: Array.from(catMap.entries()).map(([label, certs]) => ({
      label,
      certs: certs.map(c => ({
        name: c.name,
        entry_id: c.entry_id,
        source_id: c.source_id,
      })),
    })),
  }]
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a deterministic synthetic UUID from a namespace and key.
 * Uses a simple hash to produce a stable ID for DnD addressing.
 */
export function syntheticUUID(namespace: string, key: string): string {
  const input = `${namespace}:${key}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit int
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.slice(0, 12).padEnd(12, '0')}`
}

/**
 * Format a date range for display.
 * Handles: "Mar 2024 - Jul 2025", "Sep 2018 - Present", "2023"
 */
export function formatDateRange(
  startDate: string | null,
  endDate: string | null,
  isCurrent: boolean,
): string {
  const fmt = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (!startDate && !endDate) return ''
  if (!startDate && endDate) return fmt(endDate)
  if (startDate && isCurrent) return `${fmt(startDate)} - Present`
  if (startDate && endDate) return `${fmt(startDate)} - ${fmt(endDate)}`
  if (startDate) return fmt(startDate)
  return ''
}
