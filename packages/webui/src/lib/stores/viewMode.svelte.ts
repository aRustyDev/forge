import { browser } from '$app/environment'

const STORAGE_KEY_PREFIX = 'forge:viewMode:'

export type ViewMode = 'list' | 'board'

export function getViewMode(entity: string): ViewMode {
  if (!browser) return 'list'
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${entity}`)
    return stored === 'board' ? 'board' : 'list' // default to list
  } catch {
    return 'list'
  }
}

export function setViewMode(entity: string, mode: ViewMode) {
  if (!browser) return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${entity}`, mode)
  } catch {
    // localStorage unavailable, silently ignore
  }
}
