<script lang="ts">
  import { onMount } from 'svelte'
  import { PageHeader } from '$lib/components'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'

  let loading = $state(true)
  let saving = $state(false)

  let gender = $state('')
  let race = $state('')
  let veteran = $state('')
  let disability = $state('')

  const GENDER_OPTIONS = [
    'Male',
    'Female',
    'Non-binary',
    'Prefer not to say',
    'Decline to self-identify',
  ]

  const RACE_OPTIONS = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Two or More Races',
    'Decline to self-identify',
  ]

  const VETERAN_OPTIONS = [
    'Protected Veteran',
    'Not a Veteran',
    'Prefer not to say',
  ]

  const DISABILITY_OPTIONS = [
    'Yes, I have a disability (or previously had a disability)',
    'No, I do not have a disability',
    'Prefer not to say',
  ]

  async function loadAnswers() {
    loading = true
    const result = await forge.answerBank.list()
    if (result.ok) {
      for (const entry of result.data) {
        if (entry.field_kind === 'eeo.gender') gender = entry.value
        if (entry.field_kind === 'eeo.race') race = entry.value
        if (entry.field_kind === 'eeo.veteran') veteran = entry.value
        if (entry.field_kind === 'eeo.disability') disability = entry.value
      }
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
    loading = false
  }

  async function saveField(fieldKind: string, label: string, value: string) {
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

  function handleGender(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    gender = value
    if (value) saveField('eeo.gender', 'Gender', value)
  }

  function handleRace(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    race = value
    if (value) saveField('eeo.race', 'Race / Ethnicity', value)
  }

  function handleVeteran(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    veteran = value
    if (value) saveField('eeo.veteran', 'Veteran Status', value)
  }

  function handleDisability(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    disability = value
    if (value) saveField('eeo.disability', 'Disability Status', value)
  }

  onMount(loadAnswers)
</script>

<div class="settings-page">
  <PageHeader title="EEO Voluntary Disclosures" subtitle="Equal Employment Opportunity self-identification for auto-filling job applications." />

  <div class="disclaimer">
    These responses are used to auto-fill voluntary disclosure fields on job applications. They are stored locally in your Forge database and never shared externally.
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <form class="settings-form" onsubmit={(e) => e.preventDefault()}>
      <div class="form-field">
        <label for="eeo-gender">Gender</label>
        <select id="eeo-gender" value={gender} onchange={handleGender}>
          <option value="">Select...</option>
          {#each GENDER_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="eeo-race">Race / Ethnicity</label>
        <select id="eeo-race" value={race} onchange={handleRace}>
          <option value="">Select...</option>
          {#each RACE_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="eeo-veteran">Veteran Status</label>
        <select id="eeo-veteran" value={veteran} onchange={handleVeteran}>
          <option value="">Select...</option>
          {#each VETERAN_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="eeo-disability">Disability Status</label>
        <select id="eeo-disability" value={disability} onchange={handleDisability}>
          <option value="">Select...</option>
          {#each DISABILITY_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>
    </form>
  {/if}
</div>

<style>
  .settings-page {
    max-width: 640px;
  }

  .disclaimer {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-warning, var(--color-primary));
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    margin-bottom: var(--space-6);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .settings-form {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .form-field label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
  }

  .form-field select {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s;
    cursor: pointer;
  }

  .form-field select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .loading {
    text-align: center;
    padding: var(--space-8);
    color: var(--text-muted);
  }
</style>
