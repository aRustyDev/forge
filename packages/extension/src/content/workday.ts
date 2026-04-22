// packages/extension/src/content/workday.ts

import { workdayPlugin } from '../plugin/plugins/workday'

interface TestFillMessage {
  cmd: 'testFill'
}

interface ProfileFillMessage {
  cmd: 'profileFill'
  values: Record<string, string>
}

type IncomingMessage = TestFillMessage | ProfileFillMessage

declare global {
  interface Window {
    __forge_extension_workday_ready?: boolean
  }
}

if (!window.__forge_extension_workday_ready) {
  window.__forge_extension_workday_ready = true

  chrome.runtime.onMessage.addListener((msg: IncomingMessage, _sender, sendResponse) => {
    if (msg.cmd === 'testFill') {
      ;(async () => {
        try {
          const detect = workdayPlugin.capabilities.detectFormFields
          const fill = workdayPlugin.capabilities.fillField
          if (!detect || !fill) {
            sendResponse({
              ok: false,
              error: { code: 'PLUGIN_THREW', message: 'detectFormFields or fillField not defined' },
            })
            return
          }

          const fields = detect(document)
          if (fields.length === 0) {
            sendResponse({
              ok: false,
              error: { code: 'FORM_NOT_DETECTED', message: 'No fillable fields found on this page' },
            })
            return
          }

          let filled = 0
          let failed = 0
          for (const field of fields) {
            const testValue = `FORGE-${field.field_kind}`
            const ok = await fill(field, testValue)
            if (ok) filled++
            else failed++
          }

          sendResponse({ ok: true, data: { filled, failed, total: fields.length } })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          sendResponse({ ok: false, error: { code: 'PLUGIN_THREW', message } })
        }
      })()
      return true
    }

    if (msg.cmd === 'profileFill') {
      ;(async () => {
        try {
          const detect = workdayPlugin.capabilities.detectFormFields
          const fill = workdayPlugin.capabilities.fillField
          if (!detect || !fill) {
            sendResponse({
              ok: false,
              error: { code: 'PLUGIN_THREW', message: 'detectFormFields or fillField not defined' },
            })
            return
          }

          const fields = detect(document)
          if (fields.length === 0) {
            sendResponse({
              ok: false,
              error: { code: 'FORM_NOT_DETECTED', message: 'No fillable fields found on this page' },
            })
            return
          }

          const values = msg.values
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

          sendResponse({ ok: true, data: { filled, skipped, total: fields.length } })
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
