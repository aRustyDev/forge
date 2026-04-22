// packages/extension/src/background/index.ts

import type { Command, Response } from '../lib/messaging'
import { handleHealth } from './handlers/health'
import { handleOrgsList, handleOrgsCreate } from './handlers/orgs'
import { handleTestFill } from './handlers/form'
import { handleCaptureJob, handleSubmitExtracted } from './handlers/capture'
import { handleAnswersList } from './handlers/answers'
import { handleProfileFill } from './handlers/autofill'
import { reportError, extError } from '../lib/errors'

// ── Context Menu ──────────────────────────────────────────────────────────
// Register on install (runs once per extension install/update)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'forge-capture-job',
    title: 'Capture to Forge',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://*.linkedin.com/jobs/*',
      '*://*.myworkdayjobs.com/*',
      '*://*.myworkday.com/*',
    ],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'forge-capture-job') return
  if (!tab?.id) return

  const result = await handleCaptureJob(tab.id)

  // Set badge to indicate success/failure/overlay
  const isOverlay = result.ok && (result.data as any)?.id === 'pending-overlay'
  const badgeText = isOverlay ? '\u270e' : result.ok ? '\u2713' : '!'
  const badgeColor = isOverlay ? '#66f' : result.ok ? '#4a4' : '#a44'
  chrome.action.setBadgeText({ text: badgeText, tabId: tab.id })
  chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: tab.id })

  // Clear badge after 3 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', tabId: tab?.id })
  }, 3000)
})

chrome.runtime.onMessage.addListener(
  (msg: Command, _sender, sendResponse: (response: Response<unknown>) => void) => {
    // Route by cmd. Each handler is async, so we return true to keep the
    // channel open until sendResponse is called.
    ;(async () => {
      let response: Response<unknown>
      switch (msg.cmd) {
        case 'health':
          response = await handleHealth()
          break
        case 'orgs.list':
          response = await handleOrgsList(msg.limit)
          break
        case 'orgs.create':
          response = await handleOrgsCreate(msg.payload)
          break
        case 'form.testFill':
          response = await handleTestFill()
          break
        case 'form.profileFill':
          response = await handleProfileFill()
          break
        case 'jd.captureActive':
          response = await handleCaptureJob(undefined, msg.forceManual)
          break
        case 'jd.submitExtracted':
          response = await handleSubmitExtracted(msg.data as Record<string, unknown>)
          break
        case 'answers.list':
          response = await handleAnswersList()
          break
        default: {
          const err = extError('UNKNOWN_ERROR', `Unknown command: ${JSON.stringify(msg)}`, { layer: 'background' })
          reportError(err)
          response = { ok: false, error: err }
          break
        }
      }
      sendResponse(response)
    })()
    return true // async response
  },
)
