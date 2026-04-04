<!--
  ResumePickerModal.svelte -- Modal for selecting a resume to link to a JD.
  Fetches all resumes, filters out already-linked ones, and supports client-side search.
-->
<script lang="ts">
  import { forge } from '$lib/sdk'
  import type { Resume } from '@forge/sdk'

  let { excludeIds, onselect, onclose }: {
    excludeIds: string[]
    onselect: (resumeId: string) => void
    onclose: () => void
  } = $props()

  let allResumes = $state<Resume[]>([])
  let search = $state('')
  let loading = $state(true)

  let availableResumes = $derived(
    allResumes
      .filter(r => !excludeIds.includes(r.id))
      .filter(r =>
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.target_role.toLowerCase().includes(search.toLowerCase()) ||
        r.target_employer.toLowerCase().includes(search.toLowerCase())
      )
  )

  $effect(() => {
    forge.resumes.list({ limit: 200 }).then(result => {
      if (result.ok) allResumes = result.data
      loading = false
    })
  })
</script>

<div class="modal-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Link Resume">
    <div class="modal-header">
      <h3>Link Resume</h3>
      <button class="close-btn" onclick={onclose} aria-label="Close">&times;</button>
    </div>

    <input
      type="text"
      class="search-input"
      placeholder="Search resumes..."
      bind:value={search}
    />

    {#if loading}
      <p class="muted">Loading resumes...</p>
    {:else if availableResumes.length === 0}
      <p class="muted">No resumes found.</p>
    {:else}
      <ul class="picker-list">
        {#each availableResumes as resume (resume.id)}
          <li>
            <button class="picker-item" onclick={() => onselect(resume.id)}>
              <span class="picker-name">{resume.name}</span>
              <span class="status-badge status-{resume.status}">{resume.status}</span>
              <span class="picker-target muted">
                {resume.target_role} @ {resume.target_employer}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-content {
    background: var(--color-surface);
    border-radius: 0.5rem;
    width: min(480px, 90vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    line-height: 1;
  }

  .close-btn:hover {
    background: var(--color-danger-subtle);
    color: var(--color-danger);
  }

  .search-input {
    margin: 0.75rem 1rem 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    font-size: 0.85rem;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-info);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .muted {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 0.75rem 1rem;
    margin: 0;
  }

  .picker-list {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    padding-bottom: 0.5rem;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .picker-item:hover {
    background: var(--color-info-subtle);
  }

  .picker-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .picker-target {
    font-size: 0.75rem;
  }

  .status-badge {
    font-size: 0.6rem;
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-draft { background: var(--color-info-subtle); color: var(--color-info); }
  .status-in_review { background: var(--color-warning-subtle); color: var(--color-warning-text); }
  .status-approved { background: var(--color-success-subtle); color: var(--color-success-text); }
  .status-rejected { background: var(--color-danger-subtle); color: var(--color-danger-text); }
  .status-archived { background: var(--color-surface-sunken); color: var(--text-muted); }
</style>
