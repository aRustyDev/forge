<script>
  import { page } from '$app/state'
  let { children } = $props()

  const debugLinks = [
    { href: '/config/debug', label: 'Overview' },
    { href: '/config/debug/prompts', label: 'Prompts' },
    { href: '/config/debug/api', label: 'API' },
    { href: '/config/debug/events', label: 'Events' },
    { href: '/config/debug/ui', label: 'UI/UX' },
  ]
</script>

<div class="debug-layout">
  <nav class="debug-nav">
    {#each debugLinks as link}
      <a
        href={link.href}
        class="debug-nav-link"
        class:active={page.url.pathname === link.href}
      >{link.label}</a>
    {/each}
  </nav>
  {@render children()}
</div>

<style>
  .debug-layout {
    padding: var(--space-4);
  }

  .debug-nav {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-2);
  }

  .debug-nav-link {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .debug-nav-link:hover {
    background: var(--color-surface-raised);
    color: var(--text-primary);
  }

  .debug-nav-link.active {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    font-weight: var(--font-semibold);
  }
</style>
