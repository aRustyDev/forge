<script lang="ts">
  import { PageHeader } from '$lib/components'
  import ChainViewModal from '$lib/components/ChainViewModal.svelte'
</script>

<div class="chain-page">
  <PageHeader title="Chain View" subtitle="Interactive provenance graph: Source &rarr; Bullet &rarr; Perspective" />
  <ChainViewModal isModal={false} />
</div>

<style>
  .chain-page {
    max-width: 1400px;
  }

</style>
