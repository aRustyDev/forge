<script lang="ts">
  import { PageHeader } from '$lib/components'

  const privacyFeatures = [
    {
      title: 'Privacy Visualization',
      description: 'Color-code and highlight what data is being shared vs kept private. See at a glance which fields appear on resumes, which are sent to AI models, and which stay local.',
      status: 'planned',
    },
    {
      title: 'PII Redaction in Previews',
      description: 'Automatically redact personally identifiable information (phone, address, email) from resume previews when sharing screenshots or demos.',
      status: 'planned',
    },
    {
      title: 'Data Sharing Preferences',
      description: 'Granular control over what data flows to external services: AI providers, analytics, telemetry, sync destinations.',
      status: 'planned',
    },
    {
      title: 'Clearance & Credential Protection',
      description: 'Mark sensitive credentials (security clearances, licenses) as non-shareable. Prevent accidental inclusion in exports or API calls.',
      status: 'planned',
    },
  ]
</script>

<div class="privacy-page">
  <PageHeader title="Privacy" subtitle="Data visibility and sharing controls — coming soon" />

  <div class="info-banner">
    Privacy features are a core part of Forge's roadmap. The goal is making it clear what data leaves your machine, who sees it, and how to control it.
  </div>

  <div class="feature-list">
    {#each privacyFeatures as feature}
      <div class="feature-row">
        <div class="feature-content">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
        <div class="feature-status">
          <span class="status-badge">{feature.status}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .privacy-page {
    max-width: 800px;
  }

  .info-banner {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-primary);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    margin-bottom: var(--space-6);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .feature-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .feature-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .feature-content {
    flex: 1;
  }

  .feature-content h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .feature-content p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .feature-status {
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    background: var(--color-surface-alt, var(--color-surface));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
