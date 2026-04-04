import { browser } from '$app/environment'

const STORAGE_KEY = 'forge-theme'
type ThemePreference = 'light' | 'dark' | 'system'

let preference = $state<ThemePreference>('system')

function apply(pref: ThemePreference) {
  if (!browser) return
  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', pref)
  }
}

function init() {
  if (!browser) return
  const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
  if (stored === 'light' || stored === 'dark') {
    preference = stored
    apply(stored)
  }
}

export function setTheme(pref: ThemePreference) {
  preference = pref
  if (browser) {
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, pref)
    }
    apply(pref)
  }
}

export function getTheme(): ThemePreference {
  return preference
}

// Call on app startup (from +layout.svelte)
init()
