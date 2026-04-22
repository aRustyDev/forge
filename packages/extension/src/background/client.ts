// packages/extension/src/background/client.ts

import { ForgeClient } from '@forge/sdk'
import { loadConfig } from '../storage/config'

let instance: ForgeClient | null = null
let instanceBaseUrl: string | null = null

/**
 * Get (or create) the ForgeClient singleton.
 * Re-instantiates if the baseUrl in config has changed since the last call.
 */
export async function getClient(): Promise<ForgeClient> {
  const config = await loadConfig()
  if (!instance || instanceBaseUrl !== config.baseUrl) {
    instance = new ForgeClient({ baseUrl: config.baseUrl })
    instanceBaseUrl = config.baseUrl
  }
  return instance
}

/** Reset the singleton. Only used by tests. */
export function resetClient(): void {
  instance = null
  instanceBaseUrl = null
}
