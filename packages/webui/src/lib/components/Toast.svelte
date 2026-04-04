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
    success: '#22c55e',
    error: '#ef4444',
    info: '#3b82f6',
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
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    color: #fff;
    font-size: 0.875rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    color: #fff;
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
