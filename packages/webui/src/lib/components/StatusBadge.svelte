<script lang="ts">
  let { status }: { status: string } = $props()

  const colorMap: Record<string, string> = {
    draft: 'var(--text-muted)',
    approved: 'var(--color-success)',
    in_review: 'var(--color-warning)',
    pending_review: 'var(--color-warning)',
    rejected: 'var(--color-danger)',
    deriving: 'var(--color-info)',
    final: '#8b5cf6',
    archived: 'var(--text-faint)',
  }

  const labelMap: Record<string, string> = {
    draft: 'Draft',
    approved: 'Approved',
    in_review: 'In Review',
    pending_review: 'Pending Review',
    rejected: 'Rejected',
    deriving: 'Deriving',
    final: 'Final',
    archived: 'Archived',
  }

  let color = $derived(colorMap[status] ?? 'var(--text-muted)')
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
