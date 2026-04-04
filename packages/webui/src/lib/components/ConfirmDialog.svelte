<script lang="ts">
  let {
    open,
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    onconfirm,
    oncancel,
    destructive = true,
  }: {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onconfirm: () => void
    oncancel: () => void
    destructive?: boolean
  } = $props()

  let confirmBtn: HTMLButtonElement | undefined = $state()
  let cancelBtn: HTMLButtonElement | undefined = $state()

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return

    if (e.key === 'Escape') {
      e.preventDefault()
      oncancel()
    }

    // Focus trap between cancel and confirm buttons
    if (e.key === 'Tab') {
      const active = document.activeElement
      if (e.shiftKey && active === cancelBtn) {
        e.preventDefault()
        confirmBtn?.focus()
      } else if (!e.shiftKey && active === confirmBtn) {
        e.preventDefault()
        cancelBtn?.focus()
      }
    }
  }

  $effect(() => {
    if (open) {
      // Focus cancel button when dialog opens
      requestAnimationFrame(() => cancelBtn?.focus())
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="modal-overlay" onclick={oncancel} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-dialog modal-dialog--confirm" onclick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <h3 id="confirm-title" class="dialog-title">{title}</h3>
      <p id="confirm-message" class="dialog-message">{message}</p>
      <div class="form-actions" style="justify-content: flex-end;">
        <button
          bind:this={cancelBtn}
          class="btn btn-ghost"
          onclick={oncancel}
        >
          {cancelLabel}
        </button>
        <button
          bind:this={confirmBtn}
          class="btn"
          class:btn-danger={destructive}
          class:btn-primary={!destructive}
          onclick={onconfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .dialog-message {
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: var(--leading-normal);
    margin-bottom: var(--space-6);
  }
</style>
