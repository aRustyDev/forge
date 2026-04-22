import { describe, expect, test } from 'bun:test'
import { classifyEntities } from '../helix-classify'
import { ENTITY_MAP_SHAPE } from '../../../entity-map.data'
import type { EntityMap } from '../../../entity-map'

describe('classifyEntities', () => {
  const classification = classifyEntities(ENTITY_MAP_SHAPE as unknown as EntityMap)

  test('classifies entities with id field as nodes', () => {
    expect(classification.nodes.has('sources')).toBe(true)
    expect(classification.nodes.has('bullets')).toBe(true)
    expect(classification.nodes.has('skills')).toBe(true)
    expect(classification.nodes.has('organizations')).toBe(true)
    expect(classification.nodes.has('resumes')).toBe(true)
  })

  test('classifies entities with composite primaryKey and 2+ FK fields as edges', () => {
    expect(classification.edges.has('bullet_skills')).toBe(true)
    expect(classification.edges.has('bullet_sources')).toBe(true)
    expect(classification.edges.has('source_skills')).toBe(true)
    expect(classification.edges.has('perspective_skills')).toBe(true)
    expect(classification.edges.has('job_description_skills')).toBe(true)
    expect(classification.edges.has('job_description_resumes')).toBe(true)
    expect(classification.edges.has('summary_skills')).toBe(true)
    expect(classification.edges.has('certification_skills')).toBe(true)
    expect(classification.edges.has('archetype_domains')).toBe(true)
    expect(classification.edges.has('skill_domains')).toBe(true)
    expect(classification.edges.has('contact_organizations')).toBe(true)
    expect(classification.edges.has('contact_job_descriptions')).toBe(true)
    expect(classification.edges.has('contact_resumes')).toBe(true)
  })

  test('classifies source subtypes as nodes (composite PK but only 1 FK)', () => {
    expect(classification.nodes.has('source_roles')).toBe(true)
    expect(classification.nodes.has('source_projects')).toBe(true)
    expect(classification.nodes.has('source_education')).toBe(true)
    expect(classification.nodes.has('source_presentations')).toBe(true)
    expect(classification.edges.has('source_roles')).toBe(false)
  })

  test('org_tags classified as node (composite PK but only 1 FK field)', () => {
    expect(classification.nodes.has('org_tags')).toBe(true)
    expect(classification.edges.has('org_tags')).toBe(false)
  })

  test('note_references classified as node (composite PK but only 1 FK field — polymorphic)', () => {
    expect(classification.nodes.has('note_references')).toBe(true)
    expect(classification.edges.has('note_references')).toBe(false)
  })

  test('nodes and edges are disjoint', () => {
    for (const name of classification.nodes) {
      expect(classification.edges.has(name)).toBe(false)
    }
    for (const name of classification.edges) {
      expect(classification.nodes.has(name)).toBe(false)
    }
  })

  test('all entities are classified', () => {
    const total = classification.nodes.size + classification.edges.size
    const entityCount = Object.keys(ENTITY_MAP_SHAPE).length
    expect(total).toBe(entityCount)
  })

  test('edge metadata includes from/to entity types', () => {
    const bs = classification.edgeMeta.get('bullet_skills')!
    expect(bs).toBeDefined()
    expect(bs.fromEntity).toBe('bullets')
    expect(bs.fromField).toBe('bullet_id')
    expect(bs.toEntity).toBe('skills')
    expect(bs.toField).toBe('skill_id')
  })

  test('edge metadata for edge with properties includes property fields', () => {
    const bsrc = classification.edgeMeta.get('bullet_sources')!
    expect(bsrc).toBeDefined()
    expect(bsrc.fromEntity).toBe('bullets')
    expect(bsrc.toEntity).toBe('sources')
    expect(bsrc.propertyFields).toContain('is_primary')
  })

  test('edge metadata for 3-field composite (contact_organizations) has relationship property', () => {
    const co = classification.edgeMeta.get('contact_organizations')!
    expect(co).toBeDefined()
    expect(co.fromEntity).toBe('contacts')
    expect(co.toEntity).toBe('organizations')
    expect(co.propertyFields).toContain('relationship')
  })
})
