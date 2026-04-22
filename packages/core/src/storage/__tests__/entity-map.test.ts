/**
 * Entity map validation test.
 *
 * Loads the actual SQLite schema via PRAGMA and verifies the
 * hand-maintained entity map stays in sync. Catches drift when new
 * migrations add tables/columns/FKs without updating the map.
 *
 * Checks:
 *   1. Every entity in the map corresponds to a real table
 *   2. Every FK declared in the map matches an actual FK in the DB
 *   3. Every cascade/restrict/setNull rule has a corresponding FK with
 *      the expected on_delete action
 *   4. Every DB table (minus system tables) is in the map
 *   5. Every required field in the map is NOT NULL in the DB
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

import { runMigrations } from '../../db/migrate'
import { buildEntityMap } from '../entity-map.data'
import type { EntityMap } from '../entity-map'

// Tables that exist in the DB but are intentionally NOT in the entity map.
// These are system/legacy tables managed by the migration runner itself.
const SKIP_TABLES = new Set(['_migrations', 'sqlite_sequence', 'v1_import_map', 'extension_config'])

interface PragmaColumn {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

interface PragmaFK {
  id: number
  seq: number
  table: string   // referenced parent table
  from: string    // column in this table
  to: string      // column in parent table
  on_update: string
  on_delete: string
  match: string
}

let db: Database
let map: EntityMap

beforeAll(() => {
  db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const migrationsDir = join(import.meta.dir, '..', '..', 'db', 'migrations')
  runMigrations(db, migrationsDir)
  map = buildEntityMap({})
})

afterAll(() => {
  db.close()
})

function getAllTables(): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .all() as { name: string }[]
  return rows.map((r) => r.name).filter((n) => !SKIP_TABLES.has(n))
}

function getColumns(table: string): PragmaColumn[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as PragmaColumn[]
}

function getForeignKeys(table: string): PragmaFK[] {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all() as PragmaFK[]
}

describe('entity map coverage', () => {
  test('every entity in the map corresponds to a real table', () => {
    const tables = new Set(getAllTables())
    const missing: string[] = []
    for (const entityType of Object.keys(map)) {
      if (!tables.has(entityType)) {
        missing.push(entityType)
      }
    }
    expect(missing).toEqual([])
  })

  test('every DB table is present in the entity map', () => {
    const tables = getAllTables()
    const missing: string[] = []
    for (const table of tables) {
      if (!(table in map)) {
        missing.push(table)
      }
    }
    expect(missing).toEqual([])
  })

  test('every declared entity field exists in the DB column set', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      const cols = new Set(getColumns(entityType).map((c) => c.name))
      for (const field of Object.keys(def.fields)) {
        if (!cols.has(field)) {
          mismatches.push(`${entityType}.${field}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('every DB column is present in the entity field set', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      const cols = getColumns(entityType)
      for (const col of cols) {
        if (!(col.name in def.fields)) {
          mismatches.push(`${entityType}.${col.name}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('required fields in the map are NOT NULL in the DB', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      const cols = getColumns(entityType)
      const colMap = new Map(cols.map((c) => [c.name, c]))
      for (const [field, fdef] of Object.entries(def.fields)) {
        if (!fdef.required) continue
        const col = colMap.get(field)
        if (!col) continue
        // PRIMARY KEY columns are implicitly NOT NULL in SQLite regardless
        // of the explicit notnull flag. PRAGMA table_info reports
        // notnull=0 for PKs that have a DEFAULT expression (e.g.
        // pending_derivations.id DEFAULT randomblob(...)), but SQLite will
        // still reject NULL inserts.
        if (col.pk > 0) continue
        if (col.notnull === 0) {
          mismatches.push(
            `${entityType}.${field} is required in map but nullable in DB`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('foreign key consistency', () => {
  test('every FK declared in the map matches a real FK', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      const fks = getForeignKeys(entityType)
      for (const [field, fdef] of Object.entries(def.fields)) {
        if (!fdef.fk) continue
        const match = fks.find((fk) => fk.from === field)
        if (!match) {
          mismatches.push(
            `${entityType}.${field}: declared FK to ${fdef.fk.entity}.${fdef.fk.field} but no FK in DB`,
          )
          continue
        }
        if (match.table !== fdef.fk.entity) {
          mismatches.push(
            `${entityType}.${field}: map says FK to ${fdef.fk.entity} but DB says ${match.table}`,
          )
        }
        if (match.to !== fdef.fk.field) {
          mismatches.push(
            `${entityType}.${field}: map says FK to .${fdef.fk.field} but DB says .${match.to}`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('every cascade rule has ON DELETE CASCADE in the DB', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      for (const rule of def.cascade) {
        const fks = getForeignKeys(rule.entity)
        const match = fks.find(
          (fk) => fk.from === rule.field && fk.table === entityType,
        )
        if (!match) {
          mismatches.push(
            `${entityType}.cascade: ${rule.entity}.${rule.field} FK not found`,
          )
          continue
        }
        if (match.on_delete !== 'CASCADE') {
          mismatches.push(
            `${entityType}.cascade: ${rule.entity}.${rule.field} on_delete=${match.on_delete}, expected CASCADE`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('every restrict rule has ON DELETE RESTRICT in the DB', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      for (const rule of def.restrict) {
        const fks = getForeignKeys(rule.entity)
        const match = fks.find(
          (fk) => fk.from === rule.field && fk.table === entityType,
        )
        if (!match) {
          mismatches.push(
            `${entityType}.restrict: ${rule.entity}.${rule.field} FK not found`,
          )
          continue
        }
        if (match.on_delete !== 'RESTRICT') {
          mismatches.push(
            `${entityType}.restrict: ${rule.entity}.${rule.field} on_delete=${match.on_delete}, expected RESTRICT`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('every setNull rule has ON DELETE SET NULL in the DB', () => {
    const mismatches: string[] = []
    for (const [entityType, def] of Object.entries(map)) {
      for (const rule of def.setNull) {
        const fks = getForeignKeys(rule.entity)
        const match = fks.find(
          (fk) => fk.from === rule.field && fk.table === entityType,
        )
        if (!match) {
          mismatches.push(
            `${entityType}.setNull: ${rule.entity}.${rule.field} FK not found`,
          )
          continue
        }
        if (match.on_delete !== 'SET NULL') {
          mismatches.push(
            `${entityType}.setNull: ${rule.entity}.${rule.field} on_delete=${match.on_delete}, expected SET NULL`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  test('every cascade/restrict/setNull FK in the DB is declared in the map', () => {
    const mismatches: string[] = []
    for (const [childTable, childDef] of Object.entries(map)) {
      const fks = getForeignKeys(childTable)
      for (const fk of fks) {
        const action = fk.on_delete
        if (action !== 'CASCADE' && action !== 'RESTRICT' && action !== 'SET NULL') {
          continue
        }
        const parentDef = map[fk.table]
        if (!parentDef) continue

        // Depending on the action, expect the rule on the parent
        let rules: { entity: string; field: string }[]
        if (action === 'CASCADE') rules = parentDef.cascade
        else if (action === 'RESTRICT') rules = parentDef.restrict
        else rules = parentDef.setNull

        const found = rules.some(
          (r) => r.entity === childTable && r.field === fk.from,
        )
        if (!found) {
          mismatches.push(
            `${fk.table}.${action.toLowerCase()}: missing rule for ${childTable}.${fk.from}`,
          )
        }
        // Silence unused var
        void childDef
      }
    }
    expect(mismatches).toEqual([])
  })
})
