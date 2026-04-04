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
    border: 2px dashed #d1d5db;
    background: transparent;
    color: #6b7280;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    transition: all 0.15s;
  }

  .btn-add-section:hover {
    border-color: #6c63ff;
    color: #6c63ff;
    background: #f5f3ff;
  }

  .add-section-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    margin-bottom: 0.25rem;
    z-index: 100;
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
    color: #374151;
    font-size: 0.825rem;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .dropdown-item:hover {
    background: #f5f3ff;
    color: #6c63ff;
  }

  .dropdown-item.existing {
    color: #9ca3af;
  }

  .existing-badge {
    font-size: 0.6rem;
    color: #9ca3af;
    font-style: italic;
  }
</style>
