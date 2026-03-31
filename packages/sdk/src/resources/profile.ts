import type { UserProfile, UpdateProfile, RequestFn, Result } from '../types'

export class ProfileResource {
  constructor(private request: RequestFn) {}

  /** Get the user profile. */
  get(): Promise<Result<UserProfile>> {
    return this.request<UserProfile>('GET', '/api/profile')
  }

  /** Update profile fields. Only provided fields are modified. */
  update(data: UpdateProfile): Promise<Result<UserProfile>> {
    return this.request<UserProfile>('PATCH', '/api/profile', data)
  }
}
