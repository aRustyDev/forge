#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { sourceCommand } from './commands/source'
import { bulletCommand } from './commands/bullet'
import { perspectiveCommand } from './commands/perspective'
import { resumeCommand } from './commands/resume'
import { reviewCommand } from './commands/review'
import { orgCommand } from './commands/organization'
import { noteCommand } from './commands/note'
import { skillCommand } from './commands/skill'
import { importCommand } from './commands/import'

// ---------------------------------------------------------------------------
// Root command
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: 'forge',
    version: '0.0.1',
    description: 'Forge — AI-powered resume builder CLI',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output results as JSON for machine-readable consumption',
      default: false,
      global: true,
    },
  },
  subCommands: {
    source: sourceCommand,
    bullet: bulletCommand,
    perspective: perspectiveCommand,
    resume: resumeCommand,
    review: reviewCommand,
    org: orgCommand,
    note: noteCommand,
    skill: skillCommand,
    import: importCommand,
  },
})

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runMain(main)
