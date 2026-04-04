<script lang="ts">
  import type { Organization } from '@forge/sdk'

  let {
    id = '',
    organizations = [],
    aliases = new Map<string, string[]>(),
    value = $bindable<string | null>(null),
    placeholder = '-- Select --',
    disabled = false,
    oncreate,
  }: {
    id?: string
    organizations: Organization[]
    aliases?: Map<string, string[]>
    value: string | null
    placeholder?: string
    disabled?: boolean
    oncreate?: () => void
  } = $props()

  let query = $state('')
  let open = $state(false)
  let highlightIndex = $state(-1)
  let inputEl: HTMLInputElement | undefined = $state()
  let listEl: HTMLUListElement | undefined = $state()
  let listId = `org-combo-${crypto.randomUUID().slice(0,8)}`

  // Display the selected org name in the input when not focused
  let selectedOrg = $derived(organizations.find(o => o.id === value) ?? null)
  let displayValue = $derived(open ? query : (selectedOrg?.name ?? ''))

  let filtered = $derived.by(() => {
    if (!query.trim()) return organizations
    const q = query.toLowerCase()
    return organizations.filter(o => {
      const aliasMatch = aliases?.get(o.id)?.some(a => a.toLowerCase().includes(q))
      return o.name.toLowerCase().includes(q) || aliasMatch
    })
  })

  function openDropdown() {
    if (disabled) return
    open = true
    query = ''
    highlightIndex = -1
  }

  function closeDropdown() {
    // Small delay to allow click to register on options
    setTimeout(() => {
      open = false
      query = ''
    }, 150)
  }

  function selectOrg(orgId: string) {
    value = orgId
    open = false
    query = ''
  }

  function clearSelection() {
    value = null
    query = ''
    if (inputEl) inputEl.focus()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = filtered.length + (oncreate ? 1 : 0) - 1
      highlightIndex = Math.min(highlightIndex + 1, max)
      scrollToHighlighted()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightIndex = Math.max(highlightIndex - 1, 0)
      scrollToHighlighted()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        selectOrg(filtered[highlightIndex].id)
      } else if (highlightIndex === filtered.length && oncreate) {
        oncreate()
        open = false
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      open = false
      query = ''
    }
  }

  function scrollToHighlighted() {
    if (!listEl) return
    const item = listEl.children[highlightIndex] as HTMLElement | undefined
    if (item) item.scrollIntoView({ block: 'nearest' })
  }
</script>

<div class="combobox" class:disabled>
  <div class="combobox-input-wrap">
    <input
      {id}
      type="text"
      class="combobox-input"
      value={displayValue}
      {placeholder}
      {disabled}
      oninput={(e) => { query = (e.target as HTMLInputElement).value; if (!open) openDropdown() }}
      onfocus={openDropdown}
      onblur={closeDropdown}
      onkeydown={handleKeydown}
      bind:this={inputEl}
      role="combobox"
      aria-expanded={open}
      aria-autocomplete="list"
      aria-controls={listId}
      autocomplete="off"
    />
    {#if value && !disabled}
      <button class="combobox-clear" onclick={clearSelection} type="button" title="Clear selection">&times;</button>
    {/if}
  </div>

  {#if open}
    <ul class="combobox-list" id={listId} bind:this={listEl} role="listbox">
      {#if filtered.length === 0}
        <li class="combobox-empty">No matches found</li>
      {/if}
      {#each filtered as org, i (org.id)}
        <li
          class="combobox-option"
          class:highlighted={i === highlightIndex}
          class:selected={org.id === value}
          role="option"
          aria-selected={org.id === value}
          onmousedown={() => selectOrg(org.id)}
          onmouseenter={() => { highlightIndex = i }}
        >
          <span class="option-name">{org.name}</span>
          {#if org.tags && org.tags.length > 0}
            <span class="option-tags">
              {#each org.tags as tag}
                <span class="option-tag">{tag}</span>
              {/each}
            </span>
          {/if}
        </li>
      {/each}
      {#if oncreate}
        <li
          class="combobox-option combobox-create"
          class:highlighted={highlightIndex === filtered.length}
          role="option"
          onmousedown={() => { oncreate?.(); open = false }}
          onmouseenter={() => { highlightIndex = filtered.length }}
        >
          + Create New Organization
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .combobox {
    position: relative;
    width: 100%;
  }

  .combobox.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .combobox-input-wrap {
    display: flex;
    align-items: center;
    position: relative;
  }

  .combobox-input {
    width: 100%;
    padding: 0.4rem 1.6rem 0.4rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 5px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    background: var(--color-surface);
    font-family: inherit;
  }

  .combobox-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .combobox-clear {
    position: absolute;
    right: 0.3rem;
    background: none;
    border: none;
    font-size: 1rem;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    line-height: 1;
  }

  .combobox-clear:hover {
    color: var(--text-secondary);
  }

  .combobox-list {
    position: absolute;
    z-index: 50;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-top: none;
    border-radius: 0 0 5px 5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .combobox-option {
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .combobox-option:hover,
  .combobox-option.highlighted {
    background: var(--color-primary-subtle);
  }

  .combobox-option.selected {
    background: var(--color-tag-bg);
    font-weight: 500;
  }

  .combobox-empty {
    padding: 0.6rem;
    font-size: 0.78rem;
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
  }

  .combobox-create {
    border-top: 1px solid var(--color-border);
    color: var(--color-primary);
    font-weight: 500;
  }

  .combobox-create:hover,
  .combobox-create.highlighted {
    background: var(--color-primary-subtle);
  }

  .option-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-tags {
    display: flex;
    gap: 0.15rem;
    flex-shrink: 0;
  }

  .option-tag {
    padding: 0.05em 0.25em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: 3px;
    font-size: 0.55rem;
    font-weight: 500;
  }
</style>
