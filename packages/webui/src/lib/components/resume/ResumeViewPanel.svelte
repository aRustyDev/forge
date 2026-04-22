<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    header: Snippet
    children: Snippet
  }

  let { header, children }: Props = $props()
</script>

<div class="view-panel">
  <div class="view-panel-header">
    {@render header()}
  </div>
  <div class="view-panel-content">
    {@render children()}
  </div>
</div>

<style>
  .view-panel {
    margin-top: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    height: calc(100vh - 16rem);
    min-height: 500px;
  }

  .view-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .view-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
