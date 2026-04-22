// packages/extension/src/plugin/registry.ts

import type { JobBoardPlugin } from './types'

/**
 * Find the first plugin whose `matches` patterns include the given hostname.
 * Supports exact matches ("example.com") and wildcard subdomains ("*.example.com").
 * Wildcards do NOT match the bare domain.
 */
export function matchPluginForHost(
  hostname: string,
  plugins: JobBoardPlugin[],
): JobBoardPlugin | null {
  for (const plugin of plugins) {
    for (const pattern of plugin.matches) {
      if (pattern === hostname) return plugin
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2)  // drop "*."
        if (hostname.endsWith(`.${suffix}`)) return plugin
      }
    }
  }
  return null
}
