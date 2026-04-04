<script lang="ts">
  const ENTRY_TYPES = [
    { value: 'experience', label: 'Experience', defaultTitle: 'Experience' },
    { value: 'skills', label: 'Skills', defaultTitle: 'Technical Skills' },
    { value: 'education', label: 'Education', defaultTitle: 'Education' },
    { value: 'projects', label: 'Projects', defaultTitle: 'Selected Projects' },
    { value: 'clearance', label: 'Clearance', defaultTitle: 'Security Clearance' },
    { value: 'presentations', label: 'Presentations', defaultTitle: 'Presentations' },
    { value: 'certifications', label: 'Certifications', defaultTitle: 'Certifications' },
    { value: 'awards', label: 'Awards', defaultTitle: 'Awards' },
    { value: 'freeform', label: 'Custom (Freeform)', defaultTitle: 'Custom Section' },
  ]

  let {
    existingTypes,
    onSelect,
  }: {
    existingTypes: string[]
    onSelect: (entryType: string, title: string) => void
  } = $props()

  let showDropdown = $state(false)

  // Show types not yet present first, then all types (user can have multiples)
  let sortedTypes = $derived.by(() => {
    const existing = new Set(existingTypes)
    const notPresent = ENTRY_TYPES.filter(t => !existing.has(t.value))
    const present = ENTRY_TYPES.filter(t => existing.has(t.value))
    return [...notPresent, ...present]
  })

  function handleSelect(entryType: string, defaultTitle: string) {
    onSelect(entryType, defaultTitle)
    showDropdown = false
  }
</script>

<div class="add-section-container">
  <button
    class="btn btn-add-section"
    onclick={() => showDropdown = !showDropdown}
  >
    + Add Section
  </button>
  {#if showDropdown}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="add-section-dropdown">
      {#each sortedTypes as entryType}
        <button
          class="dropdown-item"
          class:existing={existingTypes.includes(entryType.value)}
          onclick={() => handleSelect(entryType.value, entryType.defaultTitle)}
        >
          {entryType.label}
          {#if existingTypes.includes(entryType.value)}
            <span class="existing-badge">exists</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .add-section-container {
    position: relative;
    margin-top: 1rem;
  }

  .btn-add-section {
    width: 100%;
    padding: 0.6rem;
    border: 2px dashed var(--color-border-strong);
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-lg);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    transition: all 0.15s;
  }

  .btn-add-section:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .add-section-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    margin-bottom: 0.25rem;
    z-index: var(--z-dropdown);
    max-height: 300px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.825rem;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  .dropdown-item.existing {
    color: var(--text-faint);
  }

  .existing-badge {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
