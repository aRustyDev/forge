<script lang="ts">
  import { EmptyState } from '$lib/components'
</script>

<div class="debug-page">
  <h1 class="page-title">Prompt Logs</h1>
  <p class="subtitle">AI derivation audit trail</p>

  <EmptyState
    title="Coming soon"
    description="Prompt logs will appear here after AI derivation runs. A dedicated logs endpoint is in progress."
  />
</div>

<style>
  .debug-page {
    max-width: 800px;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.85rem;
    color: #6b7280;
    margin-bottom: 1.5rem;
  }
</style>
