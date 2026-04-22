import { describe, expect, test } from 'bun:test'
import { generateQueries } from '../codegen'
import { ENTITY_MAP_SHAPE } from '../../../entity-map.data'
import type { EntityMap } from '../../../entity-map'

describe('generateQueries', () => {
  const output = generateQueries(ENTITY_MAP_SHAPE as unknown as EntityMap)

  test('returns a map of filename → HQL content', () => {
    expect(output.size).toBeGreaterThan(0)
    expect(output.has('content.hx')).toBe(true)
    expect(output.has('edges.hx')).toBe(true)
  })

  test('generates Add query for node entities', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY AddBullets(')
    expect(content).toContain('AddN<Bullets>')
  })

  test('generates Get query for node entities', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY GetBullets(id: String)')
    expect(content).toContain('N<Bullets>({id: id})')
  })

  test('generates Update query for node entities', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY UpdateBullets(')
    expect(content).toContain('::UPDATE(')
  })

  test('generates Delete query for node entities', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY DeleteBullets(id: String)')
    expect(content).toContain('DROP')
  })

  test('generates List and Count queries', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY ListBullets(')
    expect(content).toContain('QUERY CountBullets(')
    expect(content).toContain('::COUNT')
  })

  test('generates ListAll query', () => {
    const content = output.get('content.hx')!
    expect(content).toContain('QUERY ListAllBullets()')
  })

  test('generates edge Add query', () => {
    const edgeContent = output.get('edges.hx')!
    expect(edgeContent).toContain('QUERY AddBulletSkills(')
    expect(edgeContent).toContain('AddE<BulletSkills>')
  })

  test('generates edge ListFrom query', () => {
    const edgeContent = output.get('edges.hx')!
    expect(edgeContent).toContain('QUERY ListBulletSkillsFrom(id: String)')
  })

  test('generates edge DeleteFrom query', () => {
    const edgeContent = output.get('edges.hx')!
    expect(edgeContent).toContain('QUERY DeleteBulletSkillsFrom(id: String)')
  })

  test('generates GetBy query for unique fields', () => {
    const taxonomy = output.get('taxonomy.hx')!
    expect(taxonomy).toContain('QUERY GetSkillsByName(name: String)')
  })

  test('all generated content has section markers', () => {
    for (const [filename, content] of output) {
      expect(content.startsWith(`// === ${filename} ===`)).toBe(true)
    }
  })

  test('covers all entity types', () => {
    const allContent = Array.from(output.values()).join('\n')
    // Spot check key entities from each group
    expect(allContent).toContain('QUERY AddSources(')
    expect(allContent).toContain('QUERY AddSkills(')
    expect(allContent).toContain('QUERY AddOrganizations(')
    expect(allContent).toContain('QUERY AddResumes(')
    expect(allContent).toContain('QUERY AddJobDescriptions(')
    expect(allContent).toContain('QUERY AddCredentials(')
    expect(allContent).toContain('QUERY AddContacts(')
    expect(allContent).toContain('QUERY AddUserProfile(')
    expect(allContent).toContain('QUERY AddPromptLogs(')
    expect(allContent).toContain('QUERY AddBulletSkills(')
  })
})
