import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { getDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { resolve } from 'path'

const MIGRATIONS_DIR = resolve(import.meta.dir, '../db/migrations')

describe('Migration 046: profile addresses + urls', () => {
  let db: Database

  beforeAll(() => {
    db = getDatabase(':memory:')
    runMigrations(db, MIGRATIONS_DIR)
  })

  afterAll(() => {
    if (db) db.close()
  })

  test('addresses table exists with expected columns', () => {
    const cols = db.prepare("PRAGMA table_info(addresses)").all() as { name: string }[]
    const names = cols.map(c => c.name)
    expect(names).toContain('id')
    expect(names).toContain('name')
    expect(names).toContain('street_1')
    expect(names).toContain('street_2')
    expect(names).toContain('city')
    expect(names).toContain('state')
    expect(names).toContain('zip')
    expect(names).toContain('country_code')
    expect(names).toContain('created_at')
    expect(names).toContain('updated_at')
  })

  test('profile_urls table exists with expected columns', () => {
    const cols = db.prepare("PRAGMA table_info(profile_urls)").all() as { name: string }[]
    const names = cols.map(c => c.name)
    expect(names).toContain('id')
    expect(names).toContain('profile_id')
    expect(names).toContain('key')
    expect(names).toContain('url')
    expect(names).toContain('position')
    expect(names).toContain('created_at')
  })

  test('user_profile has address_id but no linkedin/github/website/location', () => {
    const cols = db.prepare("PRAGMA table_info(user_profile)").all() as { name: string }[]
    const names = cols.map(c => c.name)
    expect(names).toContain('address_id')
    expect(names).not.toContain('linkedin')
    expect(names).not.toContain('github')
    expect(names).not.toContain('website')
    expect(names).not.toContain('location')
  })

  test('profile_urls has unique constraint on (profile_id, key)', () => {
    // The seeded profile inserted by migrations has id from 001_initial.sql
    const existingProfile = db.prepare("SELECT id FROM user_profile LIMIT 1").get() as { id: string } | null
    const profileId = existingProfile?.id ?? crypto.randomUUID()
    if (!existingProfile) {
      db.run("INSERT INTO user_profile (id, name) VALUES (?, ?)", [profileId, 'Test User'])
    }
    // Insert first URL
    db.run(
      "INSERT INTO profile_urls (id, profile_id, key, url, position) VALUES (?, ?, 'github', 'https://github.com/test', 0)",
      [crypto.randomUUID(), profileId],
    )
    // Second insert with same key should fail
    expect(() => {
      db.run(
        "INSERT INTO profile_urls (id, profile_id, key, url, position) VALUES (?, ?, 'github', 'https://github.com/test2', 1)",
        [crypto.randomUUID(), profileId],
      )
    }).toThrow()
  })

  test('addresses can be created and referenced from user_profile', () => {
    const addrId = crypto.randomUUID()
    db.run(
      "INSERT INTO addresses (id, name, city, state, country_code) VALUES (?, ?, ?, ?, ?)",
      [addrId, 'Reston, VA', 'Reston', 'VA', 'US'],
    )

    const profileId = crypto.randomUUID()
    db.run(
      "INSERT INTO user_profile (id, name, address_id) VALUES (?, ?, ?)",
      [profileId, 'Test User 2', addrId],
    )

    const row = db.prepare("SELECT address_id FROM user_profile WHERE id = ?").get(profileId) as { address_id: string }
    expect(row.address_id).toBe(addrId)

    const addr = db.prepare("SELECT name, city, state FROM addresses WHERE id = ?").get(addrId) as { name: string; city: string; state: string }
    expect(addr.name).toBe('Reston, VA')
    expect(addr.city).toBe('Reston')
    expect(addr.state).toBe('VA')
  })
})
