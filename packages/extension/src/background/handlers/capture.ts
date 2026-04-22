// packages/extension/src/background/handlers/capture.ts

import type { Response } from '../../lib/messaging'
import { extError, mapSdkError, mapNetworkError } from '../../lib/errors'
import { validateExtraction } from '../../lib/validate'
import { resolveOrganization } from '../../lib/resolve-org'
import { normalizeJobUrl } from '../../lib/normalize-url'
import { getClient } from '../client'

export interface CaptureJobPayload {
  id: string
  title: string
}

export async function handleCaptureJob(explicitTabId?: number, forceManual?: boolean): Promise<Response<CaptureJobPayload>> {
  try {
    // 1. Get tab — use explicit tabId if provided, otherwise query active tab
    let tabId: number
    let tabUrl: string
    if (explicitTabId) {
      const tab = await chrome.tabs.get(explicitTabId)
      if (!tab.url) {
        return {
          ok: false,
          error: extError('UNKNOWN_ERROR', 'Tab has no URL', { layer: 'background' }),
        }
      }
      tabId = explicitTabId
      tabUrl = tab.url
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        return {
          ok: false,
          error: extError('UNKNOWN_ERROR', 'No active tab', { layer: 'background' }),
        }
      }
      tabId = tab.id
      tabUrl = tab.url
    }

    // 2. Check host — only LinkedIn supported
    if (!/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(tabUrl)) {
      return {
        ok: false,
        error: extError('NO_PLUGIN_FOR_HOST', 'No plugin for this site yet', {
          layer: 'background',
          url: tabUrl,
        }),
      }
    }

    // 3. Inject content script and extract
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/linkedin.js'],
    })

    const extractResponse = await chrome.tabs.sendMessage(tabId, { cmd: 'extract', forceManual: !!forceManual })

    if (!extractResponse?.ok) {
      return {
        ok: false,
        error: extractResponse?.error ?? extError('EXTRACTION_EMPTY', 'No job found on this page', {
          layer: 'content',
          url: tabUrl,
        }),
      }
    }

    // If the content script showed the overlay for user review, return early
    if (extractResponse.data?.overlayShown) {
      return { ok: true, data: { id: 'pending-overlay', title: 'Review in overlay' } }
    }

    const extracted = extractResponse.data

    // 4. Validate required fields (title + description)
    const validation = validateExtraction(extracted)
    if (!validation.valid) {
      return {
        ok: false,
        error: extError('EXTRACTION_INCOMPLETE', "Couldn't extract job title and description", {
          layer: 'background',
          url: tabUrl,
          context: { missing: validation.missing, raw_fields: extracted.raw_fields },
        }),
      }
    }

    const client = await getClient()

    // 5. Normalize URL and check for existing JD (dedup)
    const canonicalUrl = normalizeJobUrl(extracted.url)

    const lookupResult = await client.jobDescriptions.lookupByUrl(canonicalUrl)
    if (lookupResult.ok) {
      return {
        ok: false,
        error: extError('API_DUPLICATE', 'Job already captured', {
          layer: 'background',
          url: canonicalUrl,
          context: { existing_id: lookupResult.data.id, existing_title: lookupResult.data.title },
        }),
      }
    }
    // NOT_FOUND means no duplicate — continue with creation
    // Any other error (network, server) — skip dedup silently, try to create

    // 6. Resolve organization (search existing or create new)
    const organizationId = await resolveOrganization(
      extracted.company,
      async (search) => {
        const result = await client.organizations.list({ search, limit: 5 })
        return result.ok
          ? { ok: true, data: result.data }
          : { ok: false }
      },
      async (name, opts) => {
        const result = await client.organizations.create({
          name,
          linkedin_url: opts?.linkedin_url,
        })
        return result.ok
          ? { ok: true, data: { id: result.data.id, name: result.data.name } }
          : { ok: false }
      },
      { linkedin_url: extracted.company_url ?? undefined },
    )

    // 7. Create JD in Forge
    const result = await client.jobDescriptions.create({
      title: extracted.title!,
      raw_text: extracted.description!,
      url: canonicalUrl,
      location: extracted.location ?? undefined,
      salary_range: extracted.salary_range ?? undefined,
      organization_id: organizationId ?? undefined,
      // M5a: Parser-derived fields from content script enrichment
      salary_min: extracted.salary_min ?? undefined,
      salary_max: extracted.salary_max ?? undefined,
      salary_period: extracted.salary_period ?? undefined,
      work_posture: extracted.work_posture ?? undefined,
      parsed_locations: extracted.parsed_locations?.length
        ? JSON.stringify(extracted.parsed_locations)
        : undefined,
      parsed_sections: extracted.parsed_sections ?? undefined,
    })

    if (!result.ok) {
      return { ok: false, error: mapSdkError(result.error, { url: '/api/job-descriptions' }) }
    }

    return {
      ok: true,
      data: { id: result.data.id, title: result.data.title },
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/job-descriptions' }) }
  }
}

/**
 * Submit a pre-edited ExtractedJob (from overlay or quiet mode).
 * Runs steps 4-7 of the capture flow: validate → dedup → org resolve → API create.
 */
export async function handleSubmitExtracted(data: Record<string, unknown>): Promise<Response<CaptureJobPayload>> {
  try {
    const extracted = data as Record<string, unknown>

    // 4. Validate required fields (title + description)
    const validation = validateExtraction(extracted)
    if (!validation.valid) {
      return {
        ok: false,
        error: extError('EXTRACTION_INCOMPLETE', "Couldn't extract job title and description", {
          layer: 'background',
          context: { missing: validation.missing, raw_fields: extracted.raw_fields },
        }),
      }
    }

    const client = await getClient()

    // 5. Normalize URL and check for existing JD (dedup)
    const canonicalUrl = normalizeJobUrl(extracted.url as string)

    const lookupResult = await client.jobDescriptions.lookupByUrl(canonicalUrl)
    if (lookupResult.ok) {
      return {
        ok: false,
        error: extError('API_DUPLICATE', 'Job already captured', {
          layer: 'background',
          url: canonicalUrl,
          context: { existing_id: lookupResult.data.id, existing_title: lookupResult.data.title },
        }),
      }
    }

    // 6. Resolve organization (search existing or create new)
    const company = extracted.company as string | null | undefined
    const organizationId = await resolveOrganization(
      company ?? null,
      async (search) => {
        const result = await client.organizations.list({ search, limit: 5 })
        return result.ok
          ? { ok: true, data: result.data }
          : { ok: false }
      },
      async (name, opts) => {
        const result = await client.organizations.create({
          name,
          linkedin_url: opts?.linkedin_url,
        })
        return result.ok
          ? { ok: true, data: { id: result.data.id, name: result.data.name } }
          : { ok: false }
      },
      { linkedin_url: (extracted.company_url as string) ?? undefined },
    )

    // 7. Create JD in Forge
    const result = await client.jobDescriptions.create({
      title: extracted.title as string,
      raw_text: extracted.description as string,
      url: canonicalUrl,
      location: (extracted.location as string) ?? undefined,
      salary_range: (extracted.salary_range as string) ?? undefined,
      organization_id: organizationId ?? undefined,
      salary_min: (extracted.salary_min as number) ?? undefined,
      salary_max: (extracted.salary_max as number) ?? undefined,
      salary_period: (extracted.salary_period as string) ?? undefined,
      work_posture: (extracted.work_posture as string) ?? undefined,
      parsed_locations: (extracted.parsed_locations as string[])?.length
        ? JSON.stringify(extracted.parsed_locations)
        : undefined,
      parsed_sections: (extracted.parsed_sections as string) ?? undefined,
    })

    if (!result.ok) {
      return { ok: false, error: mapSdkError(result.error, { url: '/api/job-descriptions' }) }
    }

    return {
      ok: true,
      data: { id: result.data.id, title: result.data.title },
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/job-descriptions' }) }
  }
}
