/**
 * HQL codegen — reads ENTITY_MAP_SHAPE and emits pre-compiled HQL query
 * files grouped by domain.
 *
 * Each node entity gets ~8 queries (Add, Get, GetBy*, Update, Delete,
 * List, ListAll, Count). Each edge entity gets ~6 queries (Add, ListFrom,
 * ListTo, DeleteFrom, DeleteByEndpoints, CountFrom).
 */

import type { EntityMap, FieldDefinition } from '../../entity-map'
import { classifyEntities } from './helix-classify'
import { toPascalCase } from './helix-query-names'

// ─── HQL type mapping ─────────────────────────────────────────────────────

function hqlType(field: FieldDefinition): string {
  if (field.boolean) return 'Boolean'
  switch (field.type) {
    case 'text':
      return 'String'
    case 'integer':
      return 'I64'
    case 'real':
      return 'F64'
    case 'json':
      return 'String'
    case 'blob':
      return 'String'
    default:
      return 'String'
  }
}

// ─── Domain grouping ──────────────────────────────────────────────────────

const DOMAIN_GROUPS: Record<string, string[]> = {
  'content.hx': [
    'sources', 'source_roles', 'source_projects', 'source_education',
    'source_presentations', 'bullets', 'perspectives',
  ],
  'taxonomy.hx': [
    'skills', 'skill_categories', 'domains', 'archetypes',
    'industries', 'role_types',
  ],
  'organizations.hx': [
    'organizations', 'org_campuses', 'org_aliases', 'org_tags',
  ],
  'resumes.hx': [
    'resumes', 'resume_sections', 'resume_entries', 'resume_skills',
    'resume_certifications', 'resume_templates',
  ],
  'jobs.hx': ['job_descriptions', 'summaries'],
  'qualifications.hx': ['credentials', 'certifications'],
  'contacts.hx': ['contacts'],
  'user.hx': ['user_profile', 'user_notes', 'note_references',
    'addresses', 'profile_urls'],
  'system.hx': ['prompt_logs', 'embeddings', 'pending_derivations'],
}

// Build reverse lookup: entity name → filename (for nodes only; edges go to edges.hx)
function buildEntityToDomain(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [filename, entities] of Object.entries(DOMAIN_GROUPS)) {
    for (const entity of entities) {
      map.set(entity, filename)
    }
  }
  return map
}

// ─── Node query generators ───────────────────────────────────────────────

function genNodeAdd(
  entityName: string,
  pascal: string,
  fields: Record<string, FieldDefinition>,
): string {
  const fieldNames = Object.keys(fields)
  const params = fieldNames
    .map((f) => `${f}?: ${hqlType(fields[f])}`)
    .join(', ')
  const objFields = fieldNames.map((f) => `${f}: ${f}`).join(', ')

  return `QUERY Add${pascal}(${params}) =>
    node <- AddN<${pascal}>({${objFields}})
    RETURN node`
}

function genNodeGet(pascal: string): string {
  return `QUERY Get${pascal}(id: String) =>
    node <- N<${pascal}>({id: id})::FIRST
    RETURN node`
}

function genNodeGetBy(
  pascal: string,
  fieldName: string,
  fieldDef: FieldDefinition,
): string {
  const fieldPascal = toPascalCase(fieldName)
  const paramType = hqlType(fieldDef)
  return `QUERY Get${pascal}By${fieldPascal}(${fieldName}: ${paramType}) =>
    nodes <- N<${pascal}>({${fieldName}: ${fieldName}})
    RETURN nodes`
}

function genNodeUpdate(
  pascal: string,
  fields: Record<string, FieldDefinition>,
): string {
  const nonIdFields = Object.keys(fields).filter((f) => f !== 'id')
  const params = ['id: String']
    .concat(nonIdFields.map((f) => `${f}?: ${hqlType(fields[f])}`))
    .join(', ')
  const updateFields = nonIdFields.map((f) => `${f}: ${f}`).join(', ')

  return `QUERY Update${pascal}(${params}) =>
    node <- N<${pascal}>({id: id})::FIRST
    node <- node::UPDATE({${updateFields}})
    RETURN node`
}

function genNodeDelete(pascal: string): string {
  return `QUERY Delete${pascal}(id: String) =>
    node <- N<${pascal}>({id: id})::FIRST
    DROP node
    RETURN NONE`
}

function genNodeList(pascal: string): string {
  return `QUERY List${pascal}(offset: U32, limit: U32) =>
    nodes <- N<${pascal}>::RANGE(offset, ADD(offset, limit))
    RETURN nodes`
}

function genNodeListAll(pascal: string): string {
  return `QUERY ListAll${pascal}() =>
    nodes <- N<${pascal}>
    RETURN nodes`
}

function genNodeCount(pascal: string): string {
  return `QUERY Count${pascal}() =>
    count <- N<${pascal}>::COUNT
    RETURN count`
}

// ─── Edge query generators ───────────────────────────────────────────────

function genEdgeAdd(
  pascal: string,
  fromPascal: string,
  toPascal: string,
  propertyFields: string[],
  allFields: Record<string, FieldDefinition>,
): string {
  const baseParams = ['fromId: String', 'toId: String']
  const propParams = propertyFields.map(
    (f) => `${f}?: ${hqlType(allFields[f])}`,
  )
  const params = [...baseParams, ...propParams].join(', ')

  return `QUERY Add${pascal}(${params}) =>
    from <- N<${fromPascal}>({id: fromId})::FIRST
    to <- N<${toPascal}>({id: toId})::FIRST
    edge <- AddE<${pascal}>::From(from)::To(to)
    RETURN edge`
}

function genEdgeListFrom(
  pascal: string,
  fromPascal: string,
): string {
  return `QUERY List${pascal}From(id: String) =>
    edges <- N<${fromPascal}>({id: id})::FIRST::OutE<${pascal}>
    RETURN edges`
}

function genEdgeListTo(
  pascal: string,
  toPascal: string,
): string {
  return `QUERY List${pascal}To(id: String) =>
    edges <- N<${toPascal}>({id: id})::FIRST::InE<${pascal}>
    RETURN edges`
}

function genEdgeDeleteFrom(
  pascal: string,
  fromPascal: string,
): string {
  return `QUERY Delete${pascal}From(id: String) =>
    edges <- N<${fromPascal}>({id: id})::FIRST::OutE<${pascal}>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE`
}

function genEdgeDeleteByEndpoints(
  pascal: string,
  fromPascal: string,
): string {
  return `QUERY Delete${pascal}ByEndpoints(fromId: String, toId: String) =>
    edges <- N<${fromPascal}>({id: fromId})::FIRST::OutE<${pascal}>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE`
}

function genEdgeCountFrom(
  pascal: string,
  fromPascal: string,
): string {
  return `QUERY Count${pascal}From(id: String) =>
    count <- N<${fromPascal}>({id: id})::FIRST::OutE<${pascal}>::COUNT
    RETURN count`
}

// ─── Main entry point ────────────────────────────────────────────────────

/**
 * Generate all HQL queries from the entity map.
 *
 * Returns Map<filename, hqlContent> where each file starts with a
 * `// === filename.hx ===` section marker.
 */
export function generateQueries(entityMap: EntityMap): Map<string, string> {
  const classification = classifyEntities(entityMap)
  const entityToDomain = buildEntityToDomain()

  // Accumulate queries per file
  const fileQueries = new Map<string, string[]>()

  // Initialize all domain files
  for (const filename of Object.keys(DOMAIN_GROUPS)) {
    fileQueries.set(filename, [])
  }
  fileQueries.set('edges.hx', [])

  // ── Generate node queries ──
  for (const entityName of classification.nodes) {
    const def = entityMap[entityName]
    if (!def) continue

    const pascal = toPascalCase(entityName)
    const fields = def.fields as Record<string, FieldDefinition>

    const filename = entityToDomain.get(entityName)
    if (!filename) continue // entity not in any domain group, skip

    const queries = fileQueries.get(filename)!

    // Add
    queries.push(genNodeAdd(entityName, pascal, fields))

    // Get (only for entities with an 'id' field)
    if (fields.id) {
      queries.push(genNodeGet(pascal))
    }

    // GetBy for unique non-id fields
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (fieldDef.unique && fieldName !== 'id') {
        queries.push(genNodeGetBy(pascal, fieldName, fieldDef))
      }
    }

    // Update (only for entities with an 'id' field)
    if (fields.id) {
      queries.push(genNodeUpdate(pascal, fields))
    }

    // Delete (only for entities with an 'id' field)
    if (fields.id) {
      queries.push(genNodeDelete(pascal))
    }

    // List, ListAll, Count
    queries.push(genNodeList(pascal))
    queries.push(genNodeListAll(pascal))
    queries.push(genNodeCount(pascal))
  }

  // ── Generate edge queries ──
  const edgeQueries = fileQueries.get('edges.hx')!
  for (const entityName of classification.edges) {
    const def = entityMap[entityName]
    if (!def) continue

    const pascal = toPascalCase(entityName)
    const meta = classification.edgeMeta.get(entityName)!
    const fromPascal = toPascalCase(meta.fromEntity)
    const toPascal = toPascalCase(meta.toEntity)
    const fields = def.fields as Record<string, FieldDefinition>

    edgeQueries.push(genEdgeAdd(pascal, fromPascal, toPascal, meta.propertyFields, fields))
    edgeQueries.push(genEdgeListFrom(pascal, fromPascal))
    edgeQueries.push(genEdgeListTo(pascal, toPascal))
    edgeQueries.push(genEdgeDeleteFrom(pascal, fromPascal))
    edgeQueries.push(genEdgeDeleteByEndpoints(pascal, fromPascal))
    edgeQueries.push(genEdgeCountFrom(pascal, fromPascal))
  }

  // ── Build output map ──
  const output = new Map<string, string>()
  for (const [filename, queries] of fileQueries) {
    if (queries.length === 0) continue
    const header = `// === ${filename} ===`
    output.set(filename, header + '\n\n' + queries.join('\n\n') + '\n')
  }

  return output
}

// ─── CLI entry point ──────────────────────────────────────────────────────

if (import.meta.main) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { ENTITY_MAP_SHAPE } = await import('../../entity-map.data')

  const outDir = join(import.meta.dir, 'db', 'src', 'queries')
  await mkdir(outDir, { recursive: true })

  const queries = generateQueries(ENTITY_MAP_SHAPE as unknown as EntityMap)

  let totalQueries = 0
  for (const [filename, content] of queries) {
    await writeFile(join(outDir, filename), content, 'utf-8')
    const count = (content.match(/^QUERY /gm) || []).length
    totalQueries += count
    console.log(`  wrote ${filename} (${count} queries)`)
  }
  console.log(`\nGenerated ${queries.size} files with ${totalQueries} queries total → ${outDir}`)
}
