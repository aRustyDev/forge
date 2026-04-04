import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 1) + '\u2026'
}

function jsonMode(): boolean {
  return process.argv.includes('--json')
}

// ---------------------------------------------------------------------------
// perspective sub-subcommands
// ---------------------------------------------------------------------------

const list = defineCommand({
  meta: { name: 'list', description: 'List perspectives' },
  args: {
    bullet: { type: 'string', description: 'Filter by bullet ID' },
    archetype: { type: 'string', description: 'Filter by target archetype' },
    domain: { type: 'string', description: 'Filter by domain' },
    status: { type: 'string', description: 'Filter by status' },
    offset: { type: 'string', description: 'Pagination offset' },
    limit: { type: 'string', description: 'Pagination limit' },
  },
  async run({ args }) {
    const filter: Record<string, unknown> = {}
    if (args.bullet) filter.bullet_id = args.bullet
    if (args.archetype) filter.archetype = args.archetype
    if (args.domain) filter.domain = args.domain
    if (args.status) filter.status = args.status
    if (args.offset) filter.offset = Number(args.offset)
    if (args.limit) filter.limit = Number(args.limit)

    const result = await forge.perspectives.list(filter)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (jsonMode()) {
      console.log(JSON.stringify({ data: result.data, pagination: result.pagination }, null, 2))
      return
    }

    if (result.data.length === 0) {
      console.log('No perspectives found.')
      return
    }

    // Table header
    const idW = 8
    const contentW = 50
    const archW = 16
    const domainW = 14
    const statusW = 16

    console.log(
      'ID'.padEnd(idW) +
        '  ' +
        'Content'.padEnd(contentW) +
        '  ' +
        'Archetype'.padEnd(archW) +
        '  ' +
        'Domain'.padEnd(domainW) +
        '  ' +
        'Status'.padEnd(statusW),
    )
    console.log('-'.repeat(idW + 2 + contentW + 2 + archW + 2 + domainW + 2 + statusW))

    for (const p of result.data) {
      console.log(
        truncate(p.id, idW).padEnd(idW) +
          '  ' +
          truncate(p.content, contentW).padEnd(contentW) +
          '  ' +
          (p.target_archetype ?? '').padEnd(archW) +
          '  ' +
          (p.domain ?? '').padEnd(domainW) +
          '  ' +
          p.status.padEnd(statusW),
      )
    }

    console.log(
      `\nShowing ${result.data.length} of ${result.pagination.total} (offset ${result.pagination.offset}, limit ${result.pagination.limit})`,
    )
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show details of a perspective' },
  args: {
    id: { type: 'positional', description: 'Perspective ID', required: true },
  },
  async run({ args }) {
    const result = await forge.perspectives.get(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const p = result.data

    if (jsonMode()) {
      console.log(JSON.stringify(p, null, 2))
      return
    }

    const snapshotMatch =
      p.bullet_content_snapshot === p.bullet.content
        ? '\u2713 (matches current bullet content)'
        : '\u26A0 DIFFERS'

    console.log(`Perspective: ${p.content}`)
    console.log(`  ID:        ${p.id}`)
    console.log(`  Archetype: ${p.target_archetype ?? '(none)'}`)
    console.log(`  Domain:    ${p.domain ?? '(none)'}`)
    console.log(`  Framing:   ${p.framing}`)
    console.log(`  Status:    ${p.status}`)
    console.log()
    console.log('  Chain:')
    console.log(`    Bullet: ${p.bullet.content}`)
    console.log(`      ID:             ${p.bullet.id}`)
    console.log(`      Snapshot match: ${snapshotMatch}`)
    console.log()
    console.log(`    Source: ${p.source.title}`)
    console.log(`      ID:             ${p.source.id}`)
  },
})

const approve = defineCommand({
  meta: { name: 'approve', description: 'Approve a perspective' },
  args: {
    id: { type: 'positional', description: 'Perspective ID', required: true },
  },
  async run({ args }) {
    const result = await forge.perspectives.approve(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (jsonMode()) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Perspective ${result.data.id} approved.`)
  },
})

const reject = defineCommand({
  meta: { name: 'reject', description: 'Reject a perspective' },
  args: {
    id: { type: 'positional', description: 'Perspective ID', required: true },
    reason: { type: 'string', description: 'Rejection reason', required: true },
  },
  async run({ args }) {
    const result = await forge.perspectives.reject(args.id, {
      rejection_reason: args.reason,
    })

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (jsonMode()) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Perspective ${result.data.id} rejected.`)
  },
})

const reopen = defineCommand({
  meta: { name: 'reopen', description: 'Reopen a rejected perspective for review' },
  args: {
    id: { type: 'positional', description: 'Perspective ID', required: true },
  },
  async run({ args }) {
    const result = await forge.perspectives.reopen(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (jsonMode()) {
      console.log(JSON.stringify(result.data, null, 2))
      return
    }

    console.log(`Perspective ${result.data.id} reopened.`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a perspective' },
  args: {
    id: { type: 'positional', description: 'Perspective ID', required: true },
  },
  async run({ args }) {
    const result = await forge.perspectives.delete(args.id)

    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    if (jsonMode()) {
      console.log(JSON.stringify({ deleted: true, id: args.id }, null, 2))
      return
    }

    console.log(`Perspective ${args.id} deleted.`)
  },
})

// ---------------------------------------------------------------------------
// perspective command group
// ---------------------------------------------------------------------------

export const perspectiveCommand = defineCommand({
  meta: { name: 'perspective', description: 'Manage bullet perspectives' },
  subCommands: {
    list,
    show,
    approve,
    reject,
    reopen,
    delete: del,
  },
})
