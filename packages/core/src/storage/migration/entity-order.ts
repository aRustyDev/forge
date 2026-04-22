import type { EntityMap } from '../entity-map'

/**
 * Compute migration order for all entities using topological sort.
 * Parents (referenced entities) come before children (referencing entities).
 * Uses Kahn's algorithm (BFS) on the FK dependency graph.
 */
export function computeMigrationOrder(entityMap: EntityMap): string[] {
  const entities = Object.keys(entityMap)

  // Build adjacency: if entity A has FK pointing at entity B,
  // then B must come before A -> edge from B to A
  const dependsOn = new Map<string, Set<string>>() // entity -> set of entities it depends on
  const dependedBy = new Map<string, Set<string>>() // entity -> set of entities that depend on it

  for (const name of entities) {
    dependsOn.set(name, new Set())
    dependedBy.set(name, new Set())
  }

  for (const [name, def] of Object.entries(entityMap)) {
    for (const fieldDef of Object.values(def.fields)) {
      if (fieldDef.fk && !fieldDef.fk.nullable) {
        const target = fieldDef.fk.entity
        if (target !== name && entityMap[target]) {
          dependsOn.get(name)!.add(target)
          dependedBy.get(target)!.add(name)
        }
      }
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>()
  for (const name of entities) {
    inDegree.set(name, dependsOn.get(name)!.size)
  }

  const queue: string[] = []
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name)
  }
  queue.sort() // alphabetical for determinism among same-level entities

  const result: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    for (const dependent of dependedBy.get(current)!) {
      const newDegree = inDegree.get(dependent)! - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) {
        // Insert sorted for determinism
        const insertIdx = queue.findIndex((q) => q > dependent)
        if (insertIdx === -1) queue.push(dependent)
        else queue.splice(insertIdx, 0, dependent)
      }
    }
  }

  // Handle any remaining (cycles) -- add them in alphabetical order
  if (result.length < entities.length) {
    const remaining = entities.filter((e) => !result.includes(e)).sort()
    result.push(...remaining)
  }

  return result
}
