// packages/extension/src/plugin/plugins/workday.ts

import type { JobBoardPlugin, DetectedField, FieldKind, FieldType } from '../types'

const PLUGIN_NAME = 'workday'

/**
 * Map Workday formField-<name> wrapper IDs to canonical FieldKind.
 * The wrapper div has data-automation-id="formField-<fieldName>".
 * We match the fieldName portion (after "formField-").
 */
const FIELD_NAME_MAP: Record<string, FieldKind> = {
  // Personal info
  'legalName--firstName': 'name.first',
  'legalName--lastName': 'name.last',
  'email': 'email',
  'city': 'address.city',
  'countryRegion': 'address.state',
  'country': 'address.country',
  'phoneNumber': 'phone',
  'phoneType': 'phone.type',
  // Application Questions (M6)
  'workAuthorizationStatus': 'work_auth.us',
  'sponsorshipRequired': 'work_auth.sponsorship',
  'authorized': 'work_auth.us',
  'sponsorship': 'work_auth.sponsorship',
  // Voluntary Disclosures / EEO (M6)
  'gender': 'eeo.gender',
  'race': 'eeo.race',
  'ethnicity': 'eeo.race',
  'veteranStatus': 'eeo.veteran',
  'disabilityStatus': 'eeo.disability',
  'disability': 'eeo.disability',
}

/**
 * Check if an input element is a plain text input (fillable in P6).
 * Excludes radios, checkboxes, hidden inputs, and custom widget inputs.
 */
function isFillableTextInput(el: HTMLInputElement, wrapper: Element): boolean {
  const type = el.type?.toLowerCase() ?? 'text'
  // Exclude non-text types
  if (['radio', 'checkbox', 'hidden', 'submit', 'button'].includes(type)) return false
  // Exclude Workday's hidden inputs backing custom dropdowns (structural check)
  if (el.parentElement?.querySelector('button[aria-haspopup="listbox"]')) return false
  // Exclude multiselect search inputs (they have data-uxi-widget-type="selectinput")
  if (el.getAttribute('data-uxi-widget-type') === 'selectinput') return false
  return true
}

function detectFormFields(doc: Document): DetectedField[] {
  const fields: DetectedField[] = []
  const wrappers = doc.querySelectorAll('[data-automation-id^="formField-"]')

  for (const wrapper of Array.from(wrappers)) {
    const automationId = wrapper.getAttribute('data-automation-id') ?? ''
    const fieldName = automationId.replace('formField-', '')
    const fieldKind = FIELD_NAME_MAP[fieldName] ?? 'unknown'

    // Find label text from the wrapper's <label> (prefer legend > label for fieldsets)
    const label = wrapper.querySelector('legend label, label')
    const labelText = label?.textContent?.trim()?.replace(/\*$/, '').trim() ?? null

    // 1. Custom dropdown? (button[aria-haspopup="listbox"])
    const dropdownBtn = wrapper.querySelector('button[aria-haspopup="listbox"]')
    if (dropdownBtn) {
      const ariaLabel = dropdownBtn.getAttribute('aria-label') ?? ''
      const required = ariaLabel.includes('Required') || (label?.textContent?.includes('*') ?? false)
      fields.push({
        element: dropdownBtn,
        label_text: labelText,
        field_kind: fieldKind,
        field_type: 'custom-dropdown' as FieldType,
        required,
      })
      continue
    }

    // 2. Radio group? (input[type="radio"])
    const radios = wrapper.querySelectorAll('input[type="radio"]')
    if (radios.length > 0) {
      const groupDiv = wrapper.querySelector('[aria-required]')
      const required = groupDiv?.getAttribute('aria-required') === 'true'
      fields.push({
        element: wrapper as Element,
        label_text: labelText,
        field_kind: fieldKind,
        field_type: 'radio' as FieldType,
        required,
      })
      continue
    }

    // 3. Native select?
    const select = wrapper.querySelector('select')
    if (select) {
      const required = select.getAttribute('aria-required') === 'true'
      fields.push({
        element: select,
        label_text: labelText,
        field_kind: fieldKind,
        field_type: 'select' as FieldType,
        required,
      })
      continue
    }

    // 4. Text inputs (existing logic with structural exclusions)
    const inputs = wrapper.querySelectorAll('input')
    for (const input of Array.from(inputs)) {
      if (!isFillableTextInput(input as HTMLInputElement, wrapper)) continue

      const required = input.getAttribute('aria-required') === 'true'

      fields.push({
        element: input,
        label_text: labelText,
        field_kind: fieldKind,
        field_type: 'text' as FieldType,
        required,
      })
    }
  }

  return fields
}

/**
 * Fill a radio button group by matching value or label text.
 */
function fillRadio(wrapper: Element, value: string): boolean {
  const radios = wrapper.querySelectorAll('input[type="radio"]')
  const win = wrapper.ownerDocument?.defaultView as Window | null
  const EventCtor = win?.Event ?? Event

  for (const radio of Array.from(radios)) {
    const input = radio as HTMLInputElement

    // Match by value attribute
    if (input.value === value) {
      input.checked = true
      input.dispatchEvent(new EventCtor('click', { bubbles: true }))
      input.dispatchEvent(new EventCtor('change', { bubbles: true }))
      return true
    }

    // Match by sibling label text (case-insensitive)
    const label = input.id
      ? wrapper.querySelector(`label[for="${input.id}"]`)
      : null
    if (label && label.textContent?.trim().toLowerCase() === value.toLowerCase()) {
      input.checked = true
      input.dispatchEvent(new EventCtor('click', { bubbles: true }))
      input.dispatchEvent(new EventCtor('change', { bubbles: true }))
      return true
    }
  }

  return false
}

/**
 * Fill a text input with React-compatible event dispatch.
 */
function fillTextInput(element: Element, value: string): boolean {
  try {
    if (element.tagName !== 'INPUT') return false
    const input = element as HTMLInputElement
    const win = element.ownerDocument?.defaultView as Window | null
    const EventCtor = win?.Event ?? Event

    input.focus()
    input.dispatchEvent(new EventCtor('focusin', { bubbles: true }))

    const nativeSetter = Object.getOwnPropertyDescriptor(
      win?.HTMLInputElement?.prototype ?? HTMLInputElement.prototype,
      'value',
    )?.set
    if (nativeSetter) {
      nativeSetter.call(input, value)
    } else {
      input.value = value
    }

    const tracker = (input as any)._valueTracker
    if (tracker) tracker.setValue('')

    input.dispatchEvent(new EventCtor('input', { bubbles: true }))
    input.dispatchEvent(new EventCtor('change', { bubbles: true }))
    input.dispatchEvent(new EventCtor('blur', { bubbles: true }))
    input.dispatchEvent(new EventCtor('focusout', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

/**
 * Fill a native <select> element.
 */
function fillNativeSelect(element: Element, value: string): boolean {
  try {
    if (element.tagName !== 'SELECT') return false
    const select = element as HTMLSelectElement
    const win = element.ownerDocument?.defaultView as Window | null
    const EventCtor = win?.Event ?? Event

    let matched = false
    for (const option of Array.from(select.options)) {
      if (option.value === value || option.textContent?.trim().toLowerCase() === value.toLowerCase()) {
        select.value = option.value
        matched = true
        break
      }
    }
    if (!matched) return false

    select.dispatchEvent(new EventCtor('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

/**
 * Wait for a NEW element matching a selector to appear in the document.
 * Ignores elements that existed before the call (passed as `exclude` set).
 * Polls every 50ms up to timeoutMs.
 */
function waitForElement(doc: Document, selector: string, timeoutMs: number, exclude?: Set<Element>): Promise<Element | null> {
  const findNew = () => {
    const all = doc.querySelectorAll(selector)
    for (const el of Array.from(all)) {
      if (!exclude || !exclude.has(el)) return el
    }
    return null
  }

  return new Promise((resolve) => {
    const el = findNew()
    if (el) { resolve(el); return }

    const start = Date.now()
    const interval = setInterval(() => {
      const el = findNew()
      if (el) { clearInterval(interval); resolve(el); return }
      if (Date.now() - start > timeoutMs) { clearInterval(interval); resolve(null) }
    }, 50)
  })
}

/**
 * Find the best matching option in a listbox.
 * Tries exact match first, then case-insensitive exact, then startsWith.
 */
function findMatchingOption(listbox: Element, value: string): Element | null {
  const options = listbox.querySelectorAll('[role="option"]')
  const valueLower = value.toLowerCase().trim()

  // Exact match
  for (const opt of Array.from(options)) {
    if (opt.textContent?.trim() === value) return opt
  }

  // Case-insensitive exact match
  for (const opt of Array.from(options)) {
    if (opt.textContent?.trim().toLowerCase() === valueLower) return opt
  }

  // startsWith match (for "Colorado" matching "Colorado (CO)")
  for (const opt of Array.from(options)) {
    const text = opt.textContent?.trim().toLowerCase() ?? ''
    if (text.startsWith(valueLower)) return opt
  }

  return null
}

/**
 * Fill a Workday custom dropdown widget.
 * Interaction: click button -> wait for listbox -> find option -> click option.
 */
async function fillCustomDropdown(element: Element, value: string): Promise<boolean> {
  try {
    const btn = element as HTMLButtonElement
    const doc = element.ownerDocument
    const win = doc?.defaultView as Window | null

    // 0. Snapshot existing listboxes so we can find the NEW one after click
    const existingListboxes = new Set(Array.from(doc.querySelectorAll('[role="listbox"]')))

    // 1. Click the button to open the dropdown popup
    btn.click()

    // 2. Wait for a NEW listbox to appear (Workday lazy-renders it)
    const listbox = await waitForElement(doc, '[role="listbox"]', 2000, existingListboxes)
    if (!listbox) return false

    // 3. Find matching option
    const option = findMatchingOption(listbox, value)
    if (!option) {
      // Close the dropdown by clicking the button again
      btn.click()
      return false
    }

    // 4. Click the option to select it
    ;(option as HTMLElement).click()

    return true
  } catch {
    return false
  }
}

/**
 * Fill a detected field using the appropriate strategy based on field_type.
 */
async function fillField(field: DetectedField, value: string): Promise<boolean> {
  switch (field.field_type) {
    case 'text':
      return fillTextInput(field.element, value)
    case 'radio':
      return fillRadio(field.element, value)
    case 'select':
      return fillNativeSelect(field.element, value)
    case 'custom-dropdown':
      return fillCustomDropdown(field.element, value)
    case 'checkbox':
      return false  // Out of scope for M4
    default:
      return false
  }
}

export const workdayPlugin: JobBoardPlugin = {
  name: PLUGIN_NAME,
  matches: ['myworkdayjobs.com', '*.myworkdayjobs.com', 'myworkday.com', '*.myworkday.com'],
  capabilities: {
    detectFormFields,
    fillField,
  },
}
