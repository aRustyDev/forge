<script lang="ts">
  import { PageHeader } from '$lib/components'

  const plannedPlugins = [
    {
      title: 'Crawlers & Spiders',
      description: 'Web crawlers for discovering job postings, company pages, and professional profiles. Powered by Crawl4AI and custom scrapers.',
      icon: '🕸️',
    },
    {
      title: 'Browser Automation',
      description: 'Headless browser tools for interacting with sites that require JavaScript execution or authenticated sessions.',
      icon: '🤖',
    },
    {
      title: 'Token Embeddings',
      description: 'Alternative embedding providers (OpenAI, Cohere, local models) for semantic search and alignment scoring.',
      icon: '🧠',
    },
  ]
</script>

<div class="plugins-page">
  <PageHeader title="Plugins" subtitle="Extend Forge with custom capabilities — coming soon" />

  <div class="empty-state">
    <div class="empty-icon">🔌</div>
    <h2>No plugins installed</h2>
    <p>The plugin system is not yet available. Once released, you will be able to install, configure, and manage plugins from this page.</p>
  </div>

  <h2 class="section-title">Planned Plugin Categories</h2>

  <div class="plugin-cards">
    {#each plannedPlugins as plugin}
      <div class="plugin-card">
        <div class="plugin-icon">{plugin.icon}</div>
        <h3>{plugin.title}</h3>
        <p>{plugin.description}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .plugins-page {
    max-width: 800px;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8) var(--space-4);
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-6);
  }

  .empty-icon {
    font-size: var(--text-4xl);
    margin-bottom: var(--space-3);
  }

  .empty-state h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .empty-state p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    max-width: 480px;
    margin-inline: auto;
    line-height: 1.6;
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  .plugin-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-4);
  }

  .plugin-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    opacity: 0.7;
  }

  .plugin-icon {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }

  .plugin-card h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .plugin-card p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }
</style>
