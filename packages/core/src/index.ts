/**
 * @forge/core — Forge Resume Builder API Server entrypoint.
 *
 * Startup sequence:
 * 1. Validate environment variables
 * 2. Connect to SQLite database
 * 3. Run pending migrations
 * 4. Recover stale deriving locks
 * 5. Check Claude CLI availability
 * 6. Create services
 * 7. Mount routes
 * 8. Start HTTP server
 */

import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { getDatabase } from './db/connection'
import { runMigrations } from './db/migrate'
import { createServices } from './services'
import { DerivationService } from './services/derivation-service'
import { createApp } from './routes/server'
import { logger } from './lib/logger'

// ── 1. Environment variables ─────────────────────────────────────────

const PORT = parseInt(process.env.FORGE_PORT ?? '3000', 10)
const DB_PATH = process.env.FORGE_DB_PATH

if (!DB_PATH) {
  console.error('FORGE_DB_PATH is required. Set it to a path for the SQLite database file.')
  process.exit(1)
}

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`FORGE_PORT must be a valid port number (1-65535), got: ${process.env.FORGE_PORT}`)
  process.exit(1)
}

// ── 2. Database connection ───────────────────────────────────────────

const dbPath = resolve(DB_PATH)
mkdirSync(dirname(dbPath), { recursive: true })
const db = getDatabase(dbPath)
logger.info({ msg: 'Database connected', path: dbPath })

// ── 3. Migrations ────────────────────────────────────────────────────

const migrationsDir = resolve(import.meta.dir, 'db/migrations')
runMigrations(db, migrationsDir)

// ── 4. Recover stale locks ───────────────────────────────────────────

const recovered = DerivationService.recoverStaleLocks(db)
if (recovered > 0) {
  logger.warn({ msg: 'Recovered stale deriving locks', count: recovered })
}

// ── 5. Claude CLI check ──────────────────────────────────────────────

const claudePath = process.env.FORGE_CLAUDE_PATH ?? 'claude'
try {
  const proc = Bun.spawnSync([claudePath, '--version'], { stdout: 'pipe', stderr: 'pipe' })
  if (proc.exitCode === 0) {
    const version = proc.stdout.toString().trim()
    logger.info({ msg: 'Claude CLI available', version })
  } else {
    logger.warn({ msg: 'Claude CLI not found', path: claudePath, note: 'AI features will be unavailable' })
  }
} catch {
  logger.warn({ msg: 'Claude CLI not found', path: claudePath, note: 'AI features will be unavailable' })
}

// ── 5b. Tectonic check ─────────────────────────────────────────────

try {
  const tecProc = Bun.spawnSync(['tectonic', '--version'], { stdout: 'pipe', stderr: 'pipe' })
  if (tecProc.exitCode === 0) {
    const version = tecProc.stdout.toString().trim()
    logger.info({ msg: 'Tectonic available', version })
  } else {
    logger.warn({ msg: 'Tectonic not found', note: 'PDF generation will be unavailable' })
  }
} catch {
  logger.warn({ msg: 'Tectonic not found', note: 'PDF generation will be unavailable' })
}

// ── 6. Create services ──────────────────────────────────────────────

const services = createServices(db, dbPath)

// ── 6b. Initialize embedding service (async, non-blocking) ──────────
// EmbeddingService loads the ML model asynchronously (~2-5s on first use).
// It is injected into Services after createServices() completes, and also
// wired into services that have fire-and-forget hooks.
import { EmbeddingService } from './services/embedding-service'

const embeddingService = new EmbeddingService(db)
services.embedding = embeddingService

// Wire fire-and-forget hooks into services that create entities
services.derivation.setEmbeddingService(embeddingService)
services.jobDescriptions.setEmbeddingService(embeddingService)
services.sources.setEmbeddingService(embeddingService)

// ── 7. Mount routes ──────────────────────────────────────────────────

const app = createApp(services, db)

// ── 8. Start server ──────────────────────────────────────────────────

export default {
  port: PORT,
  fetch: app.fetch,
}

logger.info({ msg: 'Forge API server listening', url: `http://localhost:${PORT}`, port: PORT, log_level: logger.getLevel() })
