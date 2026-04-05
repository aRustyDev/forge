<script lang="ts">
  interface Props {
    tags: string[]
    onRemove?: (tag: string) => void
    color?: 'accent' | 'neutral' | 'info' | 'success' | 'warning'
    size?: 'sm' | 'md'
  }

  let {
    tags,
    onRemove,
    color = 'accent',
    size = 'sm',
  }: Props = $props()
</script>

<div class="tags-list" role="list">
  {#each tags as tag (tag)}
    <span
      class="tags-list__pill tags-list__pill--{size} tags-list__pill--{color}"
      role="listitem"
    >
      {tag}
      {#if onRemove}
        <button
          class="tags-list__remove"
          type="button"
          aria-label="Remove {tag}"
          onclick={() => onRemove?.(tag)}
        >
          &times;
        </button>
      {/if}
    </span>
  {/each}
</div>

<style>
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    align-items: center;
  }

  .tags-list__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.15em;
    border-radius: var(--radius-sm);
    font-weight: var(--font-medium);
    white-space: nowrap;
    line-height: 1.4;
  }

  /* Size variants */
  .tags-list__pill--sm {
    padding: 0.05em 0.3em;
    font-size: var(--text-xs);
  }

  .tags-list__pill--md {
    padding: 0.15em 0.45em;
    font-size: var(--text-sm);
  }

  /* Color variants */
  .tags-list__pill--accent {
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
  }

  .tags-list__pill--neutral {
    background: var(--color-tag-neutral-bg);
    color: var(--color-tag-neutral-text);
  }

  .tags-list__pill--info {
    background: var(--color-info-subtle);
    color: var(--color-info-text);
  }

  .tags-list__pill--success {
    background: var(--color-success-subtle);
    color: var(--color-success-text);
  }

  .tags-list__pill--warning {
    background: var(--color-warning-subtle);
    color: var(--color-warning-text);
  }

  .tags-list__remove {
    background: none;
    border: none;
    font-size: 0.85em;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    padding: 0;
  }

  .tags-list__remove:hover {
    opacity: 1;
  }
</style>
