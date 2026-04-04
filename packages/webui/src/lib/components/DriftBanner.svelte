<script lang="ts">
  let {
    snapshotContent,
    currentContent,
    entityType,
    onRederive,
    onDismiss,
  }: {
    snapshotContent: string
    currentContent: string
    entityType: 'bullet' | 'perspective'
    onRederive?: () => void
    onDismiss?: () => void
  } = $props()

  let showDiff = $state(false)
  let isDrifted = $derived(snapshotContent !== currentContent)
</script>

{#if isDrifted}
  <div class="drift-banner">
    <div class="drift-message">
      <span class="drift-icon">&#x26A0;</span>
      <span>
        {entityType === 'bullet'
          ? 'Source content has changed since this bullet was derived.'
          : 'Bullet content has changed since this perspective was derived.'}
      </span>
    </div>
    <div class="drift-actions">
      <button class="drift-btn" onclick={() => showDiff = !showDiff}>
        {showDiff ? 'Hide diff' : 'View diff'}
      </button>
      {#if onRederive}
        <button class="drift-btn drift-rederive" onclick={onRederive}>
          Re-derive
        </button>
      {/if}
      {#if onDismiss}
        <button class="drift-btn drift-dismiss" onclick={onDismiss}>
          Dismiss
        </button>
      {/if}
    </div>
  </div>

  {#if showDiff}
    <div class="drift-diff">
      <div class="diff-columns">
        <div class="diff-column snapshot-column">
          <div class="diff-column-header">Snapshot (at derivation time)</div>
          <div class="diff-column-body">{snapshotContent}</div>
        </div>
        <div class="diff-column current-column">
          <div class="diff-column-header">Current content</div>
          <div class="diff-column-body">{currentContent}</div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .drift-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--color-warning-subtle);
    border: 1px solid var(--color-warning-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-3);
  }

  .drift-message {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.85rem;
    color: var(--color-warning-text);
  }

  .drift-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .drift-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .drift-btn {
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--color-warning-border);
    border-radius: var(--radius-sm);
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .drift-btn:hover {
    background: var(--color-warning-border);
  }

  .drift-rederive {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--text-inverse);
  }

  .drift-rederive:hover {
    background: var(--color-primary-hover);
  }

  .drift-dismiss {
    background: transparent;
    border-color: var(--color-border-strong);
    color: var(--text-muted);
  }

  .drift-dismiss:hover {
    background: var(--color-ghost);
  }

  .drift-diff {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: var(--space-3);
  }

  .diff-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .diff-column {
    min-width: 0;
  }

  .snapshot-column {
    border-right: 1px solid var(--color-border);
  }

  .diff-column-header {
    padding: 0.4rem 0.75rem;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--color-border);
  }

  .snapshot-column .diff-column-header {
    background: var(--color-warning-subtle);
  }

  .current-column .diff-column-header {
    background: var(--color-success-subtle);
  }

  .diff-column-body {
    padding: var(--space-3);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .snapshot-column .diff-column-body {
    background: var(--color-warning-subtle);
  }

  .current-column .diff-column-body {
    background: var(--color-success-subtle);
  }
</style>
