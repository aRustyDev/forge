/**
 * Construct an EntityLifecycleManager from a bun:sqlite Database.
 *
 * This helper lives in the storage module (not services/) so services
 * can import it without creating a circular dependency via
 * services/index.ts.
 *
 * Production code goes through `createServices()` which constructs one
 * shared ELM and injects it into every service. Tests use
 * `new DomainService(buildDefaultElm(db))` for direct construction.
 */

import type { Database } from 'bun:sqlite'
import { SqliteAdapter } from './adapters/sqlite-adapter'
import { SQLITE_NAMED_QUERIES } from './adapters/sqlite-named-queries'
import { HelixAdapter } from './adapters/helix/helix-adapter'
import { buildEntityMap } from './entity-map.data'
import type { EntityMapDeps } from './entity-map'
import { EntityLifecycleManager } from './lifecycle-manager'

export function buildDefaultElm(
  db: Database,
  deps: EntityMapDeps = {},
): EntityLifecycleManager {
  const entityMap = buildEntityMap(deps)

  if (process.env.FORGE_STORAGE === 'helix') {
    const adapter = new HelixAdapter(entityMap, {
      url: process.env.HELIX_URL ?? 'http://localhost:6969',
    })
    return new EntityLifecycleManager(adapter, entityMap)
  }

  // Default: SQLite
  const adapter = new SqliteAdapter(db, { namedQueries: SQLITE_NAMED_QUERIES })
  return new EntityLifecycleManager(adapter, entityMap)
}
