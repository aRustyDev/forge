<!--
  GraphSearchBar.svelte — Autocomplete search bar for graph nodes.
  Matches against node labels, slugs, and content snippets.
  Selecting a result fires onSelect with the node ID.
-->
<script lang="ts">
  import { buildSearchIndex, searchNodes } from './graph.search'
  import type { SearchResult } from './graph.search'
  import type Graph from 'graphology'

  interface GraphSearchBarProps {
    /** The graphology Graph to search over (reads slug attributes) */
    graph: Graph | null
    /** Callback when user selects a result */
    onSelect: (nodeId: string) => void
    /** Placeholder text */
    placeholder?: string
  }

  let {
    graph,
    onSelect,
    placeholder = 'Search graph nodes...',
  }: GraphSearchBarProps = $props()

  let query = $state('')
  let focusedIndex = $state(-1)
  let isOpen = $state(false)

  // Build search index reactively when graph changes
  let searchIndex = $derived(graph ? buildSearchIndex(graph) : [])

  // Compute results reactively when query changes
  let results: SearchResult[] = $derived(searchNodes(query, searchIndex))

  function handleInput(e: Event) {
    query = (e.target as HTMLInputElement).value
    focusedIndex = -1
    isOpen = query.trim().length > 0
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        isOpen = false
        query = ''
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusedIndex = Math.min(focusedIndex + 1, results.length - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusedIndex = Math.max(focusedIndex - 1, 0)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < results.length) {
          selectResult(results[focusedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        isOpen = false
        query = ''
        focusedIndex = -1
        break
    }
  }

  function selectResult(result: SearchResult) {
    onSelect(result.nodeId)
    query = ''
    isOpen = false
    focusedIndex = -1
  }

  function truncate(text: string, maxLen = 60): string {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen) + '...'
  }
</script>

<div class="search-bar-wrapper">
  <div class="search-input-wrapper">
    <svg class="search-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    <input
      type="text"
      class="graph-search-input"
      {placeholder}
      value={query}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={() => { if (query.trim().length > 0) isOpen = true }}
      onblur={() => { setTimeout(() => { isOpen = false }, 150) }}
      role="combobox"
      aria-expanded={isOpen}
      aria-autocomplete="list"
      aria-controls="search-results"
    />
  </div>

  {#if isOpen && results.length > 0}
    <ul class="search-results" id="search-results" role="listbox">
      {#each results as result, i}
        <li
          class="search-result"
          class:focused={i === focusedIndex}
          role="option"
          aria-selected={i === focusedIndex}
          onmousedown={() => selectResult(result)}
          onmouseenter={() => { focusedIndex = i }}
        >
          <span class="result-slug">{result.slug}</span>
          <span class="result-label">{truncate(result.label)}</span>
          {#if result.content}
            <span class="result-content">{truncate(result.content)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search-bar-wrapper {
    position: relative;
    width: 100%;
    max-width: 320px;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, white);
    padding: 0 var(--space-2, 8px);
  }

  .search-icon {
    flex-shrink: 0;
    margin-right: var(--space-2, 6px);
    color: var(--text-muted, #9ca3af);
  }

  .graph-search-input {
    flex: 1;
    border: none;
    outline: none;
    padding: var(--space-2, 6px) 0;
    font-size: var(--text-sm, 0.85rem);
    background: transparent;
    color: var(--text-primary, #374151);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: var(--space-1, 4px) 0 0;
    padding: var(--space-1, 4px) 0;
    list-style: none;
    background: var(--color-surface, white);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 6px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    max-height: 300px;
    overflow-y: auto;
    z-index: var(--z-dropdown, 20);
  }

  .search-result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2, 6px) var(--space-3, 12px);
    cursor: pointer;
  }

  .search-result:hover,
  .search-result.focused {
    background: var(--color-ghost, #f3f4f6);
  }

  .result-slug {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.8rem);
    color: var(--color-primary, #3b82f6);
  }

  .result-label {
    font-size: var(--text-sm, 0.85rem);
    color: var(--text-primary, #374151);
  }

  .result-content {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-muted, #9ca3af);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
