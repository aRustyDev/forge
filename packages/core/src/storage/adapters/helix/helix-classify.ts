import type { EntityMap } from '../../entity-map'

export interface EdgeMeta {
  fromEntity: string
  fromField: string
  toEntity: string
  toField: string
  /** Non-FK fields on the edge (e.g. is_primary, relationship, created_at) */
  propertyFields: string[]
}

export interface EntityClassification {
  nodes: Set<string>
  edges: Set<string>
  edgeMeta: Map<string, EdgeMeta>
}

/**
 * Classify entities as nodes or edges by inspecting the entity map.
 *
 * Heuristic: an entity is an edge if it has a composite primaryKey AND
 * at least 2 of those PK fields are FKs pointing at different entities.
 * Everything else is a node.
 */
export function classifyEntities(entityMap: EntityMap): EntityClassification {
  const nodes = new Set<string>()
  const edges = new Set<string>()
  const edgeMeta = new Map<string, EdgeMeta>()

  for (const [name, def] of Object.entries(entityMap)) {
    const pk = def.primaryKey
    if (!pk || pk.length < 2) {
      nodes.add(name)
      continue
    }

    // Find PK fields that are FKs pointing at different entities
    const fkFields: Array<{ field: string; entity: string }> = []
    for (const pkField of pk) {
      const fieldDef = def.fields[pkField]
      if (fieldDef?.fk) {
        fkFields.push({ field: pkField, entity: fieldDef.fk.entity })
      }
    }

    // Need at least 2 FK fields pointing at different entities to be an edge
    const distinctEntities = new Set(fkFields.map((f) => f.entity))
    if (fkFields.length >= 2 && distinctEntities.size >= 2) {
      edges.add(name)

      // First FK = from, second FK = to
      const from = fkFields[0]
      const to = fkFields[1]

      // Property fields = all fields that are NOT the from/to FK fields.
      // This includes non-PK fields (e.g. is_primary on bullet_sources)
      // and PK fields that aren't FKs (e.g. relationship on contact_organizations).
      const fkFieldNames = new Set([from.field, to.field])
      const propertyFields = Object.keys(def.fields).filter(
        (f) => !fkFieldNames.has(f),
      )

      edgeMeta.set(name, {
        fromEntity: from.entity,
        fromField: from.field,
        toEntity: to.entity,
        toField: to.field,
        propertyFields,
      })
    } else {
      nodes.add(name)
    }
  }

  return { nodes, edges, edgeMeta }
}
