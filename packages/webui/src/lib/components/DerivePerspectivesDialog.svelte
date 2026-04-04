<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner } from '$lib/components'

  let { bulletId, onclose, onderive }: {
    bulletId: string
    onclose: () => void
    onderive: () => void
  } = $props()

  let archetypes = $state<Array<{ id: string; name: string }>>([])
  let domains = $state<Array<{ id: string; name: string }>>([])
  let loadingOptions = $state(true)
  let deriving = $state(false)

  let selectedArchetype = $state('')
  let selectedDomain = $state('')
  let selectedFraming = $state<'accomplishment' | 'responsibility' | 'context'>('accomplishment')

  const FRAMING_OPTIONS: Array<{ value: 'accomplishment' | 'responsibility' | 'context'; label: string }> = [
    { value: 'accomplishment', label: 'Accomplishment' },
    { value: 'responsibility', label: 'Responsibility' },
    { value: 'context', label: 'Context' },
  ]

  let canDerive = $derived(
    !loadingOptions &&
    !deriving &&
    archetypes.length > 0 &&
    domains.length > 0 &&
    selectedArchetype !== '' &&
    selectedDomain !== ''
  )

  $effect(() => {
    loadOptions()
  })

  async function loadOptions() {
    loadingOptions = true

    const [archetypeRes, domainRes] = await Promise.all([
      forge.archetypes.list({ limit: 200 }),
      forge.domains.list({ limit: 200 }),
    ])

    if (archetypeRes.ok) {
      archetypes = archetypeRes.data
      if (archetypes.length > 0) selectedArchetype = archetypes[0].name
    }
    if (domainRes.ok) {
      domains = domainRes.data
      if (domains.length > 0) selectedDomain = domains[0].name
    }

    loadingOptions = false
  }

  async function derive() {
    if (!canDerive) return
    deriving = true

    const res = await forge.bullets.derivePerspectives(bulletId, {
      archetype: selectedArchetype,
      domain: selectedDomain,
      framing: selectedFraming,
    })

    if (res.ok) {
      addToast({ message: 'Perspectives derived successfully', type: 'success' })
      onderive()
      onclose()
    } else {
      addToast({ message: friendlyError(res.error, 'Derivation failed'), type: 'error' })
    }

    deriving = false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onclose()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="dialog-overlay" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Derive Perspectives">
    <div class="dialog-header">
      <h3>Derive Perspectives</h3>
      <button class="close-btn" onclick={onclose}>&times;</button>
    </div>

    <div class="dialog-body">
      {#if loadingOptions}
        <div class="loading-container">
          <LoadingSpinner size="md" message="Loading options..." />
        </div>
      {:else}
        <div class="form-group">
          <label for="derive-archetype">Archetype</label>
          <select id="derive-archetype" bind:value={selectedArchetype}>
            {#each archetypes as arch}
              <option value={arch.name}>{arch.name}</option>
            {/each}
          </select>
          {#if archetypes.length === 0}
            <span class="field-hint">No archetypes available</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="derive-domain">Domain</label>
          <select id="derive-domain" bind:value={selectedDomain}>
            {#each domains as dom}
              <option value={dom.name}>{dom.name}</option>
            {/each}
          </select>
          {#if domains.length === 0}
            <span class="field-hint">No domains available</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="derive-framing">Framing</label>
          <select id="derive-framing" bind:value={selectedFraming}>
            {#each FRAMING_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>

    <div class="dialog-actions">
      <button class="btn btn-ghost" onclick={onclose}>Cancel</button>
      <button class="btn btn-primary" onclick={derive} disabled={!canDerive}>
        {#if deriving}
          Deriving...
        {:else}
          Derive
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .dialog {
    background: #fff;
    border-radius: 8px;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .dialog-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
  }

  .close-btn:hover { color: #374151; }

  .dialog-body {
    padding: 1.25rem;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .form-group select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1a1a1a;
    background: #fff;
    font-family: inherit;
  }

  .form-group select:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .field-hint {
    font-size: 0.7rem;
    color: #ef4444;
    font-style: italic;
    margin-top: 0.2rem;
    display: block;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    padding: 0.45rem 0.9rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-ghost { background: transparent; color: #6b7280; }
  .btn-ghost:hover { color: #374151; background: #f3f4f6; }
</style>
