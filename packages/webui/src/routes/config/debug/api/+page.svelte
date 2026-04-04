<script lang="ts">
  import { EmptyState } from '$lib/components'
</script>

<div class="debug-subpage">
  <h1 class="page-title">Forge API Logs</h1>
  <p class="subtitle">Backend HTTP request log</p>

  <EmptyState
    title="Coming soon"
    description="API request and response logs will appear here when the logging endpoint is implemented."
  />
</div>

<style>
  .page-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }

  .subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-bottom: var(--space-6);
  }
</style>
