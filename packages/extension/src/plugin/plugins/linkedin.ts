// packages/extension/src/plugin/plugins/linkedin.ts

import type { JobBoardPlugin, ExtractedJob } from '../types'

const PLUGIN_NAME = 'linkedin'

/**
 * Try multiple selectors in order; return the trimmed text content of the first match.
 * Returns null if none match or if the element's text is empty.
 */
function pickText(doc: Document, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    const text = el?.textContent?.trim()
    if (text) return text
  }
  return null
}

/**
 * Extract the text from a check-small chip wrapper.
 * LinkedIn wraps chip text in nested or sibling spans — instead of reading
 * a single child span, we read textContent from the entire wrapper (the SVG
 * contributes no text, so this gives us the full chip value).
 */
function getCheckSmallChipText(svg: Element): string | null {
  const wrapper = svg.parentElement
  if (!wrapper) return null
  const text = wrapper.textContent?.trim()
  return text || null
}

/**
 * Collect ALL check-small chip texts from the document.
 */
function getAllChipTexts(doc: Document): string[] {
  const svgs = doc.querySelectorAll('svg[id="check-small"]')
  const texts: string[] = []
  for (const svg of Array.from(svgs)) {
    const text = getCheckSmallChipText(svg)
    if (text) texts.push(text)
  }
  return texts
}

/** Content-pattern-based chip classification */
interface ClassifiedChips {
  salary: string | null
  workplace: string | null
  employment: string | null
  experience: string | null
}

/**
 * Classify check-small chip texts by content pattern.
 * This avoids positional dependence — chip order varies between job pages.
 */
function classifyChips(doc: Document): ClassifiedChips {
  const texts = getAllChipTexts(doc)
  const result: ClassifiedChips = {
    salary: null,
    workplace: null,
    employment: null,
    experience: null,
  }

  for (const text of texts) {
    if (!result.salary && /\$[\d,.]+/.test(text)) {
      result.salary = text
    } else if (!result.workplace && /\b(Remote|Hybrid|On-site)\b/i.test(text)) {
      result.workplace = text
    } else if (
      !result.employment &&
      /\b(Full-time|Part-time|Contract|Temporary|Internship)\b/i.test(text)
    ) {
      result.employment = text
    } else if (
      !result.experience &&
      /\b(Entry|Associate|Mid-Senior|Senior|Executive|Director)\b/i.test(text)
    ) {
      result.experience = text
    }
  }

  return result
}

/**
 * Extract description text from the LinkedIn SDUI layout.
 *
 * In the new layout, the raw HTML contains:
 *   <p data-testid="expandable-text-box"><p>…</p><p>…</p></p>
 *
 * Browsers and JSDOM both treat nested <p> as invalid HTML and close the outer
 * <p> immediately, turning the inner <p> elements into siblings. So the marker
 * element ends up empty and the content lives in sibling elements after it.
 *
 * Strategy: find the marker, then collect text from all subsequent siblings
 * in the same parent.
 */
function extractDescriptionSDUI(doc: Document): string | null {
  const marker = doc.querySelector('[data-testid="expandable-text-box"]')
  if (!marker) return null

  const parent = marker.parentElement
  if (!parent) return null

  const children = Array.from(parent.children)
  const markerIndex = children.indexOf(marker as HTMLElement)
  if (markerIndex < 0) return null

  // If the marker itself has content (non-SDUI layout or non-nested case)
  const markerText = marker.textContent?.trim()
  if (markerText) return markerText

  // Collect text from siblings that follow the empty marker
  const parts: string[] = []
  for (let i = markerIndex + 1; i < children.length; i++) {
    const sib = children[i]
    const text = sib.textContent?.trim()
    if (text) parts.push(text)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

/**
 * Extract the external apply URL from LinkedIn's safety redirect link.
 * LinkedIn wraps external apply links as: /safety/go/?url=<encoded_url>&trk=...
 * Returns the decoded destination URL, or null if no external apply link found.
 */
function extractApplyUrl(doc: Document): string | null {
  const applyLink = doc.querySelector(
    'a[data-tracking-control-name*="apply-link-offsite"]'
  ) as HTMLAnchorElement | null

  if (!applyLink?.href) return null

  try {
    const parsed = new URL(applyLink.href)
    const encodedUrl = parsed.searchParams.get('url')
    if (encodedUrl) return decodeURIComponent(encodedUrl)
  } catch {
    // Not a valid URL
  }

  return null
}

/**
 * Extract the company's LinkedIn profile URL from the job detail page.
 * LinkedIn links the company name/logo to /company/<slug>/life/ or similar.
 */
function extractCompanyUrl(doc: Document): string | null {
  const companyLink = doc.querySelector(
    'a[href*="/company/"]'
  ) as HTMLAnchorElement | null

  if (!companyLink?.href) return null

  try {
    const parsed = new URL(companyLink.href)
    const match = parsed.pathname.match(/^\/company\/[^/]+/)
    if (match) {
      return `https://www.linkedin.com${match[0]}/`
    }
  } catch {
    // Not a valid URL
  }

  return null
}

function extractJD(doc: Document, url: string): ExtractedJob | null {
  // ─── Title ────────────────────────────────────────────────────────────────
  // New LinkedIn SDUI layout: title is a <p> directly inside a
  // <div data-display-contents="true">.
  // Fallback selectors cover older public viewer and logged-in viewer layouts.
  const titleSelectors = [
    // New SDUI layout (confirmed in job-detail-standard.html fixture)
    'div[data-display-contents="true"] > p',
    // Legacy public viewer
    'h1.top-card-layout__title',
    'h1.topcard__title',
    '[data-test-id="job-title"]',
    // Legacy logged-in viewer
    'h1.jobs-unified-top-card__job-title',
  ]

  // ─── Company ──────────────────────────────────────────────────────────────
  // New SDUI layout: company name is carried in an aria-label attribute on the
  // company card element: aria-label="Company, Crossing Hurdles." We parse out
  // the name by removing the "Company, " prefix and trailing period.
  //
  // Note: the <a href="…/company/…/life/"> element wraps the logo image and a
  // <p> with the company text, but JSDOM treats that <p href="…"> as a plain
  // <p> (href is invalid on <p>). The textContent of the <a> is effectively
  // empty because the <p> that holds the text is placed outside the <a> by the
  // HTML parser. The aria-label approach is more robust.
  function pickCompany(): string | null {
    // New SDUI layout
    const companyEl = doc.querySelector('[aria-label^="Company,"]')
    if (companyEl) {
      const label = companyEl.getAttribute('aria-label') ?? ''
      const name = label.replace(/^Company,\s*/i, '').replace(/\.\s*$/, '').trim()
      if (name) return name
    }
    // Legacy: visible link text
    return pickText(doc, [
      'a.topcard__org-name-link',
      '[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
    ])
  }

  // ─── Description ──────────────────────────────────────────────────────────
  // New SDUI layout uses data-testid="expandable-text-box" on the <p> that
  // wraps the full job description. Because nested <p> tags are invalid HTML,
  // the actual content becomes siblings after the empty marker element. See
  // extractDescriptionSDUI() for details.
  //
  // Older layouts used show-more-less-html or jobs-description class names.
  function pickDescription(): string | null {
    // Try SDUI sibling-based extraction first
    const sdui = extractDescriptionSDUI(doc)
    if (sdui && sdui.length > 50) return sdui

    // Legacy layouts
    return pickText(doc, [
      'div.show-more-less-html__markup',
      '.jobs-description__content',
      '.jobs-description-content__text',
      '[data-test-id="job-description"]',
    ])
  }

  const title = pickText(doc, titleSelectors)
  const company = pickCompany()
  const description = pickDescription()

  // If we have neither title nor description, the page isn't a job detail page
  if (!title && !description) return null

  // ─── Salary + Location ────────────────────────────────────────────────────
  // New SDUI layout: insight chips use checkmark SVGs (id="check-small") to
  // prefix salary, workplace type, employment type, and experience level.
  // Chip ORDER varies between pages, so we classify by content pattern rather
  // than positional index.
  //
  // Fallback: older layouts had .topcard__flavor--bullet and similar classes.
  let salary: string | null = null
  let location: string | null = null

  const chips = classifyChips(doc)
  if (chips.salary) {
    salary = chips.salary
  }

  // Location: prefer explicit location selectors over workplace chip
  location = pickText(doc, [
    '.job-details-jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet',
    '.jobs-unified-top-card__bullet',
    '[data-test-id="job-location"]',
  ])
  // Fall back to workplace chip (Remote/Hybrid/On-site) if no explicit location found
  if (!location && chips.workplace) {
    location = chips.workplace
  }

  // Fallback selectors for salary on older layouts
  if (!salary) {
    salary = pickText(doc, [
      '.compensation__salary-range',
      '.job-details-jobs-unified-top-card__job-insight span',
    ])
  }

  const rawFields: Record<string, unknown> = {
    found: {
      title,
      company,
      location,
      description: description?.slice(0, 200),
      salary,
    },
  }

  const applyUrl = extractApplyUrl(doc)
  const companyUrl = extractCompanyUrl(doc)

  return {
    title,
    company,
    location,
    salary_range: salary,
    description,
    url,
    extracted_at: new Date().toISOString(),
    source_plugin: PLUGIN_NAME,
    raw_fields: rawFields,
    apply_url: applyUrl,
    company_url: companyUrl,
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname += '/'
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export const linkedinPlugin: JobBoardPlugin = {
  name: PLUGIN_NAME,
  matches: ['linkedin.com', '*.linkedin.com'],
  capabilities: {
    extractJD,
    normalizeUrl,
  },
}
