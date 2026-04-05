<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    overflow?: 'auto' | 'hidden' | 'visible'
    children: Snippet
  }

  let { overflow = 'hidden', children }: Props = $props()
</script>

<div class="page-wrapper page-wrapper--overflow-{overflow}">
  {@render children()}
</div>

<style>
  .page-wrapper {
    height: calc(100vh - var(--content-padding) * 2);
    margin: calc(-1 * var(--content-padding));
    display: flex;
    flex-direction: column;
  }

  .page-wrapper--overflow-auto    { overflow: auto; }
  .page-wrapper--overflow-hidden  { overflow: hidden; }
  .page-wrapper--overflow-visible { overflow: visible; }
</style>
