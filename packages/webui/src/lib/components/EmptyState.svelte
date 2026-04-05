<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    description?: string
    children?: Snippet
  }

  let {
    title,
    description,
    children,
  }: Props = $props()
</script>

<div class="empty-state">
  <h3 class="empty-state__title">{title}</h3>
  {#if description}
    <p class="empty-state__description">{description}</p>
  {/if}
  {#if children}
    <div class="empty-state__cta">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12);
    text-align: center;
    color: var(--text-muted);
    gap: var(--space-4);
  }

  .empty-state__title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
  }

  .empty-state__description {
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    max-width: 400px;
  }

  .empty-state__cta {
    margin-top: var(--space-2);
  }
</style>
