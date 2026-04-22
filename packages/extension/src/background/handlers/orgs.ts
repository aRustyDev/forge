// packages/extension/src/background/handlers/orgs.ts

import type { Organization } from '@forge/sdk'
import { getClient } from '../client'
import { mapSdkError, mapNetworkError } from '../../lib/errors'
import type { Response } from '../../lib/messaging'

export interface OrgsListPayload {
  orgs: Organization[]
  total: number
}

export async function handleOrgsList(limit = 20): Promise<Response<OrgsListPayload>> {
  try {
    const client = await getClient()
    const result = await client.organizations.list({ limit, offset: 0 })
    if (!result.ok) {
      return { ok: false, error: mapSdkError(result.error, { url: '/api/organizations' }) }
    }
    return {
      ok: true,
      data: { orgs: result.data, total: result.pagination.total },
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/organizations' }) }
  }
}

export interface OrgsCreatePayload {
  id: string
  name: string
}

export async function handleOrgsCreate(payload: { name: string }): Promise<Response<OrgsCreatePayload>> {
  try {
    const client = await getClient()
    const result = await client.organizations.create({ name: payload.name })
    if (!result.ok) {
      return { ok: false, error: mapSdkError(result.error, { url: '/api/organizations' }) }
    }
    return {
      ok: true,
      data: { id: result.data.id, name: result.data.name },
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/organizations' }) }
  }
}
