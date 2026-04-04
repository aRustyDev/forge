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
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    margin-bottom: 0.75rem;
  }

  .drift-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #92400e;
  }

  .drift-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .drift-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .drift-btn {
    padding: 0.3rem 0.65rem;
    border: 1px solid #fcd34d;
    border-radius: 4px;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .drift-btn:hover {
    background: #fde68a;
  }

  .drift-rederive {
    background: #6c63ff;
    border-color: #6c63ff;
    color: #fff;
  }

  .drift-rederive:hover {
    background: #5a52e0;
  }

  .drift-dismiss {
    background: transparent;
    border-color: #d1d5db;
    color: #6b7280;
  }

  .drift-dismiss:hover {
    background: #f3f4f6;
  }

  .drift-diff {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .diff-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .diff-column {
    min-width: 0;
  }

  .snapshot-column {
    border-right: 1px solid #e5e7eb;
  }

  .diff-column-header {
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e5e7eb;
  }

  .snapshot-column .diff-column-header {
    background: #fffbeb;
  }

  .current-column .diff-column-header {
    background: #f0fdf4;
  }

  .diff-column-body {
    padding: 0.75rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .snapshot-column .diff-column-body {
    background: #fffef5;
  }

  .current-column .diff-column-body {
    background: #f7fef9;
  }
</style>
