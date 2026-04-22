import type { StorageAdapter } from '../adapter'
import type { EntityMap } from '../entity-map'
import { computeMigrationOrder } from './entity-order'

export interface MigrationReport {
  entitiesMigrated: number
  rowsMigrated: number
  errors: Array<{ entity: string; error: string }>
  entityCounts: Record<string, { source: number; target: number }>
}

export interface MigrationOptions {
  source: StorageAdapter
  target: StorageAdapter
  entityMap: EntityMap
  onProgress?: (entity: string, count: number, total: number) => void
  dryRun?: boolean
}

export async function migrateAll(opts: MigrationOptions): Promise<MigrationReport> {
  const { source, target, entityMap, onProgress, dryRun } = opts
  const order = computeMigrationOrder(entityMap)

  const report: MigrationReport = {
    entitiesMigrated: 0,
    rowsMigrated: 0,
    errors: [],
    entityCounts: {},
  }

  for (const entityType of order) {
    try {
      const { rows, total } = await source.list(entityType, {})
      report.entityCounts[entityType] = { source: total, target: 0 }

      if (dryRun) {
        onProgress?.(entityType, total, total)
        report.entitiesMigrated++
        continue
      }

      let migrated = 0
      for (const row of rows) {
        await target.create(entityType, row as Record<string, unknown>)
        migrated++
        onProgress?.(entityType, migrated, total)
      }

      const targetCount = await target.count(entityType)
      report.entityCounts[entityType].target = targetCount
      report.entitiesMigrated++
      report.rowsMigrated += migrated
    } catch (error) {
      report.errors.push({
        entity: entityType,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return report
}
