import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// source sub-subcommands
// ---------------------------------------------------------------------------

const add = defineCommand({
  meta: { name: 'add', description: 'Add a new source' },
  args: {
    title: {
      type: 'string',
      description: 'Source title',
      required: true,
    },
    description: {
      type: 'string',
      description: 'Source description',
      required: true,
    },
    type: {
      type: 'string',
      description: 'Source type (role, project, education, clearance, general)',
      default: 'general',
    },
    // Role-specific
    org: {
      type: 'string',
      description: 'Organization ID (for role/project)',
    },
    'start-date': {
      type: 'string',
      description: 'Start date (YYYY-MM-DD)',
    },
    'end-date': {
      type: 'string',
      description: 'End date (YYYY-MM-DD)',
    },
    current: {
      type: 'boolean',
      description: 'Is current role/position',
    },
    arrangement: {
      type: 'string',
      description: 'Work arrangement (remote, hybrid, onsite)',
    },
    // Education-specific
    'edu-type': {
      type: 'string',
      description: 'Education type (degree, certificate, course, self_taught)',
    },
    'edu-org': {
      type: 'string',
      description: 'Education organization ID',
    },
    field: {
      type: 'string',
      description: 'Field of study',
    },
    'credential-id': {
      type: 'string',
      description: 'Credential ID',
    },
    // Clearance-specific
    level: {
      type: 'string',
      description: 'Clearance level',
    },
    polygraph: {
      type: 'string',
      description: 'Polygraph type (None, CI, Full Scope)',
    },
    'clearance-status': {
      type: 'string',
      description: 'Clearance status (active, inactive, expired)',
    },
    // Project-specific
    personal: {
      type: 'boolean',
      description: 'Is personal project',
    },
    url: {
      type: 'string',
      description: 'Project URL',
    },
  },
  async run({ args }) {
    const input: Record<string, unknown> = {
      title: args.title,
      description: args.description,
      source_type: args.type,
    }

    // Build extension object based on type
    if (args.type === 'role') {
      const role: Record<string, unknown> = {}
      if (args.org) role.organization_id = args.org
      if (args['start-date']) role.start_date = args['start-date']
      if (args['end-date']) role.end_date = args['end-date']
      if (args.current !== undefined) role.is_current = args.current
      if (args.arrangement) role.work_arrangement = args.arrangement
      input.role = role
    } else if (args.type === 'education') {
      const education: Record<string, unknown> = {}
      if (args['edu-type']) education.education_type = args['edu-type']
      if (args['edu-org']) education.organization_id = args['edu-org']
      if (args.field) education.field = args.field
      if (args['credential-id']) education.credential_id = args['credential-id']
      if (args['start-date']) education.start_date = args['start-date']
      if (args['end-date']) education.end_date = args['end-date']
      input.education = education
    } else if (args.type === 'clearance') {
      const clearance: Record<string, unknown> = {}
      if (args.level) clearance.level = args.level
      if (args.polygraph) clearance.polygraph = args.polygraph
      if (args['clearance-status']) clearance.status = args['clearance-status']
      input.clearance = clearance
    } else if (args.type === 'project') {
      const project: Record<string, unknown> = {}
      if (args.org) project.organization_id = args.org
      if (args.personal !== undefined) project.is_personal = args.personal
      if (args.url) project.url = args.url
      if (args['start-date']) project.start_date = args['start-date']
      if (args['end-date']) project.end_date = args['end-date']
      input.project = project
    }

    const result = await forge.sources.create(input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const s = result.data
    console.log(`Created source: ${s.title}`)
    console.log(`  ID:   ${s.id}`)
    console.log(`  Type: ${(s as any).source_type}`)
    console.log(`  Status: ${s.status}`)
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List all sources' },
  args: {
    status: {
      type: 'string',
      description: 'Filter by status (draft, approved, deriving)',
    },
    type: {
      type: 'string',
      description: 'Filter by source type (role, project, education, clearance, general)',
    },
    offset: {
      type: 'string',
      description: 'Pagination offset',
    },
    limit: {
      type: 'string',
      description: 'Pagination limit',
    },
  },
  async run({ args }) {
    const filter: Record<string, string | number> = {}
    if (args.status) filter.status = args.status
    if (args.type) filter.source_type = args.type
    if (args.offset) filter.offset = Number(args.offset)
    if (args.limit) filter.limit = Number(args.limit)

    const result = await forge.sources.list(
      Object.keys(filter).length > 0 ? (filter as any) : undefined,
    )
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const useJson = process.argv.includes('--json')

    if (useJson) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    if (result.data.length === 0) {
      console.log('No sources found.')
      return
    }

    // Table output — includes Type column
    const idW = 10
    const titleW = 28
    const typeW = 11
    const statusW = 11
    const createdW = 12

    const header = [
      'ID'.padEnd(idW),
      'Title'.padEnd(titleW),
      'Type'.padEnd(typeW),
      'Status'.padEnd(statusW),
      'Created'.padEnd(createdW),
    ].join('  ')

    const divider = [
      '\u2500'.repeat(idW),
      '\u2500'.repeat(titleW),
      '\u2500'.repeat(typeW),
      '\u2500'.repeat(statusW),
      '\u2500'.repeat(createdW),
    ].join('  ')

    console.log(header)
    console.log(divider)

    for (const s of result.data) {
      const id = s.id.length > 8 ? s.id.slice(0, 6) + '..' : s.id
      const title =
        s.title.length > titleW ? s.title.slice(0, titleW - 1) + '\u2026' : s.title
      const created = s.created_at.slice(0, 10)

      console.log(
        [
          id.padEnd(idW),
          title.padEnd(titleW),
          ((s as any).source_type ?? 'general').padEnd(typeW),
          s.status.padEnd(statusW),
          created.padEnd(createdW),
        ].join('  '),
      )
    }

    console.log(
      `\n${result.data.length} of ${result.pagination.total} sources`,
    )
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show details of a source' },
  args: {
    id: { type: 'positional', description: 'Source ID', required: true },
  },
  async run({ args }) {
    const result = await forge.sources.get(args.id)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const s = result.data as any

    const useJson = process.argv.includes('--json')
    if (useJson) {
      console.log(JSON.stringify(s, null, 2))
      return
    }

    console.log(`Source: ${s.title}`)
    console.log(`  ID:          ${s.id}`)
    console.log(`  Type:        ${s.source_type ?? 'general'}`)
    console.log(`  Status:      ${s.status}`)
    console.log(`  Description: ${s.description}`)
    console.log(`  Created:     ${s.created_at}`)
    console.log(`  Updated:     ${s.updated_at}`)

    // Show extension data based on type
    if (s.source_type === 'role' && s.role) {
      console.log(`  Organization:    ${s.role.organization_id ?? '(none)'}`)
      console.log(`  Start Date:      ${s.role.start_date ?? '(none)'}`)
      console.log(`  End Date:        ${s.role.end_date ?? '(none)'}`)
      console.log(`  Current:         ${s.role.is_current ? 'Yes' : 'No'}`)
      console.log(`  Arrangement:     ${s.role.work_arrangement ?? '(none)'}`)
    } else if (s.source_type === 'education' && s.education) {
      console.log(`  Education Type:  ${s.education.education_type}`)
      console.log(`  Organization:    ${s.education.organization_id ?? '(none)'}`)
      console.log(`  Field:           ${s.education.field ?? '(none)'}`)
      console.log(`  Credential ID:   ${s.education.credential_id ?? '(none)'}`)
    } else if (s.source_type === 'clearance' && s.clearance) {
      console.log(`  Level:           ${s.clearance.level}`)
      console.log(`  Polygraph:       ${s.clearance.polygraph ?? '(none)'}`)
      console.log(`  Status:          ${s.clearance.status ?? '(none)'}`)
    } else if (s.source_type === 'project' && s.project) {
      console.log(`  Organization:    ${s.project.organization_id ?? '(none)'}`)
      console.log(`  Personal:        ${s.project.is_personal ? 'Yes' : 'No'}`)
      console.log(`  URL:             ${s.project.url ?? '(none)'}`)
    }
  },
})

const edit = defineCommand({
  meta: { name: 'edit', description: 'Edit a source' },
  args: {
    id: { type: 'positional', description: 'Source ID', required: true },
    title: {
      type: 'string',
      description: 'New title',
    },
    description: {
      type: 'string',
      description: 'New description',
    },
    'start-date': {
      type: 'string',
      description: 'New start date (YYYY-MM-DD)',
    },
    'end-date': {
      type: 'string',
      description: 'New end date (YYYY-MM-DD)',
    },
  },
  async run({ args }) {
    const input: Record<string, string> = {}
    if (args.title) input.title = args.title
    if (args.description) input.description = args.description
    if (args['start-date']) input.start_date = args['start-date']
    if (args['end-date']) input.end_date = args['end-date']

    if (Object.keys(input).length === 0) {
      console.error('Error: No fields to update. Provide at least one flag.')
      process.exit(1)
    }

    const result = await forge.sources.update(args.id, input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const s = result.data
    console.log(`Updated source: ${s.title}`)
    console.log(`  ID:     ${s.id}`)
    console.log(`  Status: ${s.status}`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a source' },
  args: {
    id: { type: 'positional', description: 'Source ID', required: true },
  },
  async run({ args }) {
    const result = await forge.sources.delete(args.id)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Deleted source ${args.id}`)
  },
})

const deriveBullets = defineCommand({
  meta: { name: 'derive-bullets', description: 'Derive bullets from a source using AI' },
  args: {
    id: { type: 'positional', description: 'Source ID', required: true },
  },
  async run({ args }) {
    console.log('Deriving bullets...')

    const result = await forge.sources.deriveBullets(args.id)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const bullets = result.data

    const useJson = process.argv.includes('--json')
    if (useJson) {
      console.log(JSON.stringify(bullets, null, 2))
      return
    }

    console.log(`\nDerived ${bullets.length} bullet(s):\n`)
    for (const b of bullets) {
      const id = b.id.length > 8 ? b.id.slice(0, 6) + '..' : b.id
      console.log(`  [${id}] ${b.content}`)
    }
  },
})

// ---------------------------------------------------------------------------
// source command group
// ---------------------------------------------------------------------------

export const sourceCommand = defineCommand({
  meta: { name: 'source', description: 'Manage experience sources' },
  subCommands: {
    add,
    list,
    show,
    edit,
    delete: del,
    'derive-bullets': deriveBullets,
  },
})
