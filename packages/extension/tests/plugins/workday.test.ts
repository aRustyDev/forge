import { describe, test, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { JSDOM } from 'jsdom'
import { workdayPlugin } from '../../src/plugin/plugins/workday'

const FIXTURE_PATH = resolve(import.meta.dir, '../fixtures/workday/application-form-my-info.html')

let doc: Document

beforeAll(() => {
  const html = readFileSync(FIXTURE_PATH, 'utf-8')
  const dom = new JSDOM(html)
  doc = dom.window.document
})

describe('Workday plugin: detectFormFields', () => {
  test('detects text input fields from fixture', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) {
      expect(field.element).toBeDefined()
      expect(field.field_kind).toBeDefined()
    }
  })

  test('detects firstName and lastName with correct kinds', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const kinds = fields.map(f => f.field_kind)
    expect(kinds).toContain('name.first')
    expect(kinds).toContain('name.last')
  })

  test('detects city as address.city', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const cityField = fields.find(f => f.field_kind === 'address.city')
    expect(cityField).toBeDefined()
    expect(cityField!.label_text).toContain('City')
  })

  test('detects phoneNumber as phone', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const phoneField = fields.find(f => f.field_kind === 'phone')
    expect(phoneField).toBeDefined()
  })

  test('marks required fields correctly', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const firstName = fields.find(f => f.field_kind === 'name.first')
    const extension = fields.find(f => f.label_text?.includes('Extension'))
    expect(firstName!.required).toBe(true)
    expect(extension!.required).toBe(false)
  })

  test('text fields are all INPUT elements with text type', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const textFields = fields.filter(f => f.field_type === 'text')
    for (const field of textFields) {
      const el = field.element as HTMLInputElement
      expect(el.tagName).toBe('INPUT')
      const type = el.type?.toLowerCase() ?? 'text'
      expect(['text', ''].includes(type)).toBe(true)
    }
  })

  test('detects exactly 7 text input fields from fixture', () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fields = detect(doc)
    const textFields = fields.filter(f => f.field_type === 'text')
    expect(textFields).toHaveLength(7)
  })
})

describe('Workday plugin: fillField', () => {
  test('fills a text input and returns true', async () => {
    const detect = workdayPlugin.capabilities.detectFormFields!
    const fill = workdayPlugin.capabilities.fillField!
    const fields = detect(doc)
    const firstName = fields.find(f => f.field_kind === 'name.first')!
    const ok = await fill(firstName, 'FORGE-name.first')
    expect(ok).toBe(true)
    expect((firstName.element as HTMLInputElement).value).toBe('FORGE-name.first')
  })
})
