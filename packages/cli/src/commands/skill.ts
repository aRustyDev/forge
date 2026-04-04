import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// skill sub-subcommands
// ---------------------------------------------------------------------------

const add = defineCommand({
  meta: { name: 'add', description: 'Add a new skill' },
  args: {
    name: {
      type: 'string',
      description: 'Skill name',
      required: true,
    },
    category: {
      type: 'string',
      description: 'Category (ai_ml, cloud, database, devops, frameworks, general, language, languages, os, security, tools)',
    },
  },
  async run({ args }) {
    const input: Record<string, string> = { name: args.name }
    if (args.category) input.category = args.category

    // Uses the supporting routes endpoint
    const result = await forge.request<any>('POST', '/api/skills', input)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const s = result.data
    console.log(`Created skill: ${s.name}`)
    console.log(`  ID:       ${s.id}`)
    console.log(`  Category: ${s.category ?? '(none)'}`)
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List skills' },
  args: {
    category: {
      type: 'string',
      description: 'Filter by category',
    },
  },
  async run({ args }) {
    const params: Record<string, string> = {}
    if (args.category) params.category = args.category

    const qs = Object.keys(params).length > 0
      ? '?' + new URLSearchParams(params).toString()
      : ''

    // Uses the supporting routes endpoint
    const result = await forge.request<any[]>('GET', `/api/skills${qs}`)
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
      console.log('No skills found.')
      return
    }

    const idW = 10
    const nameW = 28
    const catW = 16

    const header = [
      'ID'.padEnd(idW),
      'Name'.padEnd(nameW),
      'Category'.padEnd(catW),
    ].join('  ')

    const divider = [
      '\u2500'.repeat(idW),
      '\u2500'.repeat(nameW),
      '\u2500'.repeat(catW),
    ].join('  ')

    console.log(header)
    console.log(divider)

    for (const s of result.data) {
      const id = s.id.length > 8 ? s.id.slice(0, 6) + '..' : s.id
      const name = s.name.length > nameW ? s.name.slice(0, nameW - 1) + '\u2026' : s.name

      console.log(
        [
          id.padEnd(idW),
          name.padEnd(nameW),
          (s.category ?? '').padEnd(catW),
        ].join('  '),
      )
    }

    console.log(`\n${result.data.length} skill(s)`)
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show skill details' },
  args: {
    id: { type: 'positional', description: 'Skill ID', required: true },
  },
  async run({ args }) {
    const result = await forge.request<any>('GET', `/api/skills/${args.id}`)
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

    const s = result.data
    console.log(`Skill: ${s.name}`)
    console.log(`  ID:       ${s.id}`)
    console.log(`  Category: ${s.category ?? '(none)'}`)
    if (s.notes) console.log(`  Notes:    ${s.notes}`)
    console.log(`  Created:  ${s.created_at}`)
  },
})

const del = defineCommand({
  meta: { name: 'delete', description: 'Delete a skill' },
  args: {
    id: { type: 'positional', description: 'Skill ID', required: true },
  },
  async run({ args }) {
    const result = await forge.request<void>('DELETE', `/api/skills/${args.id}`)
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    console.log(`Deleted skill ${args.id}`)
  },
})

// ---------------------------------------------------------------------------
// skill command group
// ---------------------------------------------------------------------------

export const skillCommand = defineCommand({
  meta: { name: 'skill', description: 'Manage skills' },
  subCommands: {
    add,
    list,
    show,
    delete: del,
  },
})
