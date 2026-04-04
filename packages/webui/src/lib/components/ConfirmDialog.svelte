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
  <div class="overlay" onclick={oncancel} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <h3 id="confirm-title" class="title">{title}</h3>
      <p id="confirm-message" class="message">{message}</p>
      <div class="actions">
        <button
          bind:this={cancelBtn}
          class="btn btn-cancel"
          onclick={oncancel}
        >
          {cancelLabel}
        </button>
        <button
          bind:this={confirmBtn}
          class="btn btn-confirm"
          class:destructive
          onclick={onconfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }

  .message {
    font-size: 0.9rem;
    color: #4b5563;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
  }

  .btn-cancel {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-cancel:hover {
    background: #e5e7eb;
  }

  .btn-confirm {
    background: #6c63ff;
    color: #fff;
  }

  .btn-confirm:hover {
    background: #5a52e0;
  }

  .btn-confirm.destructive {
    background: #ef4444;
  }

  .btn-confirm.destructive:hover {
    background: #dc2626;
  }
</style>
