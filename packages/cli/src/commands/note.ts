import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// note sub-subcommands
// ---------------------------------------------------------------------------

const add = defineCommand({
  meta: { name: 'add', description: 'Add a new note' },
  args: {
    content: {
      type: 'string',
      description: 'Note content',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Note title (optional)',
    },
  },
  async run({ args }) {
    const input: Record<string, string> = { content: args.content }
    if (args.title) input.title = args.title

    const result = await forge.notes.create(input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const n = result.data
    console.log(`Created note: ${(n as any).title ?? '(untitled)'}`)
    console.log(`  ID: ${n.id}`)
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List notes' },
  args: {
    search: {
      type: 'string',
      description: 'Search notes by content',
    },
  },
  async run({ args }) {
    const filter: Record<string, string> = {}
    if (args.search) filter.search = args.search

    const result = await forge.notes.list(
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
      console.log('No notes found.')
      return
    }

    for (const n of result.data) {
      const nd = n as any
      const title = nd.title ?? '(untitled)'
      const id = nd.id.length > 8 ? nd.id.slice(0, 6) + '..' : nd.id
      const content = nd.content ?? ''
      const preview = content.length > 60 ? content.slice(0, 57) + '...' : content
      const refs = nd.references?.length > 0
        ? ` [${nd.references.length} linked]`
        : ''

      console.log(`  [${id}] ${title}${refs}`)
      console.log(`          ${preview}`)
    }

    console.log(`\n${result.data.length} note(s)`)
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show note details' },
  args: {
    id: { type: 'positional', description: 'Note ID', required: true },
  },
  async run({ args }) {
    const result = await forge.notes.get(args.id)
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

    const n = result.data as any
    console.log(`Note: ${n.title ?? '(untitled)'}`)
    console.log(`  ID:      ${n.id}`)
    console.log(`  Created: ${n.created_at}`)
    console.log(`  Updated: ${n.updated_at}`)
    console.log(``)
    console.log(`  ${n.content}`)

    if (n.references?.length > 0) {
      console.log(``)
      console.log(`  Linked entities:`)
      for (const ref of n.references) {
        console.log(`    - ${ref.entity_type}: ${ref.entity_id}`)
      }
    }
  },
})

const edit = defineCommand({
  meta: { name: 'edit', description: 'Edit a note' },
  args: {
    id: { type: 'positional', description: 'Note ID', required: true },
    title: { type: 'string', description: 'New title' },
    content: { type: 'string', description: 'New content' },
  },
  async run({ args }) {
    const input: Record<string, string> = {}
    if (args.title) input.title = args.title
    if (args.content) input.content = args.content

    if (Object.keys(input).length === 0) {
      console.error('Error: No fields to update. Provide --title or --content.')
      process.exit(1)
    }

    const result = await forge.notes.update(args.id, input as any)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Updated note: ${(result.data as any).title ?? '(untitled)'}`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a note' },
  args: {
    id: { type: 'positional', description: 'Note ID', required: true },
  },
  async run({ args }) {
    const result = await forge.notes.delete(args.id)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Deleted note ${args.id}`)
  },
})

const link = defineCommand({
  meta: { name: 'link', description: 'Link a note to an entity' },
  args: {
    id: { type: 'positional', description: 'Note ID', required: true },
    'entity-type': {
      type: 'string',
      description: 'Entity type (source, bullet, perspective, resume_entry, resume, skill, organization)',
      required: true,
    },
    'entity-id': {
      type: 'string',
      description: 'Entity ID',
      required: true,
    },
  },
  async run({ args }) {
    const result = await forge.notes.addReference(args.id, {
      entity_type: args['entity-type'],
      entity_id: args['entity-id'],
    })
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Linked note ${args.id} to ${args['entity-type']} ${args['entity-id']}`)
  },
})

const unlink = defineCommand({
  meta: { name: 'unlink', description: 'Unlink a note from an entity' },
  args: {
    id: { type: 'positional', description: 'Note ID', required: true },
    'entity-type': {
      type: 'string',
      description: 'Entity type',
      required: true,
    },
    'entity-id': {
      type: 'string',
      description: 'Entity ID',
      required: true,
    },
  },
  async run({ args }) {
    const result = await forge.notes.removeReference(
      args.id,
      args['entity-type'],
      args['entity-id'],
    )
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Unlinked note ${args.id} from ${args['entity-type']} ${args['entity-id']}`)
  },
})

// ---------------------------------------------------------------------------
// note command group
// ---------------------------------------------------------------------------

export const noteCommand = defineCommand({
  meta: { name: 'note', description: 'Manage user notes' },
  subCommands: {
    add,
    list,
    show,
    edit,
    delete: del,
    link,
    unlink,
  },
})
