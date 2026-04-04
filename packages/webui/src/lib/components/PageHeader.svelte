<script lang="ts">
  import type { Snippet } from 'svelte'

  interface PageHeaderProps {
    title: string
    subtitle?: string
    actions?: Snippet
  }

  let { title, subtitle, actions }: PageHeaderProps = $props()
</script>

<header class="page-header">
  <div class="page-header-text">
    <h1>{title}</h1>
    {#if subtitle}
      <p class="page-header-subtitle">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    <div class="page-header-actions">
      {@render actions()}
    </div>
  {/if}
</header>

<style>
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .page-header-text {
    flex: 1;
    min-width: 0;
  }

  .page-header h1 {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
    margin: 0;
  }

  .page-header .page-header-subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-top: var(--space-1);
    line-height: var(--leading-normal);
  }

  .page-header-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
