<!--
  Drawer.svelte — Right sidebar slide-out panel.

  A contextual panel that slides in from the right edge of the viewport.
  Less disruptive than a modal: main content remains visible and partially
  interactive. No focus trap (unlike Modal) — users can Tab back to main
  content. Escape key dismisses. On mobile (<1024px), shows a subtle backdrop.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    onClose,
    title = '',
    width = '320px',
    children,
  }: {
    open: boolean
    onClose: () => void
    title?: string
    width?: string
    children: Snippet
  } = $props()

  let panelRef = $state<HTMLDivElement | null>(null)
  let previouslyFocused: Element | null = null

  // --- Focus management (no trap, just save/restore) ---

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement
      requestAnimationFrame(() => {
        // Focus the panel itself or first focusable element
        if (panelRef) {
          const focusable = panelRef.querySelector<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          if (focusable) {
            focusable.focus()
          } else {
            panelRef.focus()
          }
        }
      })
    } else if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  })

  function handleKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="drawer-backdrop" onclick={onClose} role="presentation"></div>
{/if}

<div
  bind:this={panelRef}
  class="drawer-panel"
  class:drawer-panel--open={open}
  style:width={width}
  style:--drawer-width={width}
  role="complementary"
  aria-label={title}
  tabindex="-1"
>
  <div class="drawer-header">
    <h3 class="drawer-title">{title}</h3>
    <button class="btn-icon" onclick={onClose} aria-label="Close panel">&times;</button>
  </div>
  <div class="drawer-body">
    {@render children()}
  </div>
</div>

<style>
  .drawer-backdrop {
    display: none;
  }

  /* Mobile: show backdrop overlay */
  @media (max-width: 1024px) {
    .drawer-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: calc(var(--z-sidebar) - 1);
      background: rgba(0, 0, 0, 0.15);
      transition: opacity 0.2s ease;
    }
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-sidebar);
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.2s ease;
  }

  .drawer-panel--open {
    transform: translateX(0);
    animation: slide-in-right 0.2s ease;
  }

  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .btn-icon:hover {
    color: var(--text-secondary);
  }
</style>
