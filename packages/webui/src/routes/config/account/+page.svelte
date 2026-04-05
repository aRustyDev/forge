<script lang="ts">
  import { PageHeader } from '$lib/components'

  const authMethods = [
    {
      title: 'OAuth',
      description: 'Sign in with Google, GitHub, or other OAuth providers.',
      icon: '🔐',
    },
    {
      title: 'Email Sign-On',
      description: 'Traditional email + password authentication with secure hashing.',
      icon: '📧',
    },
    {
      title: 'Passwordless',
      description: 'Magic link or passkey-based authentication. No password to remember.',
      icon: '🔑',
    },
  ]
</script>

<div class="account-page">
  <PageHeader title="Account" subtitle="Authentication and user management — coming soon" />

  <div class="info-banner">
    Forge is currently a single-user local tool. Multi-user authentication will be added in a future release to support team and cloud deployments.
  </div>

  <h2 class="section-title">Planned Authentication Methods</h2>

  <div class="auth-cards">
    {#each authMethods as method}
      <div class="auth-card">
        <div class="auth-icon">{method.icon}</div>
        <h3>{method.title}</h3>
        <p>{method.description}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-page {
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

  .section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  .auth-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-4);
  }

  .auth-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    opacity: 0.7;
  }

  .auth-icon {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }

  .auth-card h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .auth-card p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }
</style>
