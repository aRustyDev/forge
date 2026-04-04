<script lang="ts">
  import ChainViewModal from '$lib/components/ChainViewModal.svelte'
</script>

<div class="chain-page">
  <h1 class="page-title">Chain View</h1>
  <p class="page-description">Interactive provenance graph: Source &rarr; Bullet &rarr; Perspective</p>
  <ChainViewModal isModal={false} />
</div>

<style>
  .chain-page {
    max-width: 1400px;
  }

  .page-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }

  .page-description {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-bottom: var(--space-6);
  }
</style>
