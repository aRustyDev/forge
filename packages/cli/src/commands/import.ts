import { defineCommand } from 'citty'
import { Database } from 'bun:sqlite'

// ── Types ───────────────────────────────────────────────────────────

interface ImportSummary {
  organizations: { imported: number; skipped: number; failed: number }
  skills: { imported: number; skipped: number; failed: number }
  languages: { imported: number; skipped: number; failed: number }
  roles: { imported: number; skipped: number; failed: number }
  education: { imported: number; skipped: number; failed: number }
  clearances: { imported: number; skipped: number; failed: number }
  bullets: { imported: number; skipped: number; failed: number }
  bullet_sources: { imported: number; skipped: number; failed: number }
  bullet_skills: { imported: number; skipped: number; failed: number }
  resumes: { imported: number; skipped: number; failed: number }
  perspectives: { imported: number; skipped: number; failed: number }
  resume_entries: { imported: number; skipped: number; failed: number }
}

function newCounter() {
  return { imported: 0, skipped: 0, failed: 0 }
}

// ── UUID helper ─────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ── Import map helpers ──────────────────────────────────────────────

function getForgeId(forgeDb: Database, entityType: string, v1Id: number): string | null {
  const row = forgeDb.query(
    'SELECT forge_id FROM v1_import_map WHERE v1_entity_type = ? AND v1_id = ?'
  ).get(entityType, v1Id) as { forge_id: string } | null
  return row?.forge_id ?? null
}

function recordMapping(forgeDb: Database, entityType: string, v1Id: number, forgeId: string) {
  forgeDb.query(
    'INSERT INTO v1_import_map (v1_entity_type, v1_id, forge_id) VALUES (?, ?, ?)'
  ).run(entityType, v1Id, forgeId)
}

// ── Import functions ────────────────────────────────────────────────

function importOrganizations(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing organizations...')
  const rows = v1.query('SELECT * FROM organizations').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'organization', row.id)
      if (existing) {
        summary.organizations.skipped++
        continue
      }

      const id = uuid()
      forge.query(`
        INSERT INTO organizations (
          id, name, org_type, industry, size, worked,
          employment_type, location, headquarters, website,
          linkedin_url, glassdoor_url, glassdoor_rating,
          reputation_notes, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        row.name,
        row.org_type ?? 'company',
        row.industry ?? null,
        row.size ?? null,
        row.worked ? 1 : 0,
        row.employment_type ?? null,
        row.location ?? null,
        row.headquarters ?? null,
        row.website ?? null,
        row.linkedin_url ?? null,
        row.glassdoor_url ?? null,
        row.glassdoor_rating ?? null,
        row.reputation_notes ?? null,
        row.notes ?? null,
        now(),
        now(),
      )
      recordMapping(forge, 'organization', row.id, id)
      summary.organizations.imported++
    } catch (err) {
      console.error(`    Failed to import organization ${row.id} (${row.name}): ${err}`)
      summary.organizations.failed++
    }
  }
  console.log(`    ${summary.organizations.imported} imported, ${summary.organizations.skipped} skipped, ${summary.organizations.failed} failed`)
}

function importSkills(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing skills...')
  const rows = v1.query('SELECT * FROM skills').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'skill', row.id)
      if (existing) {
        summary.skills.skipped++
        continue
      }

      const id = uuid()
      forge.query(`
        INSERT INTO skills (id, name, category, notes, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, row.name, row.category ?? null, row.notes ?? null, now())
      recordMapping(forge, 'skill', row.id, id)
      summary.skills.imported++
    } catch (err) {
      console.error(`    Failed to import skill ${row.id} (${row.name}): ${err}`)
      summary.skills.failed++
    }
  }
  console.log(`    ${summary.skills.imported} imported, ${summary.skills.skipped} skipped, ${summary.skills.failed} failed`)
}

function importLanguages(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing languages as skills...')
  const rows = v1.query('SELECT * FROM languages').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'language', row.id)
      if (existing) {
        summary.languages.skipped++
        continue
      }

      const id = uuid()
      // Proficiency info stored in notes
      const notes = [
        row.proficiency ? `Proficiency: ${row.proficiency}` : null,
        row.reading_proficiency ? `Reading: ${row.reading_proficiency}` : null,
        row.writing_proficiency ? `Writing: ${row.writing_proficiency}` : null,
        row.certification ? `Certification: ${row.certification}` : null,
        row.notes,
      ].filter(Boolean).join('. ')

      forge.query(`
        INSERT INTO skills (id, name, category, notes, created_at)
        VALUES (?, ?, 'language', ?, ?)
      `).run(id, row.name, notes || null, now())
      recordMapping(forge, 'language', row.id, id)
      summary.languages.imported++
    } catch (err) {
      console.error(`    Failed to import language ${row.id} (${row.name}): ${err}`)
      summary.languages.failed++
    }
  }
  console.log(`    ${summary.languages.imported} imported, ${summary.languages.skipped} skipped, ${summary.languages.failed} failed`)
}

function importRoles(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing roles as sources + source_roles...')
  const rows = v1.query('SELECT * FROM roles').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'role', row.id)
      if (existing) {
        summary.roles.skipped++
        continue
      }

      const id = uuid()

      // Generate source description by concatenating linked bullet contents
      const bulletContents = v1.query(`
        SELECT b.content FROM bullets b
        JOIN bullet_roles br ON b.id = br.bullet_id
        WHERE br.role_id = ?
        ORDER BY b.id
      `).all(row.id) as any[]

      const description = bulletContents.length > 0
        ? bulletContents.map((b: any) => b.content).join('\n\n')
        : row.notes ?? `Role: ${row.title}`

      // Map organization_id via import map
      let orgId: string | null = null
      if (row.organization_id) {
        orgId = getForgeId(forge, 'organization', row.organization_id)
      }

      // Create source (base row)
      forge.query(`
        INSERT INTO sources (
          id, title, description, source_type, notes,
          status, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'role', ?, 'approved', 'human', ?, ?)
      `).run(id, row.title, description, row.notes ?? null, now(), now())

      // Create source_roles extension
      forge.query(`
        INSERT INTO source_roles (
          source_id, organization_id, start_date, end_date,
          is_current, work_arrangement, base_salary, total_comp_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        orgId,
        row.start_date ?? null,
        row.end_date ?? null,
        row.is_current ? 1 : 0,
        row.work_arrangement ?? null,
        row.base_salary ?? null,
        row.total_comp_notes ?? null,
      )

      recordMapping(forge, 'role', row.id, id)
      summary.roles.imported++
    } catch (err) {
      console.error(`    Failed to import role ${row.id} (${row.title}): ${err}`)
      summary.roles.failed++
    }
  }
  console.log(`    ${summary.roles.imported} imported, ${summary.roles.skipped} skipped, ${summary.roles.failed} failed`)
}

function importEducation(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing education as sources + source_education...')
  const rows = v1.query('SELECT * FROM education').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'education', row.id)
      if (existing) {
        summary.education.skipped++
        continue
      }

      const id = uuid()

      // Description from notes or generated
      const description = row.notes ?? `${row.type}: ${row.name}${row.institution ? ' at ' + row.institution : ''}`

      // education_type mapping
      const educationType = row.type === 'certificate' ? 'certificate'
        : row.type === 'degree' ? 'degree'
        : row.type === 'course' ? 'course'
        : row.type === 'self_taught' ? 'self_taught'
        : 'certificate'  // fallback

      // issuing_body derived from institution for certs
      const issuingBody = row.type === 'certificate' ? row.institution : null

      forge.query(`
        INSERT INTO sources (
          id, title, description, source_type, notes,
          status, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'education', ?, 'approved', 'human', ?, ?)
      `).run(id, row.name, description, row.notes ?? null, now(), now())

      forge.query(`
        INSERT INTO source_education (
          source_id, education_type, institution, field,
          start_date, end_date, is_in_progress,
          credential_id, expiration_date, issuing_body, url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        educationType,
        row.institution ?? null,
        row.field ?? null,
        row.start_date ?? null,
        row.end_date ?? null,
        row.is_in_progress ? 1 : 0,
        row.credential_id ?? null,
        row.expiration_date ?? null,
        issuingBody,
        row.url ?? null,
      )

      recordMapping(forge, 'education', row.id, id)
      summary.education.imported++
    } catch (err) {
      console.error(`    Failed to import education ${row.id} (${row.name}): ${err}`)
      summary.education.failed++
    }
  }
  console.log(`    ${summary.education.imported} imported, ${summary.education.skipped} skipped, ${summary.education.failed} failed`)
}

function importClearances(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing clearances as sources + source_clearances...')
  const rows = v1.query('SELECT * FROM clearances').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'clearance', row.id)
      if (existing) {
        summary.clearances.skipped++
        continue
      }

      const id = uuid()

      const title = `${row.level} Security Clearance`
      const description = row.notes ?? `${row.level} clearance${row.polygraph ? ' with ' + row.polygraph + ' polygraph' : ''}`

      forge.query(`
        INSERT INTO sources (
          id, title, description, source_type, notes,
          status, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'clearance', ?, 'approved', 'human', ?, ?)
      `).run(id, title, description, row.notes ?? null, now(), now())

      forge.query(`
        INSERT INTO source_clearances (
          source_id, level, polygraph, status,
          sponsoring_agency, investigation_date,
          adjudication_date, reinvestigation_date, read_on
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        row.level,
        row.polygraph ?? null,
        row.status ?? null,
        row.sponsoring_agency ?? null,
        row.investigation_date ?? null,
        row.adjudication_date ?? null,
        row.reinvestigation_date ?? null,
        row.read_on ?? null,
      )

      recordMapping(forge, 'clearance', row.id, id)
      summary.clearances.imported++
    } catch (err) {
      console.error(`    Failed to import clearance ${row.id}: ${err}`)
      summary.clearances.failed++
    }
  }
  console.log(`    ${summary.clearances.imported} imported, ${summary.clearances.skipped} skipped, ${summary.clearances.failed} failed`)
}

function importBullets(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing bullets...')
  const rows = v1.query('SELECT * FROM bullets').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'bullet', row.id)
      if (existing) {
        summary.bullets.skipped++
        continue
      }

      const id = uuid()

      // Get primary source description for source_content_snapshot
      // Find the primary role for this bullet
      const primaryRole = v1.query(`
        SELECT r.title, r.notes FROM bullet_roles br
        JOIN roles r ON br.role_id = r.id
        WHERE br.bullet_id = ? AND br.is_primary = 1
        LIMIT 1
      `).get(row.id) as any | null

      // If no primary role, try any role
      const anyRole = primaryRole ?? (v1.query(`
        SELECT r.title, r.notes FROM bullet_roles br
        JOIN roles r ON br.role_id = r.id
        WHERE br.bullet_id = ?
        LIMIT 1
      `).get(row.id) as any | null)

      // Snapshot is primary source's description at import time
      const snapshot = anyRole?.notes ?? anyRole?.title ?? row.content.slice(0, 100)

      // v1 framing values become domain on bullets
      const domain = row.framing ?? null

      forge.query(`
        INSERT INTO bullets (
          id, content, source_content_snapshot,
          domain, notes, status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'approved', ?)
      `).run(
        id,
        row.content,
        snapshot,
        domain,
        row.notes ?? null,
        now(),
      )

      recordMapping(forge, 'bullet', row.id, id)
      summary.bullets.imported++
    } catch (err) {
      console.error(`    Failed to import bullet ${row.id}: ${err}`)
      summary.bullets.failed++
    }
  }
  console.log(`    ${summary.bullets.imported} imported, ${summary.bullets.skipped} skipped, ${summary.bullets.failed} failed`)
}

function importBulletSources(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing bullet_sources from bullet_roles...')

  // bullet_roles -> bullet_sources
  const roleRows = v1.query('SELECT * FROM bullet_roles').all() as any[]
  for (const row of roleRows) {
    try {
      const bulletId = getForgeId(forge, 'bullet', row.bullet_id)
      const sourceId = getForgeId(forge, 'role', row.role_id)

      if (!bulletId || !sourceId) {
        console.error(`    Skipping bullet_role (${row.bullet_id}, ${row.role_id}): missing mapping`)
        summary.bullet_sources.failed++
        continue
      }

      // Check if already exists (idempotency)
      const exists = forge.query(
        'SELECT 1 FROM bullet_sources WHERE bullet_id = ? AND source_id = ?'
      ).get(bulletId, sourceId)
      if (exists) {
        summary.bullet_sources.skipped++
        continue
      }

      forge.query(`
        INSERT INTO bullet_sources (bullet_id, source_id, is_primary)
        VALUES (?, ?, ?)
      `).run(bulletId, sourceId, row.is_primary ? 1 : 0)
      summary.bullet_sources.imported++
    } catch (err) {
      console.error(`    Failed to import bullet_role (${row.bullet_id}, ${row.role_id}): ${err}`)
      summary.bullet_sources.failed++
    }
  }

  // bullet_education -> bullet_sources (is_primary = 0)
  // Check if this table has any data
  try {
    const eduRows = v1.query('SELECT * FROM bullet_education').all() as any[]
    for (const row of eduRows) {
      try {
        const bulletId = getForgeId(forge, 'bullet', row.bullet_id)
        const sourceId = getForgeId(forge, 'education', row.education_id)

        if (!bulletId || !sourceId) {
          summary.bullet_sources.failed++
          continue
        }

        const exists = forge.query(
          'SELECT 1 FROM bullet_sources WHERE bullet_id = ? AND source_id = ?'
        ).get(bulletId, sourceId)
        if (exists) {
          summary.bullet_sources.skipped++
          continue
        }

        forge.query(`
          INSERT INTO bullet_sources (bullet_id, source_id, is_primary)
          VALUES (?, ?, 0)
        `).run(bulletId, sourceId)
        summary.bullet_sources.imported++
      } catch (err) {
        summary.bullet_sources.failed++
      }
    }
  } catch {
    // bullet_education table may not exist or have no data
  }

  console.log(`    ${summary.bullet_sources.imported} imported, ${summary.bullet_sources.skipped} skipped, ${summary.bullet_sources.failed} failed`)
}

function importBulletSkills(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing bullet_skills...')
  const rows = v1.query('SELECT * FROM bullet_skills').all() as any[]

  for (const row of rows) {
    try {
      const bulletId = getForgeId(forge, 'bullet', row.bullet_id)
      const skillId = getForgeId(forge, 'skill', row.skill_id)

      if (!bulletId || !skillId) {
        summary.bullet_skills.failed++
        continue
      }

      const exists = forge.query(
        'SELECT 1 FROM bullet_skills WHERE bullet_id = ? AND skill_id = ?'
      ).get(bulletId, skillId)
      if (exists) {
        summary.bullet_skills.skipped++
        continue
      }

      forge.query(`
        INSERT INTO bullet_skills (bullet_id, skill_id)
        VALUES (?, ?)
      `).run(bulletId, skillId)
      summary.bullet_skills.imported++
    } catch (err) {
      summary.bullet_skills.failed++
    }
  }
  console.log(`    ${summary.bullet_skills.imported} imported, ${summary.bullet_skills.skipped} skipped, ${summary.bullet_skills.failed} failed`)
}

function importResumes(v1: Database, forge: Database, summary: ImportSummary) {
  console.log('\n  Importing resumes...')
  const rows = v1.query('SELECT * FROM resumes').all() as any[]

  for (const row of rows) {
    try {
      const existing = getForgeId(forge, 'resume', row.id)
      if (existing) {
        summary.resumes.skipped++
        continue
      }

      const id = uuid()

      // v1 target_company -> target_employer
      // archetype inferred from name or set to empty string
      const archetype = inferArchetypeFromName(row.name) ?? ''

      forge.query(`
        INSERT INTO resumes (
          id, name, target_role, target_employer,
          archetype, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).run(
        id,
        row.name,
        row.target_role ?? '',
        row.target_company ?? '',
        archetype,
        row.notes ?? null,
        now(),
        now(),
      )

      recordMapping(forge, 'resume', row.id, id)
      summary.resumes.imported++
    } catch (err) {
      console.error(`    Failed to import resume ${row.id} (${row.name}): ${err}`)
      summary.resumes.failed++
    }
  }
  console.log(`    ${summary.resumes.imported} imported, ${summary.resumes.skipped} skipped, ${summary.resumes.failed} failed`)
}

/**
 * Create synthetic identity perspectives for resume_bullets.
 *
 * For each v1 resume_bullet, we need a perspective in between (Forge requires
 * the derivation chain: source -> bullet -> perspective -> resume_entry).
 *
 * Synthetic perspective:
 * - content = bullet content (identity transformation)
 * - bullet_content_snapshot = bullet content
 * - framing = 'accomplishment' (default)
 * - target_archetype = null (not targeted)
 * - domain = bullet's domain/framing value
 * - status = 'approved'
 */
function importResumeBulletsAsSyntheticEntries(
  v1: Database, forge: Database, summary: ImportSummary,
) {
  console.log('\n  Creating synthetic perspectives for resume_bullets...')
  const rows = v1.query('SELECT * FROM resume_bullets ORDER BY resume_id, position').all() as any[]

  for (const row of rows) {
    try {
      const resumeId = getForgeId(forge, 'resume', row.resume_id)
      const bulletId = getForgeId(forge, 'bullet', row.bullet_id)

      if (!resumeId || !bulletId) {
        console.error(`    Skipping resume_bullet (${row.resume_id}, ${row.bullet_id}): missing mapping`)
        summary.perspectives.failed++
        summary.resume_entries.failed++
        continue
      }

      // Check if we already created a synthetic perspective for this combination
      // Use a compound key: resume_id * 10000 + bullet_id
      const mapKey = row.resume_id * 10000 + row.bullet_id
      const existingPerspId = getForgeId(forge, 'resume_bullet_perspective', mapKey)
      const existingEntryId = getForgeId(forge, 'resume_bullet_entry', mapKey)

      if (existingPerspId && existingEntryId) {
        summary.perspectives.skipped++
        summary.resume_entries.skipped++
        continue
      }

      // Get bullet content for the synthetic perspective
      const bullet = forge.query('SELECT content, domain FROM bullets WHERE id = ?').get(bulletId) as any
      if (!bullet) {
        summary.perspectives.failed++
        summary.resume_entries.failed++
        continue
      }

      // Step 1: Create synthetic identity perspective
      const perspId = uuid()

      if (!existingPerspId) {
        forge.query(`
          INSERT INTO perspectives (
            id, bullet_id, content, bullet_content_snapshot,
            target_archetype, domain, framing,
            notes, status, created_at
          ) VALUES (?, ?, ?, ?, NULL, ?, 'accomplishment', NULL, 'approved', ?)
        `).run(
          perspId,
          bulletId,
          bullet.content,       // identity: same as bullet
          bullet.content,       // snapshot matches
          bullet.domain ?? null,
          now(),
        )
        recordMapping(forge, 'resume_bullet_perspective', mapKey, perspId)
        summary.perspectives.imported++
      }

      const finalPerspId = existingPerspId ?? perspId

      // Step 2: Create resume_entry referencing this perspective
      if (!existingEntryId) {
        const entryId = uuid()

        // v1 sections (ai_engineering, devops, government, etc.) all map to work_history
        // Original section value preserved in notes
        const v1Section = row.section ?? 'work_history'
        const section = 'work_history'
        const entryNotes = v1Section !== 'work_history'
          ? `v1_section: ${v1Section}`
          : null

        forge.query(`
          INSERT INTO resume_entries (
            id, resume_id, perspective_id, content,
            perspective_content_snapshot, section, position,
            notes, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
        `).run(
          entryId,
          resumeId,
          finalPerspId,
          section,
          row.position ?? 0,
          entryNotes,
          now(),
          now(),
        )
        recordMapping(forge, 'resume_bullet_entry', mapKey, entryId)
        summary.resume_entries.imported++
      }
    } catch (err) {
      console.error(`    Failed to import resume_bullet (${row.resume_id}, ${row.bullet_id}): ${err}`)
      summary.perspectives.failed++
      summary.resume_entries.failed++
    }
  }
  console.log(`    Perspectives: ${summary.perspectives.imported} imported, ${summary.perspectives.skipped} skipped, ${summary.perspectives.failed} failed`)
  console.log(`    Entries: ${summary.resume_entries.imported} imported, ${summary.resume_entries.skipped} skipped, ${summary.resume_entries.failed} failed`)
}

// ── Archetype inference ─────────────────────────────────────────────

function inferArchetypeFromName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine learning')) {
    return 'agentic-ai'
  }
  if (lower.includes('security') || lower.includes('cyber')) {
    return 'security-engineer'
  }
  if (lower.includes('devops') || lower.includes('platform') || lower.includes('sre')) {
    return 'platform-engineer'
  }
  if (lower.includes('cloud') || lower.includes('infrastructure')) {
    return 'cloud-engineer'
  }
  return null
}

// ── Main import command ─────────────────────────────────────────────

const v1Import = defineCommand({
  meta: { name: 'v1', description: 'Import data from v1 SQLite database' },
  args: {
    path: {
      type: 'positional',
      description: 'Path to v1 SQLite database file',
      required: true,
    },
    'forge-db': {
      type: 'string',
      description: 'Path to Forge database (default: from FORGE_DB_PATH env)',
    },
  },
  async run({ args }) {
    const v1Path = args.path
    const forgeDbPath = args['forge-db'] ?? process.env.FORGE_DB_PATH

    if (!forgeDbPath) {
      console.error('Error: Forge database path required. Set FORGE_DB_PATH or use --forge-db.')
      process.exit(1)
    }

    console.log(`\nForge v1 Import`)
    console.log(`  v1 database:    ${v1Path}`)
    console.log(`  Forge database: ${forgeDbPath}`)

    // Open databases
    let v1: Database
    try {
      v1 = new Database(v1Path, { readonly: true })
    } catch (err) {
      console.error(`Error: Could not open v1 database at ${v1Path}: ${err}`)
      process.exit(1)
    }

    let forgeDb: Database
    try {
      forgeDb = new Database(forgeDbPath)
    } catch (err) {
      console.error(`Error: Could not open Forge database at ${forgeDbPath}: ${err}`)
      v1.close()
      process.exit(1)
    }

    // Enable WAL mode for better write performance
    forgeDb.exec('PRAGMA journal_mode = WAL')
    forgeDb.exec('PRAGMA foreign_keys = ON')

    const summary: ImportSummary = {
      organizations: newCounter(),
      skills: newCounter(),
      languages: newCounter(),
      roles: newCounter(),
      education: newCounter(),
      clearances: newCounter(),
      bullets: newCounter(),
      bullet_sources: newCounter(),
      bullet_skills: newCounter(),
      resumes: newCounter(),
      perspectives: newCounter(),
      resume_entries: newCounter(),
    }

    try {
      console.log('\nStarting import...')

      // Migration order from spec section 3:
      // 1. organizations (no dependencies)
      importOrganizations(v1, forgeDb, summary)

      // 2. skills + languages as skills (no dependencies)
      importSkills(v1, forgeDb, summary)
      importLanguages(v1, forgeDb, summary)

      // 3. sources + source_roles (depends on organizations)
      importRoles(v1, forgeDb, summary)

      // 4. sources + source_education
      importEducation(v1, forgeDb, summary)

      // 5. sources + source_clearances
      importClearances(v1, forgeDb, summary)

      // 6. bullets (no source_id, just the bullet itself)
      importBullets(v1, forgeDb, summary)

      // 7. bullet_sources junction (depends on bullets + sources)
      importBulletSources(v1, forgeDb, summary)

      // 8. bullet_skills (depends on bullets + skills)
      importBulletSkills(v1, forgeDb, summary)

      // 9. resumes (no data dependencies)
      importResumes(v1, forgeDb, summary)

      // 10-11. Synthetic perspectives + resume_entries (depends on resumes + bullets)
      importResumeBulletsAsSyntheticEntries(v1, forgeDb, summary)

      // Print summary
      console.log('\n' + '='.repeat(60))
      console.log('Import Summary')
      console.log('='.repeat(60))

      const entries = Object.entries(summary) as [string, { imported: number; skipped: number; failed: number }][]
      const maxLabel = Math.max(...entries.map(([k]) => k.length))

      for (const [entity, counts] of entries) {
        const total = counts.imported + counts.skipped + counts.failed
        if (total === 0) continue
        const label = entity.padEnd(maxLabel)
        console.log(
          `  ${label}  ${String(counts.imported).padStart(4)} imported  ${String(counts.skipped).padStart(4)} skipped  ${String(counts.failed).padStart(4)} failed`,
        )
      }

      const totalImported = entries.reduce((sum, [, c]) => sum + c.imported, 0)
      const totalFailed = entries.reduce((sum, [, c]) => sum + c.failed, 0)

      console.log('')
      if (totalFailed > 0) {
        console.log(`  Total: ${totalImported} imported, ${totalFailed} failed`)
        console.log('  Some entities failed to import. Check errors above.')
      } else {
        console.log(`  Total: ${totalImported} entities imported successfully.`)
      }
      console.log('')
    } finally {
      v1.close()
      forgeDb.close()
    }
  },
})

export const importCommand = defineCommand({
  meta: { name: 'import', description: 'Import data from external sources' },
  subCommands: {
    v1: v1Import,
  },
})
