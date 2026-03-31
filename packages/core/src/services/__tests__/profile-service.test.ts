import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedProfile } from '../../db/__tests__/helpers'
import { ProfileService } from '../profile-service'

describe('ProfileService', () => {
  let db: Database
  let service: ProfileService

  beforeEach(() => {
    db = createTestDb()
    service = new ProfileService(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('getProfile()', () => {
    it('returns ok with the profile', () => {
      const result = service.getProfile()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('User')
        expect(result.data.id).toHaveLength(36)
      }
    })

    it('returns NOT_FOUND when profile is missing', () => {
      db.run('DELETE FROM user_profile')
      const result = service.getProfile()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('updateProfile()', () => {
    it('updates name and returns ok', () => {
      const result = service.updateProfile({ name: 'Adam' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('Adam')
      }
    })

    it('rejects empty name with VALIDATION_ERROR', () => {
      const result = service.updateProfile({ name: '' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Name must not be empty')
      }
    })

    it('rejects whitespace-only name', () => {
      const result = service.updateProfile({ name: '   ' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('rejects null name with VALIDATION_ERROR', () => {
      const result = service.updateProfile({ name: null as unknown as string })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Name cannot be null')
      }
    })

    it('allows updating optional fields to null', () => {
      service.updateProfile({ email: 'adam@test.com' })
      const result = service.updateProfile({ email: null as unknown as string })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.email).toBeNull()
      }
    })

    it('empty patch returns unchanged profile', () => {
      const result = service.updateProfile({})
      expect(result.ok).toBe(true)
    })

    it('returns NOT_FOUND when profile is missing', () => {
      db.run('DELETE FROM user_profile')
      const result = service.updateProfile({ name: 'Test' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('updates multiple fields at once', () => {
      const result = service.updateProfile({
        name: 'Adam',
        email: 'adam@test.com',
        phone: '+1-555-0123',
        location: 'Washington, DC',
        linkedin: 'linkedin.com/in/adam',
        github: 'github.com/adam',
        website: 'adam.dev',
        clearance: 'TS/SCI with CI Polygraph - Active',
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('Adam')
        expect(result.data.email).toBe('adam@test.com')
        expect(result.data.clearance).toBe('TS/SCI with CI Polygraph - Active')
      }
    })
  })
})
