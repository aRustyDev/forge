<!-- packages/webui/src/lib/components/resume/FormatToggle.svelte -->
<script lang="ts">
  type Format = 'default' | 'latex' | 'markdown'

  interface Props {
    value: Format
    onChange: (format: Format) => void
    disabled?: boolean
  }

  let { value, onChange, disabled = false }: Props = $props()

  const formats: { value: Format; label: string }[] = [
    { value: 'default', label: 'Visual' },
    { value: 'latex', label: 'LaTeX' },
    { value: 'markdown', label: 'Markdown' },
  ]
</script>

<div class="format-toggle" role="radiogroup" aria-label="Editor format">
  {#each formats as fmt}
    <button
      class="btn btn-ghost format-option"
      class:active={value === fmt.value}
      {disabled}
      role="radio"
      aria-checked={value === fmt.value}
      onclick={() => onChange(fmt.value)}
    >
      {fmt.label}
    </button>
  {/each}
</div>

<style>
  .format-toggle {
    display: inline-flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .format-option {
    border-radius: 0;
    border: none;
    border-right: 1px solid var(--color-border);
    padding: 0.25rem 0.75rem;
    font-size: var(--text-xs);
  }
  .format-option:last-child { border-right: none; }
  .format-option.active {
    background: var(--color-primary);
    color: white;
  }
</style>
