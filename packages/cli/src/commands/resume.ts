import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// Helper: truncate a string and add ellipsis
// ---------------------------------------------------------------------------

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 3) + '...'
}

// ---------------------------------------------------------------------------
// resume sub-subcommands
// ---------------------------------------------------------------------------

const create = defineCommand({
  meta: { name: 'create', description: 'Create a new resume' },
  args: {
    name: { type: 'string', description: 'Resume name', required: true },
    role: { type: 'string', description: 'Target role', required: true },
    employer: { type: 'string', description: 'Target employer', required: true },
    archetype: { type: 'string', description: 'Target archetype', required: true },
  },
  async run({ args }) {
    const result = await forge.resumes.create({
      name: args.name,
      target_role: args.role,
      target_employer: args.employer,
      archetype: args.archetype,
    })

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    const r = result.data
    console.log(`Created resume: ${r.name}`)
    console.log(`  ID:        ${r.id}`)
    console.log(`  Role:      ${r.target_role}`)
    console.log(`  Employer:  ${r.target_employer}`)
    console.log(`  Archetype: ${r.archetype}`)
    console.log(`  Status:    ${r.status}`)
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List all resumes' },
  args: {
    offset: { type: 'string', description: 'Pagination offset', default: '0' },
    limit: { type: 'string', description: 'Pagination limit', default: '20' },
  },
  async run({ args }) {
    const result = await forge.resumes.list({
      offset: Number(args.offset),
      limit: Number(args.limit),
    })

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ data: result.data, pagination: result.pagination }, null, 2))
      return
    }

    if (result.data.length === 0) {
      console.log('No resumes found.')
      return
    }

    // Table header
    const header = `${'ID'.padEnd(10)} ${'Name'.padEnd(30)} ${'Target Role'.padEnd(25)} ${'Archetype'.padEnd(18)} Status`
    console.log(header)
    console.log('-'.repeat(header.length))

    for (const r of result.data) {
      const id = r.id.slice(0, 8)
      console.log(
        `${id.padEnd(10)} ${truncate(r.name, 30).padEnd(30)} ${truncate(r.target_role, 25).padEnd(25)} ${truncate(r.archetype, 18).padEnd(18)} ${r.status}`,
      )
    }

    const p = result.pagination
    console.log(`\nShowing ${p.offset + 1}-${Math.min(p.offset + p.limit, p.total)} of ${p.total}`)
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show details of a resume' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
  },
  async run({ args }) {
    const result = await forge.resumes.get(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    const r = result.data
    console.log(`Resume: ${r.name}`)
    console.log(`  ID:         ${r.id}`)
    console.log(`  Role:       ${r.target_role}`)
    console.log(`  Employer:   ${r.target_employer}`)
    console.log(`  Archetype:  ${r.archetype}`)
    console.log(`  Status:     ${r.status}`)

    const sectionNames = Object.keys(r.sections)
    if (sectionNames.length === 0) {
      console.log('\n  Sections: (none)')
      return
    }

    console.log('\n  Sections:')
    for (const section of sectionNames) {
      const entries = r.sections[section].sort((a, b) => a.position - b.position)
      console.log(`    ${section} (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}):`)
      for (let i = 0; i < entries.length; i++) {
        const content = entries[i].content ?? entries[i].perspective_content_snapshot ?? '(reference mode)'
        console.log(`      ${i + 1}. ${truncate(content, 70)}`)
      }
    }
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a resume' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
  },
  async run({ args }) {
    const result = await forge.resumes.delete(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ deleted: args.id }, null, 2))
      return
    }

    console.log(`Deleted resume ${args.id}`)
  },
})

const addEntry = defineCommand({
  meta: { name: 'add-entry', description: 'Add an entry to a resume section' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
    perspectiveId: { type: 'string', description: 'Perspective ID to add', required: true, alias: ['p'] },
    section: { type: 'string', description: 'Resume section name', required: true, alias: ['s'] },
    position: { type: 'string', description: 'Position within section (0-indexed)', default: '0' },
  },
  async run({ args }) {
    const result = await forge.resumes.addEntry(args.id, {
      perspective_id: args.perspectiveId,
      section: args.section,
      position: Number(args.position),
    })

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Added entry ${result.data.id} to resume ${args.id} in section "${args.section}" at position ${args.position}`)
  },
})

const removeEntry = defineCommand({
  meta: { name: 'remove-entry', description: 'Remove an entry from a resume' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
    entryId: { type: 'string', description: 'Entry ID to remove', required: true, alias: ['e'] },
  },
  async run({ args }) {
    const result = await forge.resumes.removeEntry(args.id, args.entryId)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ removed: true, resume_id: args.id, entry_id: args.entryId }, null, 2))
      return
    }

    console.log(`Removed entry ${args.entryId} from resume ${args.id}`)
  },
})

const reorder = defineCommand({
  meta: { name: 'reorder', description: 'Reorder entries within a resume' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
  },
  async run() {
    console.log('Interactive reorder not yet implemented. Use the WebUI for drag-and-drop reordering.')
  },
})

// ---------------------------------------------------------------------------
// Gap analysis — typed locally to match the richer API response shape
// ---------------------------------------------------------------------------

interface GapMissingDomain {
  type: 'missing_domain_coverage'
  domain: string
  description: string
  available_bullets: Array<{ id: string; content: string; source_title: string }>
  recommendation: string
}

interface GapThinCoverage {
  type: 'thin_coverage'
  domain: string
  current_count: number
  description: string
  recommendation: string
}

interface GapUnusedBullet {
  type: 'unused_bullet'
  bullet_id: string
  bullet_content: string
  source_title: string
  description: string
  recommendation: string
}

type Gap = GapMissingDomain | GapThinCoverage | GapUnusedBullet

interface RichGapAnalysis {
  resume_id: string
  archetype: string
  target_role: string
  target_employer: string
  gaps: Gap[]
  coverage_summary: {
    perspectives_included: number
    total_approved_perspectives_for_archetype: number
    domains_represented: string[]
    domains_missing: string[]
  }
}

const gaps = defineCommand({
  meta: { name: 'gaps', description: 'Analyze gaps in a resume' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
  },
  async run({ args }) {
    const result = await forge.resumes.gaps(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    // The API returns the richer GapAnalysis shape from @forge/core
    const analysis = result.data as unknown as RichGapAnalysis

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(analysis, null, 2))
      return
    }

    console.log(`Gap Analysis: ${analysis.target_role} - ${analysis.target_employer} (archetype: ${analysis.archetype})`)
    console.log()

    const cs = analysis.coverage_summary
    console.log(`  Perspectives included: ${cs.perspectives_included}`)
    console.log(`  Domains covered: ${cs.domains_represented.length > 0 ? cs.domains_represented.join(', ') : '(none)'}`)
    console.log(`  Domains missing: ${cs.domains_missing.length > 0 ? cs.domains_missing.join(', ') : '(none)'}`)
    console.log()

    // Group gaps by type
    const missingDomain = analysis.gaps.filter((g): g is GapMissingDomain => g.type === 'missing_domain_coverage')
    const thinCoverage = analysis.gaps.filter((g): g is GapThinCoverage => g.type === 'thin_coverage')
    const unusedBullets = analysis.gaps.filter((g): g is GapUnusedBullet => g.type === 'unused_bullet')

    // Missing domain coverage
    console.log('  Missing domain coverage:')
    if (missingDomain.length === 0) {
      console.log('    (none)')
    } else {
      for (const gap of missingDomain) {
        const bulletNote = gap.available_bullets.length > 0
          ? `${gap.available_bullets.length} bullet${gap.available_bullets.length === 1 ? '' : 's'} available for derivation`
          : 'no bullets available'
        console.log(`    \u2022 ${gap.domain} \u2014 ${bulletNote}`)
      }
    }
    console.log()

    // Thin coverage
    console.log('  Thin coverage:')
    if (thinCoverage.length === 0) {
      console.log('    (none)')
    } else {
      for (const gap of thinCoverage) {
        console.log(`    \u2022 ${gap.domain} \u2014 ${gap.current_count} perspective${gap.current_count === 1 ? '' : 's'} (${gap.description})`)
      }
    }
    console.log()

    // Unused bullets
    console.log(`  Unused bullets (no perspective for ${analysis.archetype}):`)
    if (unusedBullets.length === 0) {
      console.log('    (none)')
    } else {
      for (const gap of unusedBullets) {
        console.log(`    \u2022 "${truncate(gap.bullet_content, 60)}" (source: ${gap.source_title})`)
      }
    }
  },
})

const exportCmd = defineCommand({
  meta: { name: 'export', description: 'Export a resume to a file' },
  args: {
    id: { type: 'positional', description: 'Resume ID', required: true },
  },
  async run() {
    console.log('Resume export is not yet implemented (501).')
  },
})

// ---------------------------------------------------------------------------
// resume command group
// ---------------------------------------------------------------------------

export const resumeCommand = defineCommand({
  meta: { name: 'resume', description: 'Manage resumes' },
  subCommands: {
    create,
    list,
    show,
    delete: del,
    'add-entry': addEntry,
    'remove-entry': removeEntry,
    reorder,
    gaps,
    export: exportCmd,
  },
})
