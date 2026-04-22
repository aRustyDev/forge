<script lang="ts">
  import { onMount } from 'svelte'
  import { sendCommand } from '../lib/messaging'
  import type { HealthPayload } from '../background/handlers/health'
  import type { OrgsListPayload, OrgsCreatePayload } from '../background/handlers/orgs'
  import type { ProfileFillPayload } from '../background/handlers/autofill'
  import type { CaptureJobPayload } from '../background/handlers/capture'

  type HealthState = 'unknown' | 'ok' | 'down'

  let healthState = $state<HealthState>('unknown')

  const extVersion = chrome.runtime.getManifest().version

  let status = $state<string | null>(null)
  let statusKind = $state<'info' | 'ok' | 'err'>('info')

  let orgs = $state<Array<{ name: string }>>([])
  let orgsTotal = $state(0)

  onMount(async () => {
    await checkHealth()
  })

  async function checkHealth() {
    const response = await sendCommand<HealthPayload>({ cmd: 'health' })
    if (response.ok) {
      healthState = 'ok'
    } else {
      healthState = 'down'
    }
  }

  async function captureJob(forceManual = false) {
    status = 'Capturing job...'
    statusKind = 'info'
    const response = await sendCommand<CaptureJobPayload>({ cmd: 'jd.captureActive', forceManual })
    if (response.ok) {
      if (response.data.id === 'pending-overlay') {
        status = 'Review in overlay panel'
        statusKind = 'info'
      } else {
        status = `JD created: ${response.data.id.slice(0, 8)}...`
        statusKind = 'ok'
      }
    } else {
      const code = response.error.code
      if (code === 'NO_PLUGIN_FOR_HOST') {
        status = 'No plugin for this site yet'
      } else if (code === 'EXTRACTION_INCOMPLETE') {
        status = "Couldn't extract job title and description"
      } else if (code === 'EXTRACTION_EMPTY') {
        status = 'No job found on this page'
      } else if (code === 'API_UNREACHABLE') {
        status = 'Forge is not running'
      } else if (code === 'API_DUPLICATE') {
        const existingId = response.error.context?.existing_id
        status = existingId
          ? `Already captured (${String(existingId).slice(0, 8)}...)`
          : 'Job already captured'
      } else {
        status = `Error: ${response.error.message}`
      }
      statusKind = 'err'
    }
  }

  async function listOrgs() {
    status = 'Loading orgs...'
    statusKind = 'info'
    const response = await sendCommand<OrgsListPayload>({ cmd: 'orgs.list', limit: 5 })
    if (response.ok) {
      orgs = response.data.orgs.map((o) => ({ name: o.name }))
      orgsTotal = response.data.total
      status = `Loaded ${orgs.length} of ${orgsTotal}`
      statusKind = 'ok'
    } else {
      const code = response.error.code
      if (code === 'API_UNREACHABLE') {
        status = 'Forge is not running'
      } else if (code === 'API_CORS_BLOCKED') {
        status = 'CORS blocked — check Forge config'
      } else {
        status = `Error: ${response.error.message}`
      }
      statusKind = 'err'
    }
  }

  async function autofill() {
    status = 'Loading profile...'
    statusKind = 'info'

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      status = 'No active tab'
      statusKind = 'err'
      return
    }

    const url = tab.url ?? ''
    if (!/myworkday(jobs)?\.com/i.test(url)) {
      status = 'Not a Workday page'
      statusKind = 'err'
      return
    }

    const response = await sendCommand<ProfileFillPayload>({ cmd: 'form.profileFill' })
    if (response.ok) {
      const { filled, skipped, total } = response.data
      status = `Filled ${filled}/${total} fields` + (skipped > 0 ? ` (${skipped} need answer bank)` : '')
      statusKind = filled > 0 ? 'ok' : 'info'
    } else {
      const code = response.error.code
      if (code === 'FORM_NOT_DETECTED') {
        status = 'No form fields found on this page'
      } else if (code === 'PROFILE_NOT_AVAILABLE') {
        status = 'Profile not loaded from Forge'
      } else if (code === 'API_UNREACHABLE') {
        status = 'Forge is not running'
      } else {
        status = `Error: ${response.error.message}`
      }
      statusKind = 'err'
    }
  }

  async function createTestOrg() {
    const name = `Test Org ${Date.now()}`
    status = `Creating "${name}"...`
    statusKind = 'info'
    const response = await sendCommand<OrgsCreatePayload>({ cmd: 'orgs.create', payload: { name } })
    if (response.ok) {
      status = `Created org ${response.data.id.slice(0, 8)}...`
      statusKind = 'ok'
    } else {
      const code = response.error.code
      if (code === 'API_UNREACHABLE') {
        status = 'Forge is not running'
      } else if (code === 'API_VALIDATION_FAILED') {
        status = 'Validation error — check payload'
      } else {
        status = `Error: ${response.error.message}`
      }
      statusKind = 'err'
    }
  }
</script>

<main>
  <header>
    <h1>Forge</h1>
    <div class="health" class:ok={healthState === 'ok'} class:down={healthState === 'down'}>
      <span class="dot"></span>
      <span class="label">
        v{extVersion}
        {#if healthState === 'down'}(Offline){/if}
      </span>
    </div>
  </header>

  <div class="buttons">
    <button onclick={(e) => captureJob(e.shiftKey)}>Capture Job</button>
    <button onclick={listOrgs} class="secondary">List Organizations</button>
    <button onclick={createTestOrg} class="secondary">Create Test Org</button>
    <button onclick={autofill} class="secondary">Autofill</button>
  </div>

  {#if status}
    <p class="status {statusKind}">{status}</p>
  {/if}

  {#if orgs.length > 0}
    <ul class="orgs">
      {#each orgs as org}
        <li>{org.name}</li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main { padding: 16px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  h1 { margin: 0; font-size: 16px; color: #88f; }
  .health { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #888; }
  .health .dot { width: 8px; height: 8px; border-radius: 50%; background: #666; }
  .health.ok .dot { background: #4a4; box-shadow: 0 0 4px #4a4; }
  .health.down .dot { background: #a44; box-shadow: 0 0 4px #a44; }
  .health.ok .label { color: #aca; }
  .health.down .label { color: #caa; }
  .buttons { display: flex; flex-direction: column; gap: 6px; }
  button { width: 100%; background: #335; color: #fff; border: 1px solid #557; padding: 10px 12px; border-radius: 4px; cursor: pointer; font-size: 14px; }
  button:hover { background: #446; }
  button.secondary { background: #233; border-color: #355; font-size: 12px; padding: 8px; }
  button.secondary:hover { background: #344; }
  .status { margin: 12px 0 0 0; padding: 8px; border-radius: 4px; font-size: 12px; }
  .status.info { background: #223; color: #aac; }
  .status.ok { background: #232; color: #afa; }
  .status.err { background: #322; color: #faa; }
  .orgs { margin: 12px 0 0 0; padding: 0; list-style: none; font-size: 11px; }
  .orgs li { padding: 4px 8px; background: #222; border-radius: 3px; margin-bottom: 2px; word-break: break-all; }
</style>
