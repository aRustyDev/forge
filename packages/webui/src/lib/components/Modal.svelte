<!--
  Modal.svelte — Generic modal dialog with focus management.

  Provides standard modal chrome: overlay backdrop, dialog panel with
  configurable size, optional header/body/footer slots, escape-key
  dismissal, backdrop click dismissal, and focus trap with restore.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    onClose,
    size = 'md',
    title = '',
    header,
    body,
    footer,
  }: {
    open: boolean
    onClose: () => void
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    title?: string
    header?: Snippet
    body: Snippet
    footer?: Snippet
  } = $props()

  let dialogRef = $state<HTMLDivElement | null>(null)
  let previouslyFocused: Element | null = null

  // --- Focus management ---

  function getFocusableElements(): HTMLElement[] {
    if (!dialogRef) return []
    return Array.from(
      dialogRef.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
  }

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement
      requestAnimationFrame(() => {
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
          focusable[0].focus()
        }
      })
    } else if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  })

  // --- Keyboard handling ---

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }

    // Focus trap
    if (e.key === 'Tab') {
      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const sizeClass = $derived(`modal-dialog--${size}`)
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={onClose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      bind:this={dialogRef}
      class="modal-dialog {sizeClass}"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {#if header}
        {@render header()}
      {:else if title}
        <div class="modal-header">
          <h3 id="modal-title" class="modal-title">{title}</h3>
          <button class="btn-icon modal-close" onclick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
      {/if}

      <div class="modal-body">
        {@render body()}
      </div>

      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* btn-icon is scoped here for the close button; matches spec */
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
