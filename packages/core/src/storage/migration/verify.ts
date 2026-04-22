import type { StorageAdapter } from '../adapter'
import type { EntityMap } from '../entity-map'
import { computeMigrationOrder } from './entity-order'

export interface VerificationReport {
  passed: boolean
  checks: Array<{
    check: string
    entity: string
    passed: boolean
    details: string
  }>
}

export async function verifyMigration(
  source: StorageAdapter,
  target: StorageAdapter,
  entityMap: EntityMap,
): Promise<VerificationReport> {
  const order = computeMigrationOrder(entityMap)
  const checks: VerificationReport['checks'] = []

  for (const entityType of order) {
    // Count check
    const sourceCount = await source.count(entityType)
    const targetCount = await target.count(entityType)
    checks.push({
      check: 'count',
      entity: entityType,
      passed: sourceCount === targetCount,
      details: sourceCount === targetCount
        ? `${sourceCount} rows match`
        : `source: ${sourceCount}, target: ${targetCount}`,
    })
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  }
}
