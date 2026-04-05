<script lang="ts">
  import { PageHeader } from '$lib/components'
</script>

<div class="about-page">
  <PageHeader title="About Forge" subtitle="An AI-backed resume builder with a strict derivation chain" />

  <section class="about-section">
    <h2>What is Forge?</h2>
    <p>
      Forge is an AI-backed resume builder designed to prevent hallucination through a strict derivation chain:
      <strong>Source → Bullet → Perspective → Resume Entry</strong>. Every piece of resume content traces back
      to a real experience, validated by content snapshots and review workflows.
    </p>
    <p>
      Built as a local-first tool, Forge treats your career data as a first-class graph: roles, projects, skills,
      organizations, and job descriptions all link together to help you craft targeted resumes efficiently.
    </p>
  </section>

  <section class="about-section">
    <h2>Privacy Policy</h2>
    <p>
      Forge runs locally on your machine. Your career data stays on your machine unless you explicitly choose
      to export or share it. AI operations use the Claude Code CLI by default, which respects your local
      configuration and network policies.
    </p>
    <p class="placeholder-note">
      <em>Full privacy policy text is being drafted. This page will be updated with the complete policy when Forge enters public release.</em>
    </p>
  </section>

  <section class="about-section">
    <h2>Security</h2>
    <p>
      Forge is designed with security in mind:
    </p>
    <ul>
      <li>Local-first data storage (SQLite, no cloud sync by default)</li>
      <li>No authentication required for single-user operation</li>
      <li>No telemetry or analytics sent to external services</li>
      <li>Credential and clearance data tagged for privacy-aware handling</li>
      <li>All AI prompts logged locally for audit and review</li>
    </ul>
    <p class="placeholder-note">
      <em>Security disclosure process and vulnerability reporting guidelines will be added in a future release.</em>
    </p>
  </section>

  <section class="about-section">
    <h2>Get Help & Support</h2>
    <p>
      Forge is open source and community-supported. For questions, bug reports, or feature requests:
    </p>
    <ul>
      <li>GitHub Issues — primary support channel</li>
      <li>Documentation — see the <a href="/docs">Docs</a> page for guides and references</li>
      <li>Debug Tools — use <a href="/config/debug">Debug</a> to inspect logs and traces when troubleshooting</li>
    </ul>
  </section>
</div>

<style>
  .about-page {
    max-width: 760px;
  }

  .about-section {
    margin-bottom: var(--space-8);
  }

  .about-section h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .about-section p {
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-3);
  }

  .about-section ul {
    list-style: disc;
    padding-left: var(--space-5);
    margin-bottom: var(--space-3);
  }

  .about-section li {
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-2);
  }

  .about-section a {
    color: var(--color-primary);
    text-decoration: underline;
  }

  .about-section a:hover {
    text-decoration: none;
  }

  .placeholder-note {
    font-size: var(--text-sm);
    color: var(--text-tertiary, var(--text-secondary));
    opacity: 0.8;
  }
</style>
