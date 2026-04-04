<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    listWidth?: number
    list: Snippet
    detail: Snippet
  }

  let { listWidth = 320, list, detail }: Props = $props()
</script>

<div class="split-panel">
  <div class="split-list" style:width="{listWidth}px">
    {@render list()}
  </div>
  <div class="split-detail">
    {@render detail()}
  </div>
</div>

<style>
  .split-panel {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .split-list {
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-surface);
  }

  .split-detail {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
    background: var(--color-surface);
  }
</style>
