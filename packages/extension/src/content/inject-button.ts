// packages/extension/src/content/inject-button.ts
//
// Inject a "Capture to Forge" button on LinkedIn job detail pages.
// Anchored by aria-label attributes on LinkedIn's action buttons
// (more stable than CSS class selectors which are hashed module names).
//
// IMPORTANT: This module must NOT import from ../plugin/plugins/* —
// it only uses DOM APIs and chrome.runtime.sendMessage to preserve
// the shared chunk constraint.

const BUTTON_ID = 'forge-capture-btn'

/**
 * Find an anchor element near LinkedIn's job action buttons.
 * These aria-labels are WCAG-mandated and rarely change.
 */
function findAnchor(doc: Document): Element | null {
  const candidates = [
    'button[aria-label="Save"]',
    'button[aria-label="Share"]',
    'button[aria-label="More options"]',
  ]
  for (const sel of candidates) {
    const el = doc.querySelector(sel)
    if (el) return el
  }
  return null
}

/**
 * Create and inject the Forge capture button.
 * Returns true if injected, false if anchor not found or already present.
 */
export function injectCaptureButton(doc: Document): boolean {
  if (doc.getElementById(BUTTON_ID)) return false

  const anchor = findAnchor(doc)
  if (!anchor) return false

  const container = anchor.parentElement
  if (!container) return false

  const btn = doc.createElement('button')
  btn.id = BUTTON_ID
  btn.textContent = 'Capture to Forge'
  btn.setAttribute('aria-label', 'Capture to Forge')

  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 16px',
    marginLeft: '8px',
    border: '1px solid #0a66c2',
    borderRadius: '24px',
    background: 'transparent',
    color: '#0a66c2',
    fontFamily: '-apple-system, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    lineHeight: '1.33',
  })

  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    btn.textContent = 'Capturing...'
    btn.disabled = true

    try {
      const response = await chrome.runtime.sendMessage({
        cmd: 'jd.captureActive',
        forceManual: e.shiftKey,
      })
      if (response?.ok) {
        if (response.data?.overlayShown) {
          btn.textContent = 'Review in panel \u2192'
          btn.style.borderColor = '#6366f1'
          btn.style.color = '#6366f1'
        } else {
          btn.textContent = '\u2713 Captured'
          btn.style.borderColor = '#057642'
          btn.style.color = '#057642'
        }
      } else {
        const code = response?.error?.code
        if (code === 'API_DUPLICATE') {
          btn.textContent = 'Already captured'
          btn.style.borderColor = '#666'
          btn.style.color = '#666'
        } else {
          btn.textContent = 'Failed'
          btn.style.borderColor = '#cc1016'
          btn.style.color = '#cc1016'
        }
      }
    } catch {
      btn.textContent = 'Failed'
      btn.style.borderColor = '#cc1016'
      btn.style.color = '#cc1016'
    }

    setTimeout(() => {
      btn.textContent = 'Capture to Forge'
      btn.disabled = false
      btn.style.borderColor = '#0a66c2'
      btn.style.color = '#0a66c2'
    }, 3000)
  })

  container.appendChild(btn)
  return true
}

/**
 * Remove the injected button (for cleanup on SPA navigation).
 */
export function removeCaptureButton(doc: Document): void {
  const existing = doc.getElementById(BUTTON_ID)
  if (existing) existing.remove()
}

/**
 * Set up a MutationObserver to re-inject the button on SPA navigation.
 * LinkedIn uses client-side routing — the page doesn't reload when
 * navigating between jobs.
 */
export function observeForInjection(doc: Document): void {
  let lastUrl = doc.location.href

  const observer = new MutationObserver(() => {
    const currentUrl = doc.location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      removeCaptureButton(doc)
      setTimeout(() => injectCaptureButton(doc), 500)
    }
  })

  observer.observe(doc.body, { childList: true, subtree: true })
}
