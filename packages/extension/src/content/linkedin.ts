// packages/extension/src/content/linkedin.ts

import { linkedinPlugin } from '../plugin/plugins/linkedin'
import { enrichWithParser } from '../lib/enrich-extraction'
import { shouldShowOverlay, loadConfidenceFloors } from '../lib/confidence'
import { showOverlay } from './overlay'
import { showToast } from './toast'

interface ExtractMessage {
  cmd: 'extract'
  forceManual?: boolean
}

type IncomingMessage = ExtractMessage

declare global {
  interface Window {
    __forge_extension_linkedin_ready?: boolean
  }
}

import { injectCaptureButton, observeForInjection } from './inject-button'

if (!window.__forge_extension_linkedin_ready) {
  window.__forge_extension_linkedin_ready = true

  setTimeout(() => injectCaptureButton(document), 500)
  observeForInjection(document)

  chrome.runtime.onMessage.addListener((msg: IncomingMessage, _sender, sendResponse) => {
    if (msg.cmd === 'extract') {
      ;(async () => {
        try {
          const extract = linkedinPlugin.capabilities.extractJD
          if (!extract) {
            sendResponse({ ok: false, error: { code: 'PLUGIN_THREW', message: 'extractJD not defined' } })
            return
          }
          const result = extract(document, location.href)
          if (!result) {
            sendResponse({ ok: false, error: { code: 'EXTRACTION_EMPTY', message: 'Plugin returned null' } })
            return
          }

          const enriched = enrichWithParser(result)
          const floors = await loadConfidenceFloors()
          const forceManual = !!msg.forceManual

          if (shouldShowOverlay(enriched.confidence, floors, forceManual)) {
            showOverlay(enriched.extracted, enriched.confidence, {
              onSubmit: async (edited) => {
                const submitResponse = await chrome.runtime.sendMessage({
                  cmd: 'jd.submitExtracted',
                  data: edited,
                })
                if (submitResponse?.ok) {
                  showToast(`Captured: ${edited.title} at ${edited.company}`)
                } else {
                  const code = submitResponse?.error?.code
                  if (code === 'API_DUPLICATE') {
                    showToast('Job already captured')
                  } else {
                    showToast(`Error: ${submitResponse?.error?.message ?? 'Unknown error'}`)
                  }
                }
              },
              onCancel: () => { /* dismissed */ },
            })
            sendResponse({ ok: true, data: { overlayShown: true } })
          } else {
            const submitResponse = await chrome.runtime.sendMessage({
              cmd: 'jd.submitExtracted',
              data: enriched.extracted,
            })
            if (submitResponse?.ok) {
              showToast(`Captured: ${enriched.extracted.title} at ${enriched.extracted.company}`)
            }
            sendResponse(submitResponse)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          sendResponse({ ok: false, error: { code: 'PLUGIN_THREW', message } })
        }
      })()
      return true
    }
    return false
  })
}
