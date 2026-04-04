<script lang="ts">
  import type { ToastType } from '$lib/stores/toast.svelte'

  let { message, type = 'info', duration = 4000, onclose }: {
    message: string
    type?: ToastType
    duration?: number
    onclose: () => void
  } = $props()

  let visible = $state(false)

  const colorMap: Record<ToastType, string> = {
    success: 'var(--color-success)',
    error: 'var(--color-danger)',
    info: 'var(--color-info)',
  }

  $effect(() => {
    // Trigger slide-in on next frame
    requestAnimationFrame(() => {
      visible = true
    })

    const timer = setTimeout(() => {
      dismiss()
    }, duration)

    return () => clearTimeout(timer)
  })

  function dismiss() {
    visible = false
    setTimeout(() => onclose(), 200)
  }
</script>

<div
  class="toast"
  class:visible
  style:background={colorMap[type]}
  role="alert"
>
  <span class="message">{message}</span>
  <button class="close" onclick={dismiss} aria-label="Dismiss notification">
    &times;
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    color: var(--text-inverse);
    font-size: var(--text-base);
    box-shadow: var(--shadow-md);
    transform: translateX(120%);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;
    max-width: 360px;
    word-break: break-word;
  }

  .toast.visible {
    transform: translateX(0);
    opacity: 1;
  }

  .message {
    flex: 1;
  }

  .close {
    background: none;
    border: none;
    color: var(--text-inverse);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
    flex-shrink: 0;
  }

  .close:hover {
    opacity: 1;
  }
</style>
