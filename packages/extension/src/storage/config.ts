// packages/extension/src/storage/config.ts

export interface ExtensionConfig {
  baseUrl: string
  devMode: boolean
  enabledPlugins: string[]
  enableServerLogging: boolean
}

const DEFAULTS: ExtensionConfig = {
  baseUrl: 'http://localhost:3000',
  devMode: false,
  enabledPlugins: ['linkedin'],
  enableServerLogging: true,
}

const STORAGE_KEY = 'forge_ext_config'

/**
 * Module-level flag for fast synchronous checks (used by reportError).
 * Updated whenever loadConfig() succeeds.
 */
export let serverLoggingEnabled = true

/**
 * Load config: try Forge API first, fall back to chrome.storage.local cache.
 *
 * On API success, caches the result to chrome.storage.local for offline use.
 * On API failure, reads cached config from chrome.storage.local.
 * If both fail, returns DEFAULTS.
 */
export async function loadConfig(): Promise<ExtensionConfig> {
  // Try API first — need to read baseUrl from local storage to know where API is
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const cached = (stored[STORAGE_KEY] ?? {}) as Partial<ExtensionConfig>
  const baseUrl = cached.baseUrl ?? DEFAULTS.baseUrl

  try {
    const response = await fetch(`${baseUrl}/api/extension/config`)
    if (response.ok) {
      const json = await response.json()
      const config: ExtensionConfig = { ...DEFAULTS, ...json.data }
      // Cache for offline fallback
      await chrome.storage.local.set({ [STORAGE_KEY]: config })
      serverLoggingEnabled = config.enableServerLogging
      return config
    }
  } catch {
    // API unreachable — fall through to cache
  }

  // Fallback: cached config merged over defaults
  const config = { ...DEFAULTS, ...cached }
  serverLoggingEnabled = config.enableServerLogging
  return config
}
