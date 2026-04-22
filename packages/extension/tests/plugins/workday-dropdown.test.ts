import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { JSDOM } from 'jsdom'
import { workdayPlugin } from '../../src/plugin/plugins/workday'

const FIXTURE_PATH = resolve(import.meta.dir, '../fixtures/workday/application-form-my-info.html')

let doc: Document

beforeEach(() => {
  const html = readFileSync(FIXTURE_PATH, 'utf-8')
  const dom = new JSDOM(html)
  doc = dom.window.document
})

describe('Workday plugin: dropdown/radio detection', () => {
  test('all detected fields have a field_type property', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    for (const field of fields) {
      expect(field.field_type).toBeDefined()
      expect(['text', 'select', 'custom-dropdown', 'radio', 'checkbox']).toContain(field.field_type)
    }
  })

  test('detects country as custom-dropdown', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const country = fields.find(f => f.field_kind === 'address.country')
    expect(country).toBeDefined()
    expect(country!.field_type).toBe('custom-dropdown')
    expect(country!.element.tagName).toBe('BUTTON')
  })

  test('detects state (countryRegion) as custom-dropdown', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const state = fields.find(f => f.field_kind === 'address.state')
    expect(state).toBeDefined()
    expect(state!.field_type).toBe('custom-dropdown')
    expect(state!.element.tagName).toBe('BUTTON')
  })

  test('detects phoneType as custom-dropdown', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const phoneType = fields.find(f => f.field_kind === 'phone.type')
    expect(phoneType).toBeDefined()
    expect(phoneType!.field_type).toBe('custom-dropdown')
  })

  test('detects candidateIsPreviousWorker as radio', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const radio = fields.find(f => f.field_type === 'radio')
    expect(radio).toBeDefined()
    expect(radio!.label_text).toContain('previously worked')
  })

  test('does not detect multiselect widgets (source, countryPhoneCode)', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const multiselects = fields.filter(f =>
      f.field_kind === 'unknown' && f.label_text?.includes('How Did You Hear')
    )
    expect(multiselects).toHaveLength(0)
  })

  test('text inputs still detected correctly (7 total)', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const textFields = fields.filter(f => f.field_type === 'text')
    expect(textFields).toHaveLength(7)
  })

  test('total detected fields: 7 text + 3 dropdown + 1 radio = 11', () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    expect(fields).toHaveLength(11)
  })
})

describe('Workday plugin: fillRadio', () => {
  test('selects radio by value match (e.g. "false" for No)', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const radio = fields.find(f => f.field_type === 'radio')!
    const ok = await fill(radio, 'false')
    expect(ok).toBe(true)

    // Verify the "No" radio is checked
    const noInput = radio.element.querySelector('input[type="radio"][value="false"]') as HTMLInputElement
    expect(noInput.checked).toBe(true)
  })

  test('selects radio by label text match (case-insensitive)', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const radio = fields.find(f => f.field_type === 'radio')!
    const ok = await fill(radio, 'Yes')
    expect(ok).toBe(true)

    const yesInput = radio.element.querySelector('input[type="radio"][value="true"]') as HTMLInputElement
    expect(yesInput.checked).toBe(true)
  })

  test('returns false for radio with no matching value or label', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const radio = fields.find(f => f.field_type === 'radio')!
    const ok = await fill(radio, 'Maybe')
    expect(ok).toBe(false)
  })
})

describe('Workday plugin: fillCustomDropdown', () => {
  test('fills country dropdown via click-select interaction', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const country = fields.find(f => f.field_kind === 'address.country')!
    const btn = country.element as HTMLButtonElement

    // Simulate Workday's dropdown popup: when button is clicked, a listbox appears
    btn.addEventListener('click', () => {
      // Only create if not already present (check by ID, not role — fixture has a multiselect listbox)
      if (doc.getElementById('test-country-listbox')) return
      const listbox = doc.createElement('div')
      listbox.setAttribute('role', 'listbox')
      listbox.id = 'test-country-listbox'

      const options = ['United States of America', 'Canada', 'United Kingdom']
      for (const text of options) {
        const opt = doc.createElement('div')
        opt.setAttribute('role', 'option')
        opt.textContent = text
        listbox.appendChild(opt)
      }

      doc.body.appendChild(listbox)
    })

    const ok = await fill(country, 'United States of America')
    expect(ok).toBe(true)

    // Clean up
    const listbox = doc.getElementById('test-country-listbox')
    listbox?.remove()
  })

  test('fills state dropdown with fuzzy match (e.g. "Colorado" matches "Colorado (CO)")', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const state = fields.find(f => f.field_kind === 'address.state')!
    const btn = state.element as HTMLButtonElement

    btn.addEventListener('click', () => {
      if (doc.getElementById('test-state-listbox')) return
      const listbox = doc.createElement('div')
      listbox.setAttribute('role', 'listbox')
      listbox.id = 'test-state-listbox'

      const options = ['California (CA)', 'Colorado (CO)', 'Connecticut (CT)']
      for (const text of options) {
        const opt = doc.createElement('div')
        opt.setAttribute('role', 'option')
        opt.textContent = text
        listbox.appendChild(opt)
      }

      doc.body.appendChild(listbox)
    })

    const ok = await fill(state, 'Colorado')
    expect(ok).toBe(true)

    const listbox = doc.getElementById('test-state-listbox')
    listbox?.remove()
  })

  test('returns false when no matching option found', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const state = fields.find(f => f.field_kind === 'address.state')!
    const btn = state.element as HTMLButtonElement

    btn.addEventListener('click', () => {
      if (doc.getElementById('test-state-listbox-2')) return
      const listbox = doc.createElement('div')
      listbox.setAttribute('role', 'listbox')
      listbox.id = 'test-state-listbox-2'

      const opt = doc.createElement('div')
      opt.setAttribute('role', 'option')
      opt.textContent = 'California (CA)'
      listbox.appendChild(opt)

      doc.body.appendChild(listbox)
    })

    const ok = await fill(state, 'Narnia')
    expect(ok).toBe(false)

    const listbox = doc.getElementById('test-state-listbox-2')
    listbox?.remove()
  })
})
