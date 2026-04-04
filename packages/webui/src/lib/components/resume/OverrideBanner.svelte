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
    gap: 1rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.8rem;
    border-bottom: 1px solid;
  }

  .override-banner.stale {
    background: #fffbeb;
    border-color: #fde68a;
    color: #92400e;
  }

  .override-banner.current {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1e40af;
  }

  .banner-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .banner-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .banner-regenerate {
    background: #6c63ff;
    border-color: #6c63ff;
    color: #fff;
  }

  .banner-regenerate:hover {
    background: #5a52e0;
  }

  .banner-reset {
    background: transparent;
    border-color: #d1d5db;
    color: #6b7280;
  }

  .banner-reset:hover {
    background: #f3f4f6;
  }
</style>
