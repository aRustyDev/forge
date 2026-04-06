<!--
  CertPickerModal.svelte — Picker for selecting a certification to add to a
  resume section. Lists all certifications alphabetically, filtering out
  any already pinned to this resume section (via excludeIds).

  Props:
    open        — whether the modal is visible
    onselect    — called with the chosen certification id
    onclose     — called when the user dismisses without selecting
    excludeIds  — list of certification IDs already pinned (omit from list)
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import type { CertificationWithSkills, Organization } from '@forge/sdk'

  let {
    open,
    onselect,
    onclose,
    excludeIds = [],
  }: {
    open: boolean
    onselect: (certificationId: string) => void
    onclose: () => void
    excludeIds?: string[]
  } = $props()

  let allCerts = $state<CertificationWithSkills[]>([])
  let allOrgs = $state<Organization[]>([])
  let loading = $state(false)

  let availableCerts = $derived.by(() => {
    const excluded = new Set(excludeIds)
    return allCerts
      .filter(c => !excluded.has(c.id))
      .sort((a, b) => a.short_name.localeCompare(b.short_name))
  })

  $effect(() => {
    if (open) {
      loadCerts()
    }
  })

  async function loadCerts() {
    loading = true
    try {
      const [certsRes, orgsRes] = await Promise.all([
        forge.certifications.list(),
        forge.organizations.list({ limit: 500 }),
      ])
      if (certsRes.ok) allCerts = certsRes.data
      else addToast({ message: friendlyError(certsRes.error, 'Failed to load certifications'), type: 'error' })
      if (orgsRes.ok) allOrgs = orgsRes.data
    } catch {
      addToast({ message: 'Failed to load certifications', type: 'error' })
    } finally {
      loading = false
    }
  }

  function issuerName(cert: CertificationWithSkills): string | null {
    const org = allOrgs.find(o => o.id === cert.issuer_id)
    return org?.name ?? null
  }
</script>

<Modal {open} {onclose} size="lg" title="Add Certification">
  {#snippet body()}
    {#if loading}
      <div class="picker-loading">Loading certifications…</div>
    {:else if availableCerts.length === 0}
      <div class="picker-empty">
        {allCerts.length === 0
          ? 'No certifications found. Create one in Qualifications → Certifications.'
          : 'All certifications are already on this resume section.'}
      </div>
    {:else}
      <div class="picker-list">
        {#each availableCerts as cert (cert.id)}
          <button
            type="button"
            class="picker-row"
            onclick={() => onselect(cert.id)}
          >
            <span class="picker-short-name">{cert.short_name}</span>
            {#if issuerName(cert)}
              <span class="picker-issuer">{issuerName(cert)}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="picker-footer">
      <button type="button" class="btn btn-ghost" onclick={onclose}>Close</button>
    </div>
  {/snippet}
</Modal>

<style>
  .picker-loading,
  .picker-empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 55vh;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .picker-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    text-align: left;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: border-color 0.12s, background 0.12s;
  }

  .picker-row:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .picker-short-name {
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .picker-issuer {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .picker-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }
</style>
