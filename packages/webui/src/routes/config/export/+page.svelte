<script lang="ts">
  import { forge } from '$lib/sdk'
  import type { Resume } from '@forge/sdk'
  import { onMount } from 'svelte'

  // ── Resume export state ────────────────────────────────────────────
  let resumes: Array<{ id: string; name: string }> = $state([])
  let selectedResumeId: string = $state('')
  let format: 'pdf' | 'markdown' | 'latex' | 'json' = $state('pdf')
  let exportingResume = $state(false)
  let resumeError: string | null = $state(null)

  // ── Data export state ──────────────────────────────────────────────
  const entityTypes = [
    { key: 'sources', label: 'Sources' },
    { key: 'bullets', label: 'Bullets' },
    { key: 'perspectives', label: 'Perspectives' },
    { key: 'skills', label: 'Skills' },
    { key: 'organizations', label: 'Organizations' },
    { key: 'summaries', label: 'Summaries' },
    { key: 'job_descriptions', label: 'Job Descriptions' },
  ]
  let selectedEntities: Record<string, boolean> = $state(
    Object.fromEntries(entityTypes.map(e => [e.key, true]))
  )
  let exportingData = $state(false)
  let dataError: string | null = $state(null)

  // ── Dump state ─────────────────────────────────────────────────────
  let exportingDump = $state(false)
  let dumpError: string | null = $state(null)

  // ── Load resumes on mount ──────────────────────────────────────────
  onMount(() => {
    loadResumes()
  })

  async function loadResumes() {
    const result = await forge.resumes.list({ limit: 200, offset: 0 })
    if (result.ok) {
      resumes = result.data
      if (resumes.length > 0 && !selectedResumeId) {
        selectedResumeId = resumes[0].id
      }
    }
  }

  // ── Download helpers ───────────────────────────────────────────────

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function downloadResume() {
    if (!selectedResumeId) return
    exportingResume = true
    resumeError = null

    try {
      if (format === 'json') {
        const result = await forge.export.resumeAsJson(selectedResumeId)
        if (!result.ok) {
          resumeError = result.error.message
          return
        }
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        })
        triggerDownload(blob, `resume-${new Date().toISOString().slice(0, 10)}.json`)
      } else {
        const result = await forge.export.downloadResume(selectedResumeId, format)
        if (!result.ok) {
          resumeError = result.error.message
          return
        }
        const ext = format === 'pdf' ? 'pdf' : format === 'markdown' ? 'md' : 'tex'
        triggerDownload(result.data, `resume-${new Date().toISOString().slice(0, 10)}.${ext}`)
      }
    } catch (err) {
      resumeError = String(err)
    } finally {
      exportingResume = false
    }
  }

  async function downloadData() {
    const entities = Object.entries(selectedEntities)
      .filter(([, selected]) => selected)
      .map(([key]) => key)

    if (entities.length === 0) {
      dataError = 'Select at least one entity type'
      return
    }

    exportingData = true
    dataError = null

    try {
      const result = await forge.export.exportData(entities)
      if (!result.ok) {
        dataError = result.error.message
        return
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json',
      })
      triggerDownload(blob, `forge-export-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (err) {
      dataError = String(err)
    } finally {
      exportingData = false
    }
  }

  async function downloadDump() {
    exportingDump = true
    dumpError = null

    try {
      const result = await forge.export.dumpDatabase()
      if (!result.ok) {
        dumpError = result.error.message
        return
      }
      triggerDownload(result.data, `forge-dump-${new Date().toISOString().slice(0, 10)}.sql`)
    } catch (err) {
      dumpError = String(err)
    } finally {
      exportingDump = false
    }
  }

  function selectAll() {
    for (const e of entityTypes) {
      selectedEntities[e.key] = true
    }
  }

  function deselectAll() {
    for (const e of entityTypes) {
      selectedEntities[e.key] = false
    }
  }
</script>

<svelte:head>
  <title>Export | Forge</title>
</svelte:head>

<div class="page">
  <h1>Export</h1>

  <!-- Resume Export -->
  <section class="export-section">
    <h2>Export Resume</h2>
    <p>Download a resume in your preferred format.</p>

    <div class="export-form">
      <label>
        Resume
        <select bind:value={selectedResumeId}>
          {#each resumes as resume}
            <option value={resume.id}>{resume.name}</option>
          {/each}
        </select>
      </label>

      <label>
        Format
        <div class="format-selector">
          {#each (['pdf', 'markdown', 'latex', 'json'] as const) as fmt}
            <button
              class="format-btn"
              class:active={format === fmt}
              onclick={() => format = fmt}
            >
              {fmt.toUpperCase()}
            </button>
          {/each}
        </div>
      </label>

      <button
        class="btn btn-primary"
        onclick={downloadResume}
        disabled={exportingResume || !selectedResumeId}
      >
        {exportingResume ? 'Generating...' : 'Download'}
      </button>

      {#if resumeError}
        <p class="error">{resumeError}</p>
      {/if}
    </div>
  </section>

  <!-- Data Export -->
  <section class="export-section">
    <h2>Export Data</h2>
    <p>Download entity data as a JSON bundle for backup or portability.</p>

    <div class="entity-checkboxes">
      {#each entityTypes as entity}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={selectedEntities[entity.key]} />
          {entity.label}
        </label>
      {/each}
    </div>

    <div class="entity-actions">
      <button class="btn btn-sm" onclick={selectAll}>Select All</button>
      <button class="btn btn-sm" onclick={deselectAll}>Deselect All</button>
    </div>

    <button
      class="btn btn-primary"
      onclick={downloadData}
      disabled={exportingData}
    >
      {exportingData ? 'Exporting...' : 'Download Data'}
    </button>

    {#if dataError}
      <p class="error">{dataError}</p>
    {/if}
  </section>

  <!-- Database Backup -->
  <section class="export-section">
    <h2>Database Backup</h2>
    <p>
      Download a full SQL dump of the database. This includes all tables,
      data, and schema definitions. The dump can be re-imported with
      <code>sqlite3 forge.db &lt; dump.sql</code>.
    </p>

    <button
      class="btn btn-primary"
      onclick={downloadDump}
      disabled={exportingDump}
    >
      {exportingDump ? 'Dumping...' : 'Download SQL Dump'}
    </button>

    {#if dumpError}
      <p class="error">{dumpError}</p>
    {/if}
  </section>
</div>

<style>
  .page {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    margin-bottom: 2rem;
  }

  .export-section {
    margin-bottom: 3rem;
    padding: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .export-section h2 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  .export-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .format-selector {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .format-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border);
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: var(--text-base);
  }

  .format-btn.active {
    background: var(--color-primary);
    color: var(--text-inverse);
    border-color: var(--color-primary);
  }

  .entity-checkboxes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .entity-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .error {
    color: var(--color-danger);
    font-size: var(--text-base);
    margin-top: 0.5rem;
  }

  code {
    background: var(--color-surface-sunken);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-base);
  }
</style>
