// packages/extension/src/content/overlay.ts
//
// Shadow DOM side panel for reviewing/editing extracted fields before API submission.
// Shown when the confidence model decides extracted data needs human review.
//
// IMPORTANT: Must NOT import from ../plugin/plugins/* or @forge/core —
// only from ../plugin/types and ../lib/* to preserve the shared chunk constraint.

import type { ExtractedJob, FieldConfidence, ConfidenceTier } from '../plugin/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlayCallbacks {
  onSubmit: (edited: ExtractedJob) => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Field configuration
// ---------------------------------------------------------------------------

interface OverlayFieldConfig {
  key: string
  label: string
  getValue: (e: ExtractedJob) => string
  setValue: (e: ExtractedJob, v: string) => ExtractedJob
  type: 'text' | 'textarea'
}

const str = (v: string | number | null | undefined): string =>
  v == null ? '' : String(v)

export const OVERLAY_FIELDS: OverlayFieldConfig[] = [
  {
    key: 'title',
    label: 'Job Title',
    getValue: (e) => str(e.title),
    setValue: (e, v) => ({ ...e, title: v || null }),
    type: 'text',
  },
  {
    key: 'company',
    label: 'Company',
    getValue: (e) => str(e.company),
    setValue: (e, v) => ({ ...e, company: v || null }),
    type: 'text',
  },
  {
    key: 'location',
    label: 'Location',
    getValue: (e) => str(e.location),
    setValue: (e, v) => ({ ...e, location: v || null }),
    type: 'text',
  },
  {
    key: 'salary_min',
    label: 'Salary Min',
    getValue: (e) => str(e.salary_min),
    setValue: (e, v) => ({ ...e, salary_min: v ? Number(v) : null }),
    type: 'text',
  },
  {
    key: 'salary_max',
    label: 'Salary Max',
    getValue: (e) => str(e.salary_max),
    setValue: (e, v) => ({ ...e, salary_max: v ? Number(v) : null }),
    type: 'text',
  },
  {
    key: 'work_posture',
    label: 'Work Posture',
    getValue: (e) => str(e.work_posture),
    setValue: (e, v) => ({ ...e, work_posture: v || null }),
    type: 'text',
  },
  {
    key: 'company_url',
    label: 'Company URL',
    getValue: (e) => str(e.company_url),
    setValue: (e, v) => ({ ...e, company_url: v || null }),
    type: 'text',
  },
  {
    key: 'apply_url',
    label: 'Apply URL',
    getValue: (e) => str(e.apply_url),
    setValue: (e, v) => ({ ...e, apply_url: v || null }),
    type: 'text',
  },
  {
    key: 'url',
    label: 'Job URL',
    getValue: (e) => str(e.url),
    setValue: (e, v) => ({ ...e, url: v }),
    type: 'text',
  },
]

// ---------------------------------------------------------------------------
// Confidence visualization helpers
// ---------------------------------------------------------------------------

function confidenceColor(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high': return '#4ade80'
    case 'medium': return '#fbbf24'
    case 'low': return '#f87171'
    case 'absent': return '#f87171'
  }
}

function confidenceIcon(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high': return '\u2713'      // checkmark
    case 'medium': return '\u26a0'    // warning triangle
    case 'low': return '\u2717'       // X mark
    case 'absent': return '\u2717'
  }
}

function getFieldConfidence(
  fieldKey: string,
  confidence: FieldConfidence[],
): FieldConfidence {
  return confidence.find((fc) => fc.field === fieldKey) ?? {
    field: fieldKey,
    tier: 'absent' as ConfidenceTier,
    source: 'missing',
  }
}

// ---------------------------------------------------------------------------
// Escape helper
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Overlay host ID
// ---------------------------------------------------------------------------

const OVERLAY_HOST_ID = 'forge-overlay-host'

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const OVERLAY_CSS = `
  :host {
    all: initial;
  }
  .overlay-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    z-index: 2147483647;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
    border-left: 1px solid #333;
  }

  /* Header */
  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }
  .overlay-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
  }
  .overlay-close {
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1;
    border-radius: 4px;
  }
  .overlay-close:hover {
    color: #e0e0e0;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Review badge */
  .review-badge {
    padding: 8px 16px;
    font-size: 12px;
    color: #fbbf24;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  /* Scrollable field list */
  .field-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  /* Individual field row */
  .field-row {
    padding: 8px 16px;
    border-left: 3px solid transparent;
  }
  .field-row-high    { border-left-color: #4ade80; }
  .field-row-medium  { border-left-color: #fbbf24; }
  .field-row-low     { border-left-color: #f87171; }
  .field-row-absent  { border-left-color: #f87171; }

  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
  }
  .confidence-icon {
    font-size: 11px;
    line-height: 1;
  }

  /* Inputs */
  .field-input {
    width: 100%;
    padding: 6px 8px;
    background: #12121e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s;
  }
  .field-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }
  textarea.field-input {
    resize: vertical;
    min-height: 60px;
  }

  /* Footer */
  .overlay-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }
  .btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid #444;
    color: #aaa;
  }
  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e0e0e0;
  }
  .btn-primary {
    background: #6366f1;
    color: #fff;
  }
  .btn-primary:hover {
    background: #5558e6;
  }
`

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show the review overlay panel in a closed shadow DOM.
 * Removes any existing overlay first.
 */
export function showOverlay(
  extracted: ExtractedJob,
  confidence: FieldConfidence[],
  callbacks: OverlayCallbacks,
): void {
  // Remove existing overlay
  removeOverlay()

  // Create shadow DOM host
  const host = document.createElement('div')
  host.id = OVERLAY_HOST_ID
  const shadow = host.attachShadow({ mode: 'closed' })

  // Count fields needing review (non-high confidence)
  const needsReview = OVERLAY_FIELDS.filter((f) => {
    const fc = getFieldConfidence(f.key, confidence)
    return fc.tier !== 'high'
  }).length

  // Build field rows HTML
  const fieldsHtml = OVERLAY_FIELDS.map((f) => {
    const fc = getFieldConfidence(f.key, confidence)
    const color = confidenceColor(fc.tier)
    const icon = confidenceIcon(fc.tier)
    const value = escapeHtml(f.getValue(extracted))
    const tierClass = `field-row-${fc.tier}`

    const inputHtml = f.type === 'textarea'
      ? `<textarea class="field-input" data-field-key="${f.key}">${value}</textarea>`
      : `<input class="field-input" type="text" data-field-key="${f.key}" value="${value}" />`

    return `
      <div class="field-row ${tierClass}">
        <div class="field-label-row">
          <span class="field-label">${escapeHtml(f.label)}</span>
          <span class="confidence-badge" style="color: ${color}">
            <span class="confidence-icon">${icon}</span>
            ${fc.tier}
          </span>
        </div>
        ${inputHtml}
      </div>
    `
  }).join('')

  shadow.innerHTML = `
    <style>${OVERLAY_CSS}</style>
    <div class="overlay-panel">
      <div class="overlay-header">
        <span class="overlay-title">Forge \u2014 Review Extraction</span>
        <button class="overlay-close" aria-label="Close">\u2715</button>
      </div>
      <div class="review-badge">${needsReview} field${needsReview !== 1 ? 's' : ''} need${needsReview === 1 ? 's' : ''} review</div>
      <div class="field-list">${fieldsHtml}</div>
      <div class="overlay-footer">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="submit">Submit to Forge</button>
      </div>
    </div>
  `

  // Wire up event handlers
  const closeBtn = shadow.querySelector('.overlay-close') as HTMLElement
  const cancelBtn = shadow.querySelector('[data-action="cancel"]') as HTMLElement
  const submitBtn = shadow.querySelector('[data-action="submit"]') as HTMLElement

  closeBtn.addEventListener('click', () => {
    removeOverlay()
    callbacks.onCancel()
  })

  cancelBtn.addEventListener('click', () => {
    removeOverlay()
    callbacks.onCancel()
  })

  submitBtn.addEventListener('click', () => {
    // Read all input values and build edited ExtractedJob
    let edited = { ...extracted }
    for (const field of OVERLAY_FIELDS) {
      const input = shadow.querySelector(`[data-field-key="${field.key}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null
      if (input) {
        edited = field.setValue(edited, input.value)
      }
    }
    removeOverlay()
    callbacks.onSubmit(edited)
  })

  document.body.appendChild(host)
}

/**
 * Remove the overlay host from the document.
 */
export function removeOverlay(): void {
  const existing = document.getElementById(OVERLAY_HOST_ID)
  if (existing) existing.remove()
}
