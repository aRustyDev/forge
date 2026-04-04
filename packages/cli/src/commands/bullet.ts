import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 3) + '...'
}

function pad(str: string, len: number): string {
  return str.padEnd(len)
}

// ---------------------------------------------------------------------------
// bullet sub-subcommands
// ---------------------------------------------------------------------------

const list = defineCommand({
  meta: { name: 'list', description: 'List bullets' },
  args: {
    source: { type: 'string', description: 'Filter by source ID' },
    status: { type: 'string', description: 'Filter by status' },
    technology: { type: 'string', description: 'Filter by technology name' },
    offset: { type: 'string', description: 'Pagination offset', default: '0' },
    limit: { type: 'string', description: 'Pagination limit', default: '20' },
  },
  async run({ args }) {
    const result = await forge.bullets.list({
      source_id: args.source || undefined,
      status: args.status || undefined,
      technology: args.technology || undefined,
      offset: args.offset ? Number(args.offset) : undefined,
      limit: args.limit ? Number(args.limit) : undefined,
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
      console.log('No bullets found.')
      return
    }

    // Table header
    console.log(
      `${pad('ID', 10)}${pad('Content', 52)}${pad('Status', 16)}Technologies`,
    )
    console.log(
      `${pad('\u2500'.repeat(8), 10)}${pad('\u2500'.repeat(50), 52)}${pad('\u2500'.repeat(14), 16)}${'\u2500'.repeat(14)}`,
    )

    for (const b of result.data) {
      const id = b.id.slice(0, 8) + '..'
      const content = truncate(b.content, 50)
      const techs = b.technologies.join(', ')
      console.log(
        `${pad(id, 10)}${pad(content, 52)}${pad(b.status, 16)}${techs}`,
      )
    }

    console.log(
      `\nShowing ${result.data.length} of ${result.pagination.total} bullets (offset: ${result.pagination.offset})`,
    )
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show details of a bullet' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
  },
  async run({ args }) {
    const result = await forge.bullets.get(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    const b = result.data
    console.log(`Bullet: ${truncate(b.content, 60)}`)
    console.log(`  ID:           ${b.id}`)
    console.log(`  Source ID:    ${b.source_id}`)
    console.log(`  Status:       ${b.status}`)
    console.log(`  Technologies: ${b.technologies.join(', ') || '(none)'}`)
    console.log(`  Metrics:      ${b.metrics ?? '(none)'}`)
    console.log(`  Content:      ${b.content}`)
    console.log(`  Snapshot:     ${b.source_content_snapshot}`)
    if (b.rejection_reason) {
      console.log(`  Rejection:    ${b.rejection_reason}`)
    }
    if (b.approved_at) {
      console.log(`  Approved:     ${b.approved_at}`)
    }
    console.log(`  Created:      ${b.created_at}`)
  },
})

const approve = defineCommand({
  meta: { name: 'approve', description: 'Approve a bullet' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
  },
  async run({ args }) {
    const result = await forge.bullets.approve(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Bullet ${result.data.id} approved.`)
  },
})

const reject = defineCommand({
  meta: { name: 'reject', description: 'Reject a bullet' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
    reason: { type: 'string', description: 'Rejection reason', required: true },
  },
  async run({ args }) {
    if (!args.reason) {
      console.error('Error: --reason is required when rejecting a bullet.')
      process.exit(1)
    }

    const result = await forge.bullets.reject(args.id, {
      rejection_reason: args.reason,
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

    console.log(`Bullet ${result.data.id} rejected.`)
    console.log(`  Reason: ${args.reason}`)
  },
})

const reopen = defineCommand({
  meta: { name: 'reopen', description: 'Reopen a rejected bullet for review' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
  },
  async run({ args }) {
    const result = await forge.bullets.reopen(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Bullet ${result.data.id} reopened.`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a bullet' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
  },
  async run({ args }) {
    const result = await forge.bullets.delete(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ deleted: args.id }, null, 2))
      return
    }

    console.log(`Bullet ${args.id} deleted.`)
  },
})

const derivePerspectives = defineCommand({
  meta: { name: 'derive-perspectives', description: 'Derive perspectives from a bullet using AI' },
  args: {
    id: { type: 'positional', description: 'Bullet ID', required: true },
    archetype: { type: 'string', description: 'Target archetype', required: true },
    domain: { type: 'string', description: 'Target domain', required: true },
    framing: {
      type: 'string',
      description: 'Framing: accomplishment, responsibility, or context',
      default: 'accomplishment',
    },
  },
  async run({ args }) {
    if (!args.archetype) {
      console.error('Error: --archetype is required.')
      process.exit(1)
    }
    if (!args.domain) {
      console.error('Error: --domain is required.')
      process.exit(1)
    }

    const framing = (args.framing || 'accomplishment') as 'accomplishment' | 'responsibility' | 'context'

    const result = await forge.bullets.derivePerspectives(args.id, {
      archetype: args.archetype,
      domain: args.domain,
      framing,
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

    const p = result.data
    console.log(`Perspective derived successfully.`)
    console.log(`  ID:        ${p.id}`)
    console.log(`  Bullet ID: ${p.bullet_id}`)
    console.log(`  Archetype: ${p.target_archetype ?? '(none)'}`)
    console.log(`  Domain:    ${p.domain ?? '(none)'}`)
    console.log(`  Framing:   ${p.framing}`)
    console.log(`  Status:    ${p.status}`)
    console.log(`  Content:   ${p.content}`)
  },
})

// ---------------------------------------------------------------------------
// bullet command group
// ---------------------------------------------------------------------------

export const bulletCommand = defineCommand({
  meta: { name: 'bullet', description: 'Manage resume bullets' },
  subCommands: {
    list,
    show,
    approve,
    reject,
    reopen,
    delete: del,
    'derive-perspectives': derivePerspectives,
  },
})
