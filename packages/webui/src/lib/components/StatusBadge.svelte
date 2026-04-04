<script lang="ts">
  let { status }: { status: string } = $props()

  const colorMap: Record<string, string> = {
    draft: '#6b7280',
    approved: '#22c55e',
    pending_review: '#f59e0b',
    rejected: '#ef4444',
    deriving: '#3b82f6',
    final: '#8b5cf6',
  }

  const labelMap: Record<string, string> = {
    draft: 'Draft',
    approved: 'Approved',
    pending_review: 'Pending Review',
    rejected: 'Rejected',
    deriving: 'Deriving',
    final: 'Final',
  }

  let color = $derived(colorMap[status] ?? '#6b7280')
  let label = $derived(labelMap[status] ?? status)
  let pulsing = $derived(status === 'deriving')
</script>

<span
  class="badge"
  class:pulsing
  style:background={color}
>
  {label}
</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.2em 0.6em;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
    line-height: 1.4;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .pulsing {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
</style>
