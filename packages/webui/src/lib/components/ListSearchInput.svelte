<script lang="ts">
  interface Props {
    value?: string
    placeholder?: string
    [key: string]: unknown
  }

  let { value = $bindable(''), placeholder = 'Search...', ...rest }: Props = $props()
</script>

<input
  type="text"
  class="list-search-input"
  {placeholder}
  bind:value
  {...rest}
/>

<style>
  .list-search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-family: inherit;
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .list-search-input::placeholder {
    color: var(--text-faint);
  }

  .list-search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }
</style>
