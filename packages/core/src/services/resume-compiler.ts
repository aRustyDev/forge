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
  summary_id: string | null
  generated_tagline: string | null
  tagline_override: string | null
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
  // Nullable after the compiler LEFT JOINs perspectives to support entries
  // that link to a source directly (re.source_id) without going through
  // the perspective → bullet chain. The row-mapper below coalesces
  // content across entry_content → perspective_content → source.description.
  perspective_id: string | null
  perspective_content: string | null
  bullet_id: string | null
  bullet_content: string | null
  source_id: string | null
  source_title: string | null
  organization_id: string | null
  org_name: string | null
  org_city: string | null
  org_state: string | null
  work_arrangement: string | null
  start_date: string | null
  end_date: string | null
  is_current: number | null
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
  // 1. Fetch resume base data (including Phase 92 tagline columns)
  const resume = db
    .query(
      `SELECT id, name, target_role, header, summary_id,
              generated_tagline, tagline_override
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | null

  if (!resume) return null

  // 2. Fetch user profile for contact fields
  const profile = db
    .query('SELECT * FROM user_profile LIMIT 1')
    .get() as UserProfile | null

  // 4. Parse header — contact fields from profile, tagline from resume-level
  // `tagline_override ?? generated_tagline` (Phase 92). Summary is no longer
  // consulted for tagline.
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
  // Tagline resolution order (Phase 92):
  //   1. resume.tagline_override (user-authored, highest priority)
  //   2. resume.generated_tagline (TF-IDF extracted from linked JDs)
  //   3. header JSON tagline (legacy resume-specific header)
  //   4. resume.target_role (fallback)
  let tagline: string | null = resume.target_role
  if (resume.header) {
    try {
      const parsed = JSON.parse(resume.header)
      if (parsed.tagline) tagline = parsed.tagline
    } catch {
      // Fall through
    }
  }
  if (resume.generated_tagline) tagline = resume.generated_tagline
  if (resume.tagline_override) tagline = resume.tagline_override

  // Warn on placeholder profile data
  const name = profile?.name ?? resume.name
  if (!profile) {
    console.warn('[resume-compiler] No user_profile row found. Header name falls back to resume.name:', JSON.stringify(resume.name))
  } else if (profile.name === 'User') {
    console.warn('[resume-compiler] user_profile.name is "User" (seed default). Update via Settings > Profile.')
  }

  // Check for missing contact fields
  if (profile && !profile.email && !profile.phone && !profile.linkedin && !profile.github) {
    console.warn('[resume-compiler] user_profile has no contact fields populated. Header will have no contact info.')
  }

  // Contact fields from profile (single source of truth)
  return {
    name,
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
  // Dual-path source resolution via COALESCE(bs.source_id, re.source_id).
  // Experience entries almost always come through the perspective chain
  // (bullets are the main derivation output for role sources), but the
  // LEFT JOIN keeps the query robust against direct-source entries too.
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
        COALESCE(bs.source_id, re.source_id) AS source_id,
        s.title AS source_title,
        sr.organization_id,
        sr.start_date,
        sr.end_date,
        sr.is_current,
        sr.work_arrangement,
        o.name AS org_name,
        oc.city AS org_city,
        oc.state AS org_state
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullets b ON b.id = p.bullet_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      LEFT JOIN source_roles sr ON sr.source_id = s.id
      LEFT JOIN organizations o ON o.id = sr.organization_id
      LEFT JOIN org_campuses oc ON oc.organization_id = o.id AND oc.is_headquarters = 1
      WHERE re.section_id = ?
      ORDER BY sr.is_current DESC, sr.start_date DESC, re.position ASC`
    )
    .all(sectionId) as ExperienceEntryRow[]

  // Group by organization_id (or org_name fallback), then sub-group by source_title (role)
  // Using organization_id prevents collision when two different orgs have the same name.
  const orgMap = new Map<string, Map<string, ExperienceEntryRow[]>>()

  for (const row of rows) {
    const orgKey = row.organization_id ?? row.org_name ?? 'Other'
    if (!orgMap.has(orgKey)) orgMap.set(orgKey, new Map())
    const roleMap = orgMap.get(orgKey)!
    // Role key: prefer the source title; fall back to a stable "untitled"
    // token so direct-source entries without a title still group per-source
    // instead of colliding across unrelated sources.
    const roleKey = row.source_title ?? `untitled:${row.source_id ?? row.entry_id}`
    if (!roleMap.has(roleKey)) roleMap.set(roleKey, [])
    roleMap.get(roleKey)!.push(row)
  }

  const groups: ExperienceGroup[] = []

  for (const [orgKey, roleMap] of orgMap) {
    const subheadings: ExperienceSubheading[] = []

    // Use first entry in the group to build the display string
    const firstEntry = roleMap.values().next().value![0]
    const orgDisplayName = buildOrgDisplayString(
      firstEntry.org_name,
      firstEntry.org_city,
      firstEntry.org_state,
      firstEntry.work_arrangement,
    )

    for (const [roleTitle, entries] of roleMap) {
      const first = entries[0]
      const dateRange = formatDateRange(first.start_date, first.end_date, !!first.is_current)

      const bullets: ExperienceBullet[] = entries.map(e => {
        // Only attach a source_chain when the full perspective-chain is
        // present. Direct-source entries (re.source_id set, perspective
        // null) omit source_chain since there's no bullet/perspective
        // provenance to point to — the entry itself is the only record.
        const hasChain =
          e.perspective_id !== null &&
          e.bullet_id !== null &&
          e.source_id !== null &&
          e.source_title !== null
        return {
          content: e.entry_content ?? e.perspective_content ?? '',
          entry_id: e.entry_id,
          source_chain: hasChain
            ? {
                source_id: e.source_id!,
                source_title: truncate(e.source_title!, 60),
                bullet_id: e.bullet_id!,
                bullet_preview: truncate(e.bullet_content ?? '', 60),
                perspective_id: e.perspective_id!,
                perspective_preview: truncate(e.perspective_content ?? '', 60),
              }
            : undefined,
          is_cloned: e.entry_content !== null,
        }
      })

      subheadings.push({
        id: syntheticUUID('subheading', `${orgKey}-${roleTitle}`),
        title: roleTitle.startsWith('untitled:') ? 'Untitled Role' : roleTitle,
        date_range: dateRange,
        source_id: first.source_id,
        bullets,
      })
    }

    groups.push({
      kind: 'experience_group',
      id: syntheticUUID('org', orgKey),
      organization: orgDisplayName,
      subheadings,
    })
  }

  return groups
}

function buildSkillItems(db: Database, sectionId: string): SkillGroup[] {
  // Check for orphaned resume_skills entries (skill_id points to nonexistent skill)
  const orphanCount = db
    .query(
      `SELECT COUNT(*) AS cnt
       FROM resume_skills rs
       LEFT JOIN skills s ON s.id = rs.skill_id
       WHERE rs.section_id = ? AND s.id IS NULL`
    )
    .get(sectionId) as { cnt: number }

  if (orphanCount.cnt > 0) {
    console.warn(`[resume-compiler] ${orphanCount.cnt} orphaned resume_skills entries in section ${sectionId} (skill_id FK missing). These are skipped.`)
  }

  const rows = db
    .query(
      `SELECT s.name AS skill_name, s.category
       FROM resume_skills rs
       JOIN skills s ON s.id = rs.skill_id
       WHERE rs.section_id = ?
       ORDER BY s.category ASC, rs.position ASC`
    )
    .all(sectionId) as Array<{ skill_name: string; category: string | null }>

  if (rows.length === 0) return []

  // Group by category (ordered by first appearance due to ORDER BY above)
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
  // Entries may reach their source via two paths:
  //   1. perspective-chain:  re → perspective → bullet → bullet_sources → source
  //   2. direct:             re.source_id → source
  // We LEFT JOIN the perspective chain and use COALESCE to pick whichever
  // source id is present, preferring the perspective-chain source when both
  // are set. This lets education entries added from sources without
  // derived perspectives still render with structured data.
  //
  // The display text (`degree`) falls back in this order:
  //   entry_content → perspective_content → source.title → ''
  // We include source.title so direct-source entries (no perspective,
  // no clone content) render the source's canonical title (e.g.
  // "Cloud Security") instead of showing as empty.
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        s.title AS source_title,
        COALESCE(bs.source_id, re.source_id) AS source_id,
        se.education_type,
        o.name AS institution,
        se.field,
        se.end_date,
        se.degree_level,
        se.degree_type,
        se.gpa,
        COALESCE(se.location,
          CASE
            WHEN oc.city IS NOT NULL AND oc.state IS NOT NULL THEN oc.city || ', ' || oc.state
            WHEN oc.city IS NOT NULL THEN oc.city
            WHEN oc.state IS NOT NULL THEN oc.state
            ELSE NULL
          END
        ) AS location,
        se.credential_id,
        o.name AS issuing_body,
        se.certificate_subtype,
        se.edu_description,
        se.organization_id,
        oc.name AS campus_name,
        oc.city AS campus_city,
        oc.state AS campus_state
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      LEFT JOIN source_education se ON se.source_id = s.id
      LEFT JOIN organizations o ON o.id = se.organization_id
      LEFT JOIN org_campuses oc ON oc.id = se.campus_id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_content: string | null
      source_title: string | null
      source_id: string | null
      education_type: string | null
      institution: string | null
      field: string | null
      end_date: string | null
      degree_level: string | null
      degree_type: string | null
      gpa: string | null
      location: string | null
      credential_id: string | null
      issuing_body: string | null
      certificate_subtype: string | null
      edu_description: string | null
      organization_id: string | null
      campus_name: string | null
      campus_city: string | null
      campus_state: string | null
    }>

  return rows.map(row => ({
    kind: 'education' as const,
    institution: row.institution ?? 'Unknown',
    degree: row.entry_content ?? row.perspective_content ?? row.source_title ?? '',
    date: row.end_date ? new Date(row.end_date).getFullYear().toString() : '',
    entry_id: row.entry_id,
    source_id: row.source_id,
    education_type: row.education_type ?? undefined,
    degree_level: row.degree_level,
    degree_type: row.degree_type,
    field: row.field ?? null,
    gpa: row.gpa,
    location: row.location,
    credential_id: row.credential_id,
    issuing_body: row.issuing_body,
    certificate_subtype: row.certificate_subtype,
    edu_description: row.edu_description,
    campus_name: row.campus_name ?? null,
    campus_city: row.campus_city ?? null,
    campus_state: row.campus_state ?? null,
  }))
}

function buildProjectItems(db: Database, sectionId: string): ProjectItem[] {
  // Dual-path source resolution: see buildEducationItems for rationale.
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        b.content AS bullet_content,
        COALESCE(bs.source_id, re.source_id) AS source_id,
        s.title AS source_title,
        sp.start_date,
        sp.end_date
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullets b ON b.id = p.bullet_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      LEFT JOIN source_projects sp ON sp.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string | null
      perspective_content: string | null
      bullet_id: string | null
      bullet_content: string | null
      source_id: string | null
      source_title: string | null
      start_date: string | null
      end_date: string | null
    }>

  // Group by source_title (project name). Direct-source entries without a
  // linked source get bucketed into a synthetic untitled group per entry so
  // they don't collide with each other.
  const projectMap = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.source_title ?? `untitled:${row.source_id ?? row.entry_id}`
    if (!projectMap.has(key)) projectMap.set(key, [])
    projectMap.get(key)!.push(row)
  }

  return Array.from(projectMap.entries()).map(([name, entries]) => ({
    kind: 'project' as const,
    name: name.startsWith('untitled:') ? 'Untitled Project' : name,
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map(e => {
      const hasChain =
        e.perspective_id !== null &&
        e.bullet_id !== null &&
        e.source_id !== null &&
        e.source_title !== null
      return {
        content: e.entry_content ?? e.perspective_content ?? '',
        entry_id: e.entry_id,
        source_chain: hasChain
          ? {
              source_id: e.source_id!,
              source_title: truncate(e.source_title!, 60),
              bullet_id: e.bullet_id!,
              bullet_preview: truncate(e.bullet_content ?? '', 60),
              perspective_id: e.perspective_id!,
              perspective_preview: truncate(e.perspective_content ?? '', 60),
            }
          : undefined,
        is_cloned: e.entry_content !== null,
      }
    }),
  }))
}

function buildClearanceItems(db: Database, sectionId: string): ClearanceItem[] {
  // Dual-path source resolution: see buildEducationItems for rationale.
  // Clearances historically came from sources that weren't linked to the
  // bullet/perspective derivation flow, so most clearance entries reach
  // source_clearances via re.source_id directly.
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        COALESCE(bs.source_id, re.source_id) AS source_id,
        sc.level,
        sc.polygraph,
        sc.status AS clearance_status
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      LEFT JOIN source_clearances sc ON sc.source_id = s.id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_content: string | null
      source_id: string | null
      level: string | null
      polygraph: string | null
      clearance_status: string | null
    }>

  return rows.map(row => {
    // Build clearance string from structured data if available, else fall
    // back to entry content (clone-mode or direct-source), else perspective
    // content (reference-mode entries).
    let content = row.entry_content ?? row.perspective_content ?? ''
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
  // Dual-path source resolution: see buildEducationItems for rationale.
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        b.content AS bullet_content,
        COALESCE(bs.source_id, re.source_id) AS source_id,
        s.title AS source_title,
        s.end_date
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullets b ON b.id = p.bullet_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string | null
      perspective_content: string | null
      bullet_id: string | null
      bullet_content: string | null
      source_id: string | null
      source_title: string | null
      end_date: string | null
    }>

  // Group by source_title (presentation name). Direct-source entries
  // without a linked source fall back to per-entry untitled keys.
  const presMap = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.source_title ?? `untitled:${row.source_id ?? row.entry_id}`
    if (!presMap.has(key)) presMap.set(key, [])
    presMap.get(key)!.push(row)
  }

  return Array.from(presMap.entries()).map(([title, entries]) => ({
    kind: 'presentation' as const,
    title: title.startsWith('untitled:') ? 'Untitled Presentation' : title,
    venue: '', // TODO: extract from source metadata when available
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map(e => {
      const hasChain =
        e.perspective_id !== null &&
        e.bullet_id !== null &&
        e.source_id !== null &&
        e.source_title !== null
      return {
        content: e.entry_content ?? e.perspective_content ?? '',
        entry_id: e.entry_id,
        source_chain: hasChain
          ? {
              source_id: e.source_id!,
              source_title: truncate(e.source_title!, 60),
              bullet_id: e.bullet_id!,
              bullet_preview: truncate(e.bullet_content ?? '', 60),
              perspective_id: e.perspective_id!,
              perspective_preview: truncate(e.perspective_content ?? '', 60),
            }
          : undefined,
        is_cloned: e.entry_content !== null,
      }
    }),
  }))
}

function buildCertificationItems(db: Database, sectionId: string): CertificationGroup[] {
  // Same dual-path source resolution as buildEducationItems — see that
  // function's comment for the reasoning. Certifications in particular
  // rarely have derived perspectives, so almost every cert entry reaches
  // its source via the direct re.source_id path.
  const rows = db
    .query(
      `SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        COALESCE(bs.source_id, re.source_id) AS source_id,
        s.title AS source_title,
        o.name AS institution,
        se.field,
        se.credential_id,
        se.end_date
      FROM resume_entries re
      LEFT JOIN perspectives p ON p.id = re.perspective_id
      LEFT JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      LEFT JOIN sources s ON s.id = COALESCE(bs.source_id, re.source_id)
      LEFT JOIN source_education se ON se.source_id = s.id
      LEFT JOIN organizations o ON o.id = se.organization_id
      WHERE re.section_id = ?
      ORDER BY re.position ASC`
    )
    .all(sectionId) as Array<{
      entry_id: string
      entry_content: string | null
      perspective_id: string | null
      perspective_content: string | null
      source_id: string | null
      source_title: string | null
      institution: string | null
      field: string | null
      credential_id: string | null
      end_date: string | null
    }>

  if (rows.length === 0) return []

  // Group by institution (issuing body). Fall back to source title when
  // the source isn't linked to an organization yet, then to "Other".
  // Display name picks `source_title` as the canonical cert name before
  // falling back to clone/perspective content — source.title is the
  // authoritative identifier for a cert (e.g. "AWS Certified SA"),
  // and entry_content is only set in explicit clone mode.
  const catMap = new Map<string, Array<{ name: string; entry_id: string; source_id: string | null }>>()

  for (const row of rows) {
    const label = row.institution ?? row.source_title ?? 'Other'
    if (!catMap.has(label)) catMap.set(label, [])
    catMap.get(label)!.push({
      name: row.entry_content ?? row.source_title ?? row.perspective_content ?? '',
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

/**
 * Build the organization display string for experience sections.
 *
 * Format: `{org_name}{ - location}{ (work_arrangement)}`
 *
 * Examples:
 *   - "Cisco - Remote (Contract)"
 *   - "Raytheon Intelligence & Space - Arlington, VA (Remote)"
 *   - "United States Air Force Reserve - National Capitol Region"
 *   - "Acme Corp" (no location, no arrangement)
 *   - "Other" (null org name)
 */
export function buildOrgDisplayString(
  orgName: string | null,
  city: string | null,
  state: string | null,
  workArrangement: string | null,
): string {
  const name = orgName ?? 'Other'

  // Build location string
  let location: string | null = null
  if (city && state) {
    location = `${city}, ${state}`
  } else if (city) {
    location = city
  } else if (state) {
    location = state
  }

  // Format work arrangement for display (capitalize first letter)
  let arrangement: string | null = null
  if (workArrangement) {
    arrangement = workArrangement.charAt(0).toUpperCase() + workArrangement.slice(1)
  }

  // Compose: "{name}{ - location}{ (arrangement)}"
  let result = name
  if (location) {
    result += ` - ${location}`
  }
  if (arrangement) {
    result += ` (${arrangement})`
  }

  return result
}
