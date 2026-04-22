// packages/extension/src/background/handlers/health.ts

import { getClient } from '../client'
import { mapSdkError, mapNetworkError } from '../../lib/errors'
import type { Response } from '../../lib/messaging'

export interface HealthPayload {
  server: string
  version: string
}

export async function handleHealth(): Promise<Response<HealthPayload>> {
  try {
    const client = await getClient()
    const result = await client.health()
    if (!result.ok) {
      return { ok: false, error: mapSdkError(result.error, { url: '/api/health' }) }
    }
    return { ok: true, data: result.data }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/health' }) }
  }
}
