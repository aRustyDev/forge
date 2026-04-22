<script lang="ts">
  import { onMount } from 'svelte'
  import { PageHeader } from '$lib/components'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'

  let loading = $state(true)
  let saving = $state(false)

  let usAuthorized = $state<string | null>(null)
  let sponsorship = $state<string | null>(null)

  async function loadAnswers() {
    loading = true
    const result = await forge.answerBank.list()
    if (result.ok) {
      for (const entry of result.data) {
        if (entry.field_kind === 'work_auth.us') usAuthorized = entry.value
        if (entry.field_kind === 'work_auth.sponsorship') sponsorship = entry.value
      }
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
    loading = false
  }

  async function saveField(fieldKind: string, label: string, value: string | null) {
    if (!value) return
    saving = true
    const result = await forge.answerBank.upsert({ field_kind: fieldKind, label, value })
    if (result.ok) {
      addToast({ message: 'Saved', type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
    saving = false
  }

  function handleUsAuth(value: string) {
    usAuthorized = value
    saveField('work_auth.us', 'Are you authorized to work in the United States?', value)
  }

  function handleSponsorship(value: string) {
    sponsorship = value
    saveField('work_auth.sponsorship', 'Will you now or in the future require sponsorship?', value)
  }

  onMount(loadAnswers)
</script>

<div class="settings-page">
  <PageHeader title="Work Authorization" subtitle="Your work authorization status for auto-filling job applications." />

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <form class="settings-form" onsubmit={(e) => e.preventDefault()}>
      <fieldset class="form-fieldset">
        <legend class="form-legend">Are you authorized to work in the United States?</legend>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="us_authorized"
              value="Yes"
              checked={usAuthorized === 'Yes'}
              onchange={() => handleUsAuth('Yes')}
            />
            <span>Yes</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              name="us_authorized"
              value="No"
              checked={usAuthorized === 'No'}
              onchange={() => handleUsAuth('No')}
            />
            <span>No</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="form-fieldset">
        <legend class="form-legend">Will you now or in the future require sponsorship?</legend>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="sponsorship"
              value="Yes"
              checked={sponsorship === 'Yes'}
              onchange={() => handleSponsorship('Yes')}
            />
            <span>Yes</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              name="sponsorship"
              value="No"
              checked={sponsorship === 'No'}
              onchange={() => handleSponsorship('No')}
            />
            <span>No</span>
          </label>
        </div>
      </fieldset>
    </form>
  {/if}
</div>

<style>
  .settings-page {
    max-width: 640px;
  }

  .settings-form {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
  }

  .form-fieldset {
    border: none;
    padding: 0;
    margin: 0 0 var(--space-6) 0;
  }

  .form-fieldset:last-child {
    margin-bottom: 0;
  }

  .form-legend {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .radio-group {
    display: flex;
    gap: var(--space-4);
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    cursor: pointer;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s, background 0.15s;
  }

  .radio-label:hover {
    border-color: var(--color-border-strong);
    background: var(--color-surface-raised);
  }

  .radio-label:has(input:checked) {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
    color: var(--text-primary);
  }

  .radio-label input {
    accent-color: var(--color-primary);
  }

  .loading {
    text-align: center;
    padding: var(--space-8);
    color: var(--text-muted);
  }
</style>
