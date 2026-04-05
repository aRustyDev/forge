<script lang="ts">
  import { PageHeader } from '$lib/components'

  const plannedIntegrations = [
    {
      title: 'LinkedIn',
      description: 'Import professional profile data, discover jobs, and research companies directly from LinkedIn.',
      icon: '💼',
    },
    {
      title: 'OpenAI',
      description: 'Alternative AI provider for resume analysis, skill extraction, and content generation.',
      icon: '🤖',
    },
    {
      title: 'Calendars (CalDAV)',
      description: 'Sync interview schedules, application deadlines, and follow-up reminders with your calendar.',
      icon: '📅',
    },
    {
      title: 'GitHub',
      description: 'Import contributions, repositories, and project data to auto-populate your technical experience.',
      icon: '🐙',
    },
  ]
</script>

<div class="integrations-page">
  <PageHeader title="Integrations" subtitle="Connect Forge to external services — coming soon" />

  <div class="empty-state">
    <div class="empty-icon">🔗</div>
    <h2>No integrations configured</h2>
    <p>External API integrations are not yet available. Once released, you will be able to connect Forge to your favorite tools and services.</p>
  </div>

  <h2 class="section-title">Planned Integrations</h2>

  <div class="integration-cards">
    {#each plannedIntegrations as integration}
      <div class="integration-card">
        <div class="integration-icon">{integration.icon}</div>
        <h3>{integration.title}</h3>
        <p>{integration.description}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .integrations-page {
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

  .integration-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }

  .integration-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    opacity: 0.7;
  }

  .integration-icon {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }

  .integration-card h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .integration-card p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }
</style>
