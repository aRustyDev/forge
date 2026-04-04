import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// org sub-subcommands
// ---------------------------------------------------------------------------

const add = defineCommand({
  meta: { name: 'add', description: 'Add a new organization' },
  args: {
    name: {
      type: 'string',
      description: 'Organization name',
      required: true,
    },
    type: {
      type: 'string',
      description: 'Organization type (company, nonprofit, government, military, education, volunteer, freelance, other)',
      default: 'company',
    },
    industry: {
      type: 'string',
      description: 'Industry',
    },
    size: {
      type: 'string',
      description: 'Size (startup, small, medium, large, enterprise)',
    },
    worked: {
      type: 'boolean',
      description: 'Did you work here?',
      default: false,
    },
    'employment-type': {
      type: 'string',
      description: 'Employment type (civilian, contractor, military_active, military_reserve, volunteer, intern)',
    },
    location: {
      type: 'string',
      description: 'Location',
    },
    website: {
      type: 'string',
      description: 'Website URL',
    },
  },
  async run({ args }) {
    const input: Record<string, unknown> = {
      name: args.name,
      org_type: args.type,
      worked: args.worked,
    }
    if (args.industry) input.industry = args.industry
    if (args.size) input.size = args.size
    if (args['employment-type']) input.employment_type = args['employment-type']
    if (args.location) input.location = args.location
    if (args.website) input.website = args.website

    const result = await forge.organizations.create(input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const o = result.data
    console.log(`Created organization: ${o.name}`)
    console.log(`  ID:   ${o.id}`)
    console.log(`  Type: ${(o as any).org_type}`)
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List organizations' },
  args: {
    type: {
      type: 'string',
      description: 'Filter by org type',
    },
    worked: {
      type: 'boolean',
      description: 'Filter to orgs where you worked',
    },
  },
  async run({ args }) {
    const filter: Record<string, string | number> = {}
    if (args.type) filter.org_type = args.type
    if (args.worked !== undefined) filter.worked = args.worked ? '1' : '0'

    const result = await forge.organizations.list(
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
      console.log('No organizations found.')
      return
    }

    const idW = 10
    const nameW = 24
    const typeW = 12
    const industryW = 16
    const workedW = 8

    const header = [
      'ID'.padEnd(idW),
      'Name'.padEnd(nameW),
      'Type'.padEnd(typeW),
      'Industry'.padEnd(industryW),
      'Worked'.padEnd(workedW),
    ].join('  ')

    const divider = [
      '\u2500'.repeat(idW),
      '\u2500'.repeat(nameW),
      '\u2500'.repeat(typeW),
      '\u2500'.repeat(industryW),
      '\u2500'.repeat(workedW),
    ].join('  ')

    console.log(header)
    console.log(divider)

    for (const o of result.data) {
      const id = o.id.length > 8 ? o.id.slice(0, 6) + '..' : o.id
      const name = o.name.length > nameW ? o.name.slice(0, nameW - 1) + '\u2026' : o.name

      console.log(
        [
          id.padEnd(idW),
          name.padEnd(nameW),
          ((o as any).org_type ?? '').padEnd(typeW),
          ((o as any).industry ?? '').padEnd(industryW),
          ((o as any).worked ? 'Yes' : 'No').padEnd(workedW),
        ].join('  '),
      )
    }

    console.log(`\n${result.data.length} of ${result.pagination.total} organizations`)
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show organization details' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
  },
  async run({ args }) {
    const result = await forge.organizations.get(args.id)
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

    const o = result.data as any
    console.log(`Organization: ${o.name}`)
    console.log(`  ID:              ${o.id}`)
    console.log(`  Type:            ${o.org_type}`)
    console.log(`  Industry:        ${o.industry ?? '(none)'}`)
    console.log(`  Size:            ${o.size ?? '(none)'}`)
    console.log(`  Worked:          ${o.worked ? 'Yes' : 'No'}`)
    console.log(`  Employment Type: ${o.employment_type ?? '(none)'}`)
    console.log(`  Location:        ${o.location ?? '(none)'}`)
    console.log(`  Website:         ${o.website ?? '(none)'}`)
    if (o.notes) console.log(`  Notes:           ${o.notes}`)
  },
})

const edit = defineCommand({
  meta: { name: 'edit', description: 'Edit an organization' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
    name: { type: 'string', description: 'New name' },
    type: { type: 'string', description: 'New org type' },
    industry: { type: 'string', description: 'New industry' },
    size: { type: 'string', description: 'New size' },
    worked: { type: 'boolean', description: 'Worked here?' },
    location: { type: 'string', description: 'New location' },
    website: { type: 'string', description: 'New website' },
  },
  async run({ args }) {
    const input: Record<string, unknown> = {}
    if (args.name) input.name = args.name
    if (args.type) input.org_type = args.type
    if (args.industry) input.industry = args.industry
    if (args.size) input.size = args.size
    if (args.worked !== undefined) input.worked = args.worked
    if (args.location) input.location = args.location
    if (args.website) input.website = args.website

    if (Object.keys(input).length === 0) {
      console.error('Error: No fields to update. Provide at least one flag.')
      process.exit(1)
    }

    const result = await forge.organizations.update(args.id, input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Updated organization: ${result.data.name}`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete an organization' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
  },
  async run({ args }) {
    const result = await forge.organizations.delete(args.id)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Deleted organization ${args.id}`)
  },
})

// ---------------------------------------------------------------------------
// org command group
// ---------------------------------------------------------------------------

export const orgCommand = defineCommand({
  meta: { name: 'org', description: 'Manage organizations' },
  subCommands: {
    add,
    list,
    show,
    edit,
    delete: del,
  },
})
