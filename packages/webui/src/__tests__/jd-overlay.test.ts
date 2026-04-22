/**
 * Structural tests for the JD overlay modal (T95.5).
 *
 * These tests read source files and assert on expected patterns rather than
 * rendering components at runtime — matching the project's existing test
 * convention (see component-adoption.test.ts, interactive-systems.test.ts).
 * Runtime verification comes from svelte-check and manual smoke testing.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(import.meta.dir, '..')
const OVERLAYS = join(SRC, 'lib', 'components', 'overlays')
const LAYOUT = join(SRC, 'routes', '+layout.svelte')
const RESUME_LINKED_JDS = join(
  SRC,
  'lib',
  'components',
  'resume',
  'ResumeLinkedJDs.svelte',
)

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('JD overlay: store (jdOverlay.svelte.ts)', () => {
  const content = read(join(OVERLAYS, 'jdOverlay.svelte.ts'))

  test('exports openJDOverlay function', () => {
    expect(content).toContain('export function openJDOverlay')
  })

  test('exports closeJDOverlay function', () => {
    expect(content).toContain('export function closeJDOverlay')
  })

  test('exports jdOverlayState getter object', () => {
    expect(content).toContain('export const jdOverlayState')
    expect(content).toContain('get jdId()')
    expect(content).toContain('get initialData()')
  })

  test('exports JDOverlayInitialData type', () => {
    expect(content).toContain('export type JDOverlayInitialData')
  })

  test('uses module-level $state runes', () => {
    expect(content).toMatch(/let\s+jdId\s*=\s*\$state/)
    expect(content).toMatch(/let\s+initialData\s*=\s*\$state/)
  })

  test('openJDOverlay accepts id and optional data', () => {
    expect(content).toMatch(/openJDOverlay\(\s*id:\s*string,\s*data\?:/)
  })

  test('closeJDOverlay resets both fields', () => {
    expect(content).toMatch(/closeJDOverlay[\s\S]+jdId\s*=\s*null[\s\S]+initialData\s*=\s*undefined/)
  })
})

describe('JD overlay: primitive (JDOverlayModal.svelte)', () => {
  const content = read(join(OVERLAYS, 'JDOverlayModal.svelte'))

  test('wraps base Modal component', () => {
    expect(content).toContain("import Modal from '$lib/components/Modal.svelte'")
    expect(content).toContain('<Modal')
  })

  test('declares expected props', () => {
    expect(content).toContain('open')
    expect(content).toContain('jdId')
    expect(content).toContain('initialData')
    expect(content).toContain('onClose')
    expect(content).toContain("size = 'lg'")
  })

  test('fetches jd and skills in parallel on open', () => {
    expect(content).toContain('forge.jobDescriptions.get(')
    expect(content).toContain('forge.jobDescriptions.listSkills(')
    expect(content).toContain('Promise.all')
  })

  test('has fetch state machine with fetching/loaded/error states', () => {
    expect(content).toContain("'fetching'")
    expect(content).toContain("'loaded'")
    expect(content).toContain("'error'")
  })

  test('has retry function for error state', () => {
    expect(content).toContain('function retry')
  })

  test('renders status badge with accent color', () => {
    expect(content).toContain('STATUS_COLORS')
    expect(content).toContain('jd-overlay-status-badge')
  })

  test('hides metadata strip when location/salary/url all absent', () => {
    expect(content).toContain('hasMetadataStrip')
    expect(content).toMatch(/\{#if\s+hasMetadataStrip\}/)
  })

  test('hides skills section when no skills and no skillsError', () => {
    expect(content).toMatch(/\{#if\s+displaySkills\.length\s*>\s*0\s*\|\|\s*skillsError\}/)
  })

  test('skills partial failure renders "Failed to load skills" message', () => {
    expect(content).toContain("skillsError = 'Failed to load skills'")
    expect(content).toContain('jd-overlay-skills-error')
  })

  test('raw_text rendered with pre-wrap (no innerHTML)', () => {
    expect(content).toContain('white-space: pre-wrap')
    expect(content).not.toContain('{@html')
  })

  test('handleOpenFullPage navigates then closes', () => {
    expect(content).toContain("goto(`/opportunities/job-descriptions?selected=")
    expect(content).toMatch(/handleOpenFullPage[\s\S]+onClose\(\)/)
  })

  test('url link uses safe target and rel', () => {
    expect(content).toContain('target="_blank"')
    expect(content).toContain('rel="noopener noreferrer"')
  })

  test('skills capped with overflow indicator', () => {
    expect(content).toContain('SKILL_LIMIT')
    expect(content).toContain('overflowSkillCount')
    expect(content).toContain('more')
  })

  test('refetches when jdId changes while open', () => {
    expect(content).toContain('fetchedId')
    expect(content).toMatch(/jdId\s*!==\s*fetchedId/)
  })
})

describe('JD overlay: host (JDOverlayHost.svelte)', () => {
  const content = read(join(OVERLAYS, 'JDOverlayHost.svelte'))

  test('imports JDOverlayModal and store', () => {
    expect(content).toContain("import JDOverlayModal from './JDOverlayModal.svelte'")
    expect(content).toContain('jdOverlayState')
    expect(content).toContain('closeJDOverlay')
  })

  test('renders modal driven by store state', () => {
    expect(content).toContain('<JDOverlayModal')
    expect(content).toContain('jdOverlayState.jdId')
    expect(content).toContain('jdOverlayState.initialData')
    expect(content).toContain('onClose={closeJDOverlay}')
  })
})

describe('JD overlay: barrel (index.ts)', () => {
  const content = read(join(OVERLAYS, 'index.ts'))

  test('exports all three pieces and the type', () => {
    expect(content).toContain('JDOverlayModal')
    expect(content).toContain('JDOverlayHost')
    expect(content).toContain('openJDOverlay')
    expect(content).toContain('closeJDOverlay')
    expect(content).toContain('jdOverlayState')
    expect(content).toContain('JDOverlayInitialData')
  })
})

describe('JD overlay: layout mount', () => {
  const content = read(LAYOUT)

  test('imports JDOverlayHost from overlays barrel', () => {
    expect(content).toContain('JDOverlayHost')
  })

  test('mounts the host once', () => {
    const matches = content.match(/<JDOverlayHost/g) ?? []
    expect(matches.length).toBe(1)
  })
})

describe('JD overlay: ResumeLinkedJDs wiring (T95.5 consumer)', () => {
  const content = read(RESUME_LINKED_JDS)

  test('imports openJDOverlay from overlays barrel', () => {
    expect(content).toContain('openJDOverlay')
    expect(content).toContain("from '$lib/components/overlays'")
  })

  test('renders linked JD title as a button, not a span', () => {
    expect(content).toContain('class="linked-card-name-btn"')
    expect(content).not.toMatch(/<span\s+class="linked-card-name"/)
  })

  test('click handler passes initialData subset from JDLink', () => {
    expect(content).toContain('openJDOverlay(')
    expect(content).toContain('jd.job_description_id')
    expect(content).toContain('title: jd.title')
    expect(content).toContain('status: jd.status')
    expect(content).toContain('organization_name: jd.organization_name')
  })
})
