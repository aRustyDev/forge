import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { JSDOM } from 'jsdom'
import { workdayPlugin } from '../../src/plugin/plugins/workday'
import { buildProfileFieldMap } from '../../src/lib/profile-map'
import type { ProfileFields } from '../../src/lib/profile-map'

const FIXTURE_PATH = resolve(import.meta.dir, '../fixtures/workday/application-form-my-info.html')

let doc: Document
let dom: JSDOM

beforeEach(() => {
  const html = readFileSync(FIXTURE_PATH, 'utf-8')
  dom = new JSDOM(html)
  doc = dom.window.document
})

const TEST_PROFILE: ProfileFields = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+1 555-0199',
  address: { city: 'Austin', state: 'Texas', country_code: 'US' },
  urls: [{ key: 'linkedin', url: 'https://linkedin.com/in/ada' }],
}

describe('Workday integration: profileFill flow', () => {
  test('fills text inputs from profile', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const values = buildProfileFieldMap(TEST_PROFILE)

    const firstName = fields.find(f => f.field_kind === 'name.first')!
    const ok = await fill(firstName, values['name.first'])
    expect(ok).toBe(true)
    expect((firstName.element as HTMLInputElement).value).toBe('Ada')
  })

  test('fills radio button from profile values', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!

    const radio = fields.find(f => f.field_type === 'radio')!
    const ok = await fill(radio, 'No')
    expect(ok).toBe(true)
  })

  test('fills custom dropdown with simulated popup', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const values = buildProfileFieldMap(TEST_PROFILE)

    const country = fields.find(f => f.field_kind === 'address.country')!
    const btn = country.element as HTMLButtonElement

    // Simulate Workday dropdown popup
    btn.addEventListener('click', () => {
      if (doc.getElementById('test-int-listbox')) return
      const listbox = doc.createElement('div')
      listbox.setAttribute('role', 'listbox')
      listbox.id = 'test-int-listbox'
      for (const name of ['United States of America', 'Canada', 'United Kingdom']) {
        const opt = doc.createElement('div')
        opt.setAttribute('role', 'option')
        opt.textContent = name
        listbox.appendChild(opt)
      }
      doc.body.appendChild(listbox)
    })

    const ok = await fill(country, values['address.country'])
    expect(ok).toBe(true)
    expect(values['address.country']).toBe('United States of America')
  })

  // 3 custom-dropdown fields each wait 2s for a listbox that never appears → need >6s timeout
  test('full profile fill counts: fills text + skips dropdowns without popup', async () => {
    const fields = workdayPlugin.capabilities.detectFormFields!(doc)
    const fill = workdayPlugin.capabilities.fillField!
    const values = buildProfileFieldMap(TEST_PROFILE)

    let filled = 0
    let skipped = 0

    for (const field of fields) {
      const value = values[field.field_kind]
      if (!value || field.field_kind === 'unknown') {
        skipped++
        continue
      }
      const ok = await fill(field, value)
      if (ok) filled++
      else skipped++
    }

    // Text inputs that have profile values: firstName, lastName, city, phone = 4
    // Dropdowns without popup simulation will fail gracefully = skipped
    expect(filled).toBeGreaterThanOrEqual(4)
    expect(filled + skipped).toBe(fields.length)
  }, 15_000)
})
