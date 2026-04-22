import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDb, seedProfile } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { ProfileService } from '../profile-service'

describe('ProfileService', () => {
  let db: Database
  let service: ProfileService

  beforeEach(() => {
    db = createTestDb()
    service = new ProfileService(buildDefaultElm(db))
  })

  afterEach(() => {
    db.close()
  })

  describe('getProfile()', () => {
    it('returns ok with the profile', async () => {
      const result = await service.getProfile()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('User')
        expect(result.data.id).toHaveLength(36)
      }
    })

    it('returns NOT_FOUND when profile is missing', async () => {
      db.run('DELETE FROM user_profile')
      const result = await service.getProfile()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('updateProfile()', () => {
    it('updates name and returns ok', async () => {
      const result = await service.updateProfile({ name: 'Adam' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('Adam')
      }
    })

    it('rejects empty name with VALIDATION_ERROR', async () => {
      const result = await service.updateProfile({ name: '' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Name must not be empty')
      }
    })

    it('rejects whitespace-only name', async () => {
      const result = await service.updateProfile({ name: '   ' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('rejects null name with VALIDATION_ERROR', async () => {
      const result = await service.updateProfile({ name: null as unknown as string })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Name cannot be null')
      }
    })

    it('allows updating optional fields to null', async () => {
      await service.updateProfile({ email: 'adam@test.com' })
      const result = await service.updateProfile({ email: null as unknown as string })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.email).toBeNull()
      }
    })

    it('empty patch returns unchanged profile', async () => {
      const result = await service.updateProfile({})
      expect(result.ok).toBe(true)
    })

    it('returns NOT_FOUND when profile is missing', async () => {
      db.run('DELETE FROM user_profile')
      const result = await service.updateProfile({ name: 'Test' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('updates multiple fields at once', async () => {
      // clearance moved to credentials entity in migration 037 (Phase 84)
      const result = await service.updateProfile({
        name: 'Adam',
        email: 'adam@test.com',
        phone: '+1-555-0123',
        location: 'Washington, DC',
        linkedin: 'linkedin.com/in/adam',
        github: 'github.com/adam',
        website: 'adam.dev',
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('Adam')
        expect(result.data.email).toBe('adam@test.com')
      }
    })
  })
})
