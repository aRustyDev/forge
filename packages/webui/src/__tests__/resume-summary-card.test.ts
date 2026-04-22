/**
 * Structural tests for the Resume Summary Card feature (T95.2).
 *
 * These tests read source files and assert on expected patterns rather
 * than rendering components at runtime — matching the project's
 * existing test convention.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(import.meta.dir, '..')
const COMPONENTS = join(SRC, 'lib', 'components', 'resume')
const CARD = join(COMPONENTS, 'ResumeSummaryCard.svelte')
const PICKER = join(COMPONENTS, 'SummaryPickerModal.svelte')
const DND = join(COMPONENTS, 'DragNDropView.svelte')
const PAGE = join(SRC, 'routes', 'resumes', '+page.svelte')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('ResumeSummaryCard component', () => {
  const content = read(CARD)

  test('declares the expected props', () => {
    expect(content).toContain('summary: ResumeSummary | null')
    expect(content).toContain('onUpdateSummary')
    expect(content).toContain('summary_id?: string | null')
    expect(content).toContain('summary_override?: string | null')
  })

  test('imports SummaryPickerModal', () => {
    expect(content).toContain("import SummaryPickerModal from './SummaryPickerModal.svelte'")
  })

  test('imports ResumeSummary type from @forge/sdk', () => {
    expect(content).toContain("import type { ResumeSummary } from '@forge/sdk'")
  })

  test('renders empty state when summary is null', () => {
    expect(content).toContain('No summary selected')
    expect(content).toContain('+ Select Summary')
  })

  test('renders template label including EDITED badge on override', () => {
    expect(content).toContain('summary.is_override')
    expect(content).toContain('EDITED')
  })

  test('has handleUnlink that clears both summary_id and summary_override', () => {
    expect(content).toMatch(/handleUnlink[\s\S]+summary_id:\s*null[\s\S]+summary_override:\s*null/)
  })

  test('has handleResetToTemplate that clears only summary_override', () => {
    expect(content).toMatch(/handleResetToTemplate[\s\S]+summary_override:\s*null/)
  })

  test('handlePickSelect passes chosen summary_id and clears any prior override', () => {
    expect(content).toMatch(/handlePickSelect[\s\S]+summary_id:\s*summaryId[\s\S]+summary_override:\s*null/)
  })

  test('handlePickFreeform sends summary_id=null with the freeform text', () => {
    expect(content).toMatch(/handlePickFreeform[\s\S]+summary_id:\s*null[\s\S]+summary_override:\s*text/)
  })

  test('has saveEdit that persists the textarea value via summary_override', () => {
    expect(content).toMatch(/saveEdit[\s\S]+summary_override:\s*editText/)
  })

  test('has handlePromoteSave that creates a new summary then links it', () => {
    expect(content).toContain('forge.summaries.create')
    expect(content).toContain("is_template: false")
    expect(content).toMatch(/handlePromoteSave[\s\S]+summary_id:\s*createResult\.data\.id[\s\S]+summary_override:\s*null/)
  })

  test('Promote button appears when override is active (States 3 and 4)', () => {
    // Promote is available whenever there's an override — both freeform-only
    // (no summary_id) and overridden template (has summary_id). You might want
    // to save edited template text as a new reusable template in either case.
    expect(content).toMatch(/summary\.is_override[\s\S]*Promote to Template/)
    expect(content).toContain('Promote to Template')
  })

  test('Reset to template button only appears when template is overridden', () => {
    // The reset action is gated by is_override && summary_id
    expect(content).toMatch(/is_override\s*&&\s*summary\.summary_id/)
    expect(content).toContain('Reset to template')
  })

  test('uses global btn classes per ui-shared-components rule #4', () => {
    expect(content).toContain('btn btn-primary')
    expect(content).toContain('btn btn-ghost')
  })
})

describe('SummaryPickerModal component', () => {
  const content = read(PICKER)

  test('wraps base Modal primitive', () => {
    expect(content).toContain("import Modal from '$lib/components/Modal.svelte'")
    expect(content).toContain('<Modal')
  })

  test('fetches summaries via the SDK', () => {
    expect(content).toContain('forge.summaries.list')
  })

  test('sorts templates first then alphabetical within groups', () => {
    expect(content).toContain('is_template')
    expect(content).toContain('localeCompare')
  })

  test('has two modes: pick and freeform', () => {
    expect(content).toMatch(/mode\s*=\s*\$state<'pick'\s*\|\s*'freeform'>/)
  })

  test('has onselect and onfreeform callbacks', () => {
    expect(content).toContain('onselect')
    expect(content).toContain('onfreeform')
  })

  test('renders template badge on is_template=1 rows', () => {
    expect(content).toContain('summary.is_template')
    expect(content).toContain('picker-template-badge')
  })

  test('Write my own button switches mode to freeform', () => {
    expect(content).toContain("+ Write my own")
    expect(content).toContain("mode = 'freeform'")
  })
})

describe('DragNDropView renders ResumeSummaryCard', () => {
  const content = read(DND)

  test('imports ResumeSummaryCard', () => {
    expect(content).toContain("import ResumeSummaryCard from './ResumeSummaryCard.svelte'")
  })

  test('declares onUpdateSummary prop', () => {
    expect(content).toContain('onUpdateSummary')
  })

  test('renders the card when onUpdateSummary is provided', () => {
    expect(content).toContain('<ResumeSummaryCard')
    expect(content).toContain('summary={ir.summary}')
  })
})

describe('resumes/+page.svelte wires onUpdateSummary', () => {
  const content = read(PAGE)

  test('passes onUpdateSummary to DragNDropView', () => {
    expect(content).toContain('onUpdateSummary')
    expect(content).toContain('forge.resumes.update')
  })

  test('reloads the IR after a successful update', () => {
    expect(content).toMatch(/onUpdateSummary[\s\S]+forge\.resumes\.update[\s\S]+loadIR/)
  })
})
