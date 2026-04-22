import { describe, expect, test } from 'bun:test'
import { buildQueryNameMap, toPascalCase } from '../helix-query-names'
import { classifyEntities } from '../helix-classify'
import { ENTITY_MAP_SHAPE } from '../../../entity-map.data'
import type { EntityMap } from '../../../entity-map'

describe('toPascalCase', () => {
  test('converts snake_case to PascalCase', () => {
    expect(toPascalCase('bullet_skills')).toBe('BulletSkills')
    expect(toPascalCase('source_education')).toBe('SourceEducation')
    expect(toPascalCase('job_description_skills')).toBe('JobDescriptionSkills')
    expect(toPascalCase('skills')).toBe('Skills')
    expect(toPascalCase('user_profile')).toBe('UserProfile')
  })
})

describe('buildQueryNameMap', () => {
  const classification = classifyEntities(ENTITY_MAP_SHAPE as unknown as EntityMap)
  const qmap = buildQueryNameMap(classification, ENTITY_MAP_SHAPE as unknown as EntityMap)

  test('node CRUD queries', () => {
    expect(qmap.get('create:bullets')).toBe('AddBullets')
    expect(qmap.get('get:bullets')).toBe('GetBullets')
    expect(qmap.get('update:bullets')).toBe('UpdateBullets')
    expect(qmap.get('delete:bullets')).toBe('DeleteBullets')
    expect(qmap.get('list:bullets')).toBe('ListBullets')
    expect(qmap.get('listAll:bullets')).toBe('ListAllBullets')
    expect(qmap.get('count:bullets')).toBe('CountBullets')
  })

  test('edge CRUD queries', () => {
    expect(qmap.get('create:bullet_skills')).toBe('AddBulletSkills')
    expect(qmap.get('listFrom:bullet_skills')).toBe('ListBulletSkillsFrom')
    expect(qmap.get('listTo:bullet_skills')).toBe('ListBulletSkillsTo')
    expect(qmap.get('deleteFrom:bullet_skills')).toBe('DeleteBulletSkillsFrom')
    expect(qmap.get('deleteByEndpoints:bullet_skills')).toBe('DeleteBulletSkillsByEndpoints')
    expect(qmap.get('countFrom:bullet_skills')).toBe('CountBulletSkillsFrom')
  })

  test('indexed field queries for nodes', () => {
    expect(qmap.get('getBy:skills:name')).toBe('GetSkillsByName')
    expect(qmap.get('getBy:domains:name')).toBe('GetDomainsByName')
  })

  test('all node entities have CRUD queries', () => {
    for (const name of classification.nodes) {
      expect(qmap.has(`create:${name}`)).toBe(true)
      expect(qmap.has(`list:${name}`)).toBe(true)
      expect(qmap.has(`count:${name}`)).toBe(true)
    }
  })

  test('all edge entities have edge queries', () => {
    for (const name of classification.edges) {
      expect(qmap.has(`create:${name}`)).toBe(true)
      expect(qmap.has(`listFrom:${name}`)).toBe(true)
      expect(qmap.has(`deleteFrom:${name}`)).toBe(true)
    }
  })
})
