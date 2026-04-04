<!--
  ConfidenceBar.svelte -- Visual confidence score bar (reusable).
  Green >= 0.8, amber >= 0.5, red < 0.5. Fixed 80px width, 6px height.
-->
<script lang="ts">
  let { value, max = 1.0 }: {
    value: number
    max?: number
  } = $props()

  let percentage = $derived(Math.round((value / max) * 100))
  let barColor = $derived(
    value >= 0.8 ? 'var(--color-success, #22c55e)' :
    value >= 0.5 ? 'var(--color-warning, #f59e0b)' :
    'var(--color-danger, #ef4444)'
  )
</script>

<div class="confidence-bar" title="{value.toFixed(2)}">
  <div
    class="confidence-fill"
    style="width: {percentage}%; background: {barColor};"
  ></div>
</div>

<style>
  .confidence-bar {
    width: 80px;
    height: 6px;
    background: var(--color-ghost, #e5e7eb);
    border-radius: 3px;
    overflow: hidden;
    display: inline-block;
    vertical-align: middle;
  }

  .confidence-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.2s ease;
  }
</style>
