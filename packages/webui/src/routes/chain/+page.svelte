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
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 0.25rem;
  }

  .page-description {
    font-size: 0.85rem;
    color: #6b7280;
    margin-bottom: 1.5rem;
  }
</style>
