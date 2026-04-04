import * as readline from 'readline'
import { defineCommand } from 'citty'
import { forge, exitOnNetworkError } from '../client'

// ---------------------------------------------------------------------------
// readline helper
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

// ---------------------------------------------------------------------------
// display helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}

function divider(label: string, width = 64): string {
  const prefix = `\u2500\u2500 ${label} `
  return prefix + '\u2500'.repeat(Math.max(0, width - prefix.length))
}

// ---------------------------------------------------------------------------
// review command
// ---------------------------------------------------------------------------

export const reviewCommand = defineCommand({
  meta: { name: 'review', description: 'Run the interactive review queue' },
  args: {
    json: {
      type: 'boolean',
      description: 'Output the review queue as JSON',
      default: false,
    },
  },
  async run({ args }) {
    const result = await forge.review.pending()
    if (!result.ok) {
      exitOnNetworkError(result.error)
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }

    const queue = result.data

    // --json mode: dump and exit
    if (args.json) {
      console.log(JSON.stringify(queue, null, 2))
      return
    }

    const totalBullets = queue.bullets.count
    const totalPerspectives = queue.perspectives.count

    if (totalBullets === 0 && totalPerspectives === 0) {
      console.log('Nothing to review!')
      return
    }

    console.log(
      `\nReview queue: ${totalBullets} bullet(s), ${totalPerspectives} perspective(s)\n`,
    )

    // Counters
    const stats = {
      bullets: { approved: 0, rejected: 0, skipped: 0 },
      perspectives: { approved: 0, rejected: 0, skipped: 0 },
    }

    let quit = false

    // --- Walk through bullets ---
    for (let i = 0; i < queue.bullets.items.length && !quit; i++) {
      const bullet = queue.bullets.items[i]

      console.log(divider(`Bullet ${i + 1} of ${totalBullets}`))
      console.log(`Source: ${bullet.source_title}`)
      console.log()
      console.log(`Content:`)
      console.log(`  ${bullet.content}`)
      console.log()
      if (bullet.technologies.length > 0) {
        console.log(`Technologies: ${bullet.technologies.join(', ')}`)
        console.log()
      }
      console.log('[a]pprove  [r]eject  [s]kip  [q]uit')

      const action = await prompt('> ')

      switch (action) {
        case 'a': {
          const res = await forge.bullets.approve(bullet.id)
          if (!res.ok) {
            exitOnNetworkError(res.error)
            console.error(`  Error approving: ${res.error.message}`)
            stats.bullets.skipped++
          } else {
            console.log('  Approved.\n')
            stats.bullets.approved++
          }
          break
        }
        case 'r': {
          const reason = await prompt('Rejection reason: \n> ')
          const res = await forge.bullets.reject(bullet.id, { rejection_reason: reason })
          if (!res.ok) {
            exitOnNetworkError(res.error)
            console.error(`  Error rejecting: ${res.error.message}`)
            stats.bullets.skipped++
          } else {
            console.log('  Rejected.\n')
            stats.bullets.rejected++
          }
          break
        }
        case 'q': {
          quit = true
          stats.bullets.skipped++
          break
        }
        default: {
          // treat anything else as skip
          console.log('  Skipped.\n')
          stats.bullets.skipped++
          break
        }
      }
    }

    // Count remaining bullets as skipped if we quit early
    if (quit) {
      const reviewed = stats.bullets.approved + stats.bullets.rejected + stats.bullets.skipped
      stats.bullets.skipped += totalBullets - reviewed
    }

    // --- Walk through perspectives ---
    for (let i = 0; i < queue.perspectives.items.length && !quit; i++) {
      const perspective = queue.perspectives.items[i]

      console.log(divider(`Perspective ${i + 1} of ${totalPerspectives}`))
      console.log(`Source: ${perspective.source_title}`)
      console.log(`Bullet: ${truncate(perspective.bullet_content, 55)}`)

      const meta = [
        perspective.target_archetype ?? 'any',
        perspective.domain ? `Domain: ${perspective.domain}` : null,
        `Framing: ${perspective.framing}`,
      ]
        .filter(Boolean)
        .join(' | ')
      console.log(`Archetype: ${meta}`)
      console.log()
      console.log(`Content:`)
      console.log(`  ${perspective.content}`)
      console.log()
      console.log('[a]pprove  [r]eject  [s]kip  [q]uit')

      const action = await prompt('> ')

      switch (action) {
        case 'a': {
          const res = await forge.perspectives.approve(perspective.id)
          if (!res.ok) {
            exitOnNetworkError(res.error)
            console.error(`  Error approving: ${res.error.message}`)
            stats.perspectives.skipped++
          } else {
            console.log('  Approved.\n')
            stats.perspectives.approved++
          }
          break
        }
        case 'r': {
          const reason = await prompt('Rejection reason: \n> ')
          const res = await forge.perspectives.reject(perspective.id, {
            rejection_reason: reason,
          })
          if (!res.ok) {
            exitOnNetworkError(res.error)
            console.error(`  Error rejecting: ${res.error.message}`)
            stats.perspectives.skipped++
          } else {
            console.log('  Rejected.\n')
            stats.perspectives.rejected++
          }
          break
        }
        case 'q': {
          quit = true
          stats.perspectives.skipped++
          break
        }
        default: {
          console.log('  Skipped.\n')
          stats.perspectives.skipped++
          break
        }
      }
    }

    // Count remaining perspectives as skipped if we quit early
    if (quit) {
      const reviewed =
        stats.perspectives.approved +
        stats.perspectives.rejected +
        stats.perspectives.skipped
      stats.perspectives.skipped += totalPerspectives - reviewed
    }

    // --- Summary ---
    console.log()
    console.log('Review complete:')
    console.log(
      `  Approved: ${stats.bullets.approved} bullet${stats.bullets.approved !== 1 ? 's' : ''}, ${stats.perspectives.approved} perspective${stats.perspectives.approved !== 1 ? 's' : ''}`,
    )
    console.log(
      `  Rejected: ${stats.bullets.rejected} bullet${stats.bullets.rejected !== 1 ? 's' : ''}, ${stats.perspectives.rejected} perspective${stats.perspectives.rejected !== 1 ? 's' : ''}`,
    )
    console.log(
      `  Skipped:  ${stats.bullets.skipped} bullet${stats.bullets.skipped !== 1 ? 's' : ''}, ${stats.perspectives.skipped} perspective${stats.perspectives.skipped !== 1 ? 's' : ''}`,
    )
  },
})
