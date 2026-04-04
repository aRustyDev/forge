<script lang="ts">
  import BulletsView from '../../data/sources/BulletsView.svelte'
</script>

<div class="bullets-page-wrapper">
  <BulletsView />
</div>

<style>
  .bullets-page-wrapper {
    height: calc(100vh - 4rem);
    margin: -2rem;
    overflow-y: auto;
  }
</style>
