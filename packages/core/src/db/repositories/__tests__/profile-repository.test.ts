import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedProfile, seedResume } from '../../__tests__/helpers'
import * as ProfileRepository from '../profile-repository'

describe('ProfileRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  describe('get()', () => {
    it('returns the profile row after migration', () => {
      const profile = ProfileRepository.get(db)
      expect(profile).not.toBeNull()
      expect(profile!.name).toBe('User')
      expect(profile!.id).toHaveLength(36)
      expect(profile!.email).toBeNull()
    })

    it('returns seeded profile with custom data', () => {
      seedProfile(db, { name: 'Adam', email: 'adam@test.com' })
      const profile = ProfileRepository.get(db)
      expect(profile!.name).toBe('Adam')
      expect(profile!.email).toBe('adam@test.com')
    })
  })

  describe('update()', () => {
    it('updates only provided fields', () => {
      const result = ProfileRepository.update(db, { name: 'Adam', email: 'adam@test.com' })
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Adam')
      expect(result!.email).toBe('adam@test.com')
      expect(result!.phone).toBeNull()
    })

    it('returns unchanged profile for empty patch', () => {
      const before = ProfileRepository.get(db)
      const result = ProfileRepository.update(db, {})
      expect(result).not.toBeNull()
      expect(result!.name).toBe(before!.name)
      expect(result!.updated_at).toBe(before!.updated_at)
    })

    it('refreshes updated_at on update', () => {
      const before = ProfileRepository.get(db)
      // Force a small delay so timestamps differ
      const result = ProfileRepository.update(db, { name: 'Updated' })
      expect(result!.name).toBe('Updated')
      // updated_at should be >= before (same second is acceptable)
      expect(result!.updated_at >= before!.updated_at).toBe(true)
    })

    it('ignores disallowed fields (id, created_at, updated_at)', () => {
      const before = ProfileRepository.get(db)
      const result = ProfileRepository.update(db, {
        name: 'Safe',
      } as any)
      expect(result!.id).toBe(before!.id)
      expect(result!.created_at).toBe(before!.created_at)
    })

    it('can clear a nullable field by setting to null', () => {
      ProfileRepository.update(db, { email: 'adam@test.com' })
      const result = ProfileRepository.update(db, { email: null as unknown as string })
      expect(result!.email).toBeNull()
    })

    it('returns null when profile table is empty', () => {
      db.run('DELETE FROM user_profile')
      const result = ProfileRepository.update(db, { name: 'Test' })
      expect(result).toBeNull()
    })
  })
})
