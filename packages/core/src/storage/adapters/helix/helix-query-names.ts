import type { EntityClassification } from './helix-classify'
import type { EntityMap } from '../../entity-map'

export function toPascalCase(snake: string): string {
  return snake
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

/**
 * Build a map of (method:entityType) → HQL query name.
 *
 * For nodes: Add{E}, Get{E}, Update{E}, Delete{E}, List{E}, ListAll{E}, Count{E}
 *            + GetBy queries for each unique/indexed field
 * For edges: Add{E}, ListFrom, ListTo, DeleteFrom, DeleteByEndpoints, CountFrom
 */
export function buildQueryNameMap(
  classification: EntityClassification,
  entityMap: EntityMap,
): Map<string, string> {
  const map = new Map<string, string>()

  for (const name of classification.nodes) {
    const pascal = toPascalCase(name)
    map.set(`create:${name}`, `Add${pascal}`)
    map.set(`get:${name}`, `Get${pascal}`)
    map.set(`update:${name}`, `Update${pascal}`)
    map.set(`delete:${name}`, `Delete${pascal}`)
    map.set(`list:${name}`, `List${pascal}`)
    map.set(`listAll:${name}`, `ListAll${pascal}`)
    map.set(`count:${name}`, `Count${pascal}`)

    // GetBy queries for unique/indexed fields
    const def = entityMap[name]
    if (def) {
      for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
        if (fieldDef.unique && fieldName !== 'id') {
          const fieldPascal = toPascalCase(fieldName)
          map.set(`getBy:${name}:${fieldName}`, `Get${pascal}By${fieldPascal}`)
        }
      }
    }
  }

  for (const name of classification.edges) {
    const pascal = toPascalCase(name)
    map.set(`create:${name}`, `Add${pascal}`)
    map.set(`listFrom:${name}`, `List${pascal}From`)
    map.set(`listTo:${name}`, `List${pascal}To`)
    map.set(`deleteFrom:${name}`, `Delete${pascal}From`)
    map.set(`deleteByEndpoints:${name}`, `Delete${pascal}ByEndpoints`)
    map.set(`countFrom:${name}`, `Count${pascal}From`)
  }

  return map
}
