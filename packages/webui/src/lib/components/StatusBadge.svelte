<script lang="ts">
  let { status }: { status: string } = $props()

  const colorMap: Record<string, string> = {
    draft: 'var(--text-muted)',
    approved: 'var(--color-success)',
    in_review: 'var(--color-warning)',
    rejected: 'var(--color-danger)',
    deriving: 'var(--color-info)',
    archived: 'var(--text-faint)',
    // JD statuses
    discovered: '#7c3aed',
    analyzing: 'var(--color-info)',
    applying: '#d97706',
    applied: '#6366f1',
    interviewing: '#a855f7',
    offered: 'var(--color-success)',
    withdrawn: '#f97316',
    closed: '#374151',
  }

  const labelMap: Record<string, string> = {
    draft: 'Draft',
    approved: 'Approved',
    in_review: 'In Review',
    rejected: 'Rejected',
    deriving: 'Deriving',
    archived: 'Archived',
    // JD statuses
    discovered: 'Discovered',
    analyzing: 'Analyzing',
    applying: 'Applying',
    applied: 'Applied',
    interviewing: 'Interviewing',
    offered: 'Offered',
    withdrawn: 'Withdrawn',
    closed: 'Closed',
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
