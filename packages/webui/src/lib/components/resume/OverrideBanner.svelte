<script lang="ts">
  let {
    isStale,
    hasOverride,
    onRegenerate,
    onReset,
  }: {
    isStale: boolean
    hasOverride: boolean
    onRegenerate: () => void
    onReset: () => void
  } = $props()
</script>

{#if hasOverride}
  <div class="override-banner" class:stale={isStale} class:current={!isStale}>
    {#if isStale}
      <div class="banner-message">
        <span class="banner-icon">&#x26A0;</span>
        <span>The structured resume has been updated since this override was saved. The text below may not reflect recent changes.</span>
      </div>
      <div class="banner-actions">
        <button class="banner-btn banner-regenerate" onclick={onRegenerate}>
          Regenerate
        </button>
        <button class="banner-btn banner-reset" onclick={onReset}>
          Reset to Generated
        </button>
      </div>
    {:else}
      <div class="banner-message">
        <span class="banner-icon-info">&#x2139;</span>
        <span>Showing manual override. Edits here will not update the structured resume data.</span>
      </div>
      <div class="banner-actions">
        <button class="banner-btn banner-reset" onclick={onReset}>
          Reset to Generated
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .override-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 0.6rem 0.75rem;
    font-size: var(--text-sm);
    border-bottom: 1px solid;
  }

  .override-banner.stale {
    background: var(--color-warning-subtle);
    border-color: var(--color-warning-border);
    color: var(--color-warning-text);
  }

  .override-banner.current {
    background: var(--color-info-subtle);
    border-color: var(--color-info-border);
    color: var(--color-info-text);
  }

  .banner-message {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .banner-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .banner-icon-info {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .banner-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .banner-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .banner-regenerate {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--text-inverse);
  }

  .banner-regenerate:hover {
    background: var(--color-primary-hover);
  }

  .banner-reset {
    background: transparent;
    border-color: var(--color-border-strong);
    color: var(--text-muted);
  }

  .banner-reset:hover {
    background: var(--color-ghost);
  }
</style>
