<script lang="ts">
  import { PageHeader } from '$lib/components'

  let activeSection = $state('mcp')

  const sections = [
    { id: 'mcp', title: 'MCP' },
    { id: 'api', title: 'API' },
    { id: 'configuration', title: 'Configuration' },
    { id: 'pricing', title: 'Pricing' },
    { id: 'setup', title: 'Setup' },
  ]
</script>

<div class="docs-page">
  <PageHeader title="Documentation" subtitle="Guides, references, and setup instructions" />

  <div class="docs-layout">
    <nav class="docs-nav" aria-label="Documentation sections">
      {#each sections as section}
        <button
          class="docs-nav-item"
          class:active={activeSection === section.id}
          onclick={() => (activeSection = section.id)}
        >
          {section.title}
        </button>
      {/each}
    </nav>

    <div class="docs-content">
      {#if activeSection === 'mcp'}
        <h2>MCP — Model Context Protocol</h2>
        <p>
          Forge exposes a Model Context Protocol server that lets Claude Desktop and Claude Code CLI interact
          with your resume data directly. Available tools include search, derivation, review, assembly,
          analysis, and export operations across your Forge database.
        </p>
        <h3>Available Tools</h3>
        <ul>
          <li><code>forge_search_*</code> — Search bullets, sources, perspectives, organizations, JDs</li>
          <li><code>forge_create_*</code> — Create entities with validation</li>
          <li><code>forge_derive_*</code> — AI-powered bullet and perspective generation</li>
          <li><code>forge_align_resume</code> — Score resume alignment against a JD</li>
          <li><code>forge_export_resume</code> — Export to PDF, LaTeX, or Markdown</li>
        </ul>
        <p class="placeholder-note"><em>Full tool reference coming soon.</em></p>
      {:else if activeSection === 'api'}
        <h2>HTTP API</h2>
        <p>
          Forge runs a local HTTP API on port 5174 (configurable). All resources are accessible via standard
          REST endpoints under <code>/api</code>.
        </p>
        <h3>Core Endpoints</h3>
        <ul>
          <li><code>GET /api/health</code> — Server health and version</li>
          <li><code>GET /api/sources</code>, <code>/api/bullets</code>, <code>/api/perspectives</code> — Derivation chain entities</li>
          <li><code>GET /api/resumes</code> — Resume CRUD and export</li>
          <li><code>GET /api/job-descriptions</code> — JD management</li>
          <li><code>GET /api/alignment/score</code> — Resume↔JD alignment scoring</li>
        </ul>
        <p class="placeholder-note"><em>Full API reference coming soon.</em></p>
      {:else if activeSection === 'configuration'}
        <h2>Configuration</h2>
        <p>
          Forge is configured via environment variables and the user profile stored in the local database.
        </p>
        <h3>Environment Variables</h3>
        <ul>
          <li><code>FORGE_DB_PATH</code> — Path to the SQLite database file</li>
          <li><code>FORGE_PORT</code> — HTTP API port (default 5174)</li>
          <li><code>FORGE_API_URL</code> — Used by the WebUI and MCP server to reach the API</li>
        </ul>
        <p class="placeholder-note"><em>Full configuration reference coming soon.</em></p>
      {:else if activeSection === 'pricing'}
        <h2>Pricing</h2>
        <div class="pricing-hero">
          <h3>Forge is free and open source.</h3>
          <p>
            Forge is built as a local-first, open-source resume builder. There is no subscription, no cloud
            service fee, and no data collection. You bring your own AI provider (Claude Code CLI by default).
          </p>
        </div>
        <h3>Future Considerations</h3>
        <p>
          If Forge ever offers optional hosted services (sync, team features, managed AI), those will be
          clearly marked and strictly opt-in. The core local experience will always remain free.
        </p>
      {:else if activeSection === 'setup'}
        <h2>Setup</h2>
        <h3>Prerequisites</h3>
        <ul>
          <li>Bun (runtime) or Node.js 20+</li>
          <li>Claude Code CLI installed and authenticated (for AI features)</li>
          <li>Tectonic (optional, for PDF compilation)</li>
        </ul>
        <h3>Installation</h3>
        <pre class="code-block">git clone https://github.com/yourorg/forge.git
cd forge
bun install
bun run dev</pre>
        <p class="placeholder-note"><em>Full setup guide including deployment and advanced configuration coming soon.</em></p>
      {/if}
    </div>
  </div>
</div>

<style>
  .docs-page {
    max-width: 1100px;
  }

  .docs-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--space-6);
  }

  .docs-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    position: sticky;
    top: var(--space-4);
    align-self: flex-start;
  }

  .docs-nav-item {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .docs-nav-item:hover {
    background: var(--color-surface);
    color: var(--text-primary);
  }

  .docs-nav-item.active {
    background: var(--color-surface);
    color: var(--color-primary);
    border-color: var(--color-border);
    font-weight: var(--font-semibold);
  }

  .docs-content {
    min-width: 0;
  }

  .docs-content h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .docs-content h3 {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-top: var(--space-5);
    margin-bottom: var(--space-2);
  }

  .docs-content p {
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-3);
  }

  .docs-content ul {
    list-style: disc;
    padding-left: var(--space-5);
    margin-bottom: var(--space-3);
  }

  .docs-content li {
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-2);
  }

  .docs-content code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    background: var(--color-surface);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }

  .code-block {
    padding: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-primary);
    overflow-x: auto;
    margin-bottom: var(--space-3);
  }

  .placeholder-note {
    font-size: var(--text-sm);
    color: var(--text-tertiary, var(--text-secondary));
    opacity: 0.8;
  }

  .pricing-hero {
    padding: var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-primary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
  }

  .pricing-hero h3 {
    margin-top: 0;
    font-size: var(--text-lg);
    color: var(--color-primary);
  }

  .pricing-hero p {
    margin-bottom: 0;
  }
</style>
