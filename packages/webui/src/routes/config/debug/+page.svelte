<script lang="ts">
  import { PageHeader } from '$lib/components'

  const debugPages = [
    {
      href: '/config/debug/prompts',
      title: 'Prompt Logs',
      description: 'AI derivation audit trail -- every prompt sent, every response received.',
    },
    {
      href: '/config/debug/api',
      title: 'Forge API Logs',
      description: 'HTTP request/response log for the Forge backend API.',
    },
    {
      href: '/config/debug/events',
      title: 'Event Logs',
      description: 'Application event stream -- entity creates, updates, deletes.',
    },
    {
      href: '/config/debug/ui',
      title: 'UI/UX Logs',
      description: 'Client-side errors, performance metrics, and interaction traces.',
    },
  ]
</script>

<div class="debug-page">
  <PageHeader title="Debug" subtitle="Logs, diagnostics, and audit trails" />

  <div class="debug-cards">
    {#each debugPages as page}
      <a href={page.href} class="debug-card">
        <h3>{page.title}</h3>
        <p>{page.description}</p>
      </a>
    {/each}
  </div>
</div>

<style>
  .debug-page {
    max-width: 800px;
  }

  .debug-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
  }

  .debug-card {
    display: block;
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-decoration: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .debug-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
  }

  .debug-card h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .debug-card p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }
</style>
