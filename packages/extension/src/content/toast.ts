// packages/extension/src/content/toast.ts
//
// Shadow DOM toast notification for quiet-mode captures.
// Shown when confidence is high enough that no user review is needed.
//
// IMPORTANT: Must NOT import from ../plugin/plugins/* or @forge/core —
// only from ../plugin/types and ../lib/* to preserve the shared chunk constraint.

const TOAST_HOST_ID = 'forge-toast-host'

/** Escape HTML entities to prevent XSS in message content. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Show a toast notification in a closed shadow DOM.
 * Auto-dismisses after `durationMs` (default 3000).
 * Removes any existing toast before showing a new one.
 */
export function showToast(message: string, durationMs: number = 3000): void {
  // Remove any existing toast first
  const existing = document.getElementById(TOAST_HOST_ID)
  if (existing) existing.remove()

  // Create shadow DOM host
  const host = document.createElement('div')
  host.id = TOAST_HOST_ID
  const shadow = host.attachShadow({ mode: 'closed' })

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        min-width: 260px;
        max-width: 360px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
        overflow: hidden;
        opacity: 1;
        transition: opacity 0.3s ease-out;
      }
      .toast.fade-out {
        opacity: 0;
      }
      .toast-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px 6px;
        font-size: 12px;
        font-weight: 600;
        color: #4ade80;
        letter-spacing: 0.02em;
      }
      .toast-check {
        font-size: 14px;
        line-height: 1;
      }
      .toast-body {
        padding: 0 14px 12px;
        font-size: 13px;
        line-height: 1.4;
        color: #e0e0e0;
      }
    </style>
    <div class="toast">
      <div class="toast-header">
        <span class="toast-check">\u2713</span>
        <span>Forge</span>
      </div>
      <div class="toast-body">${escapeHtml(message)}</div>
    </div>
  `

  document.body.appendChild(host)

  // Auto-dismiss with fade-out
  const toast = shadow.querySelector('.toast') as HTMLElement
  setTimeout(() => {
    toast.classList.add('fade-out')
    // Remove from DOM after the fade transition completes
    setTimeout(() => host.remove(), 300)
  }, durationMs)
}
