<!--
  ResumeLinkedJDs.svelte -- "Targeted Job Descriptions" section for resume editor.
  Rendered when a resume is selected. Manages its own data fetching and state.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { JDLink } from '@forge/sdk'
  import JDPickerModal from './JDPickerModal.svelte'

  let { resumeId }: {
    resumeId: string
  } = $props()

  let linkedJDs = $state<JDLink[]>([])
  let showPicker = $state(false)
  let loading = $state(true)

  async function loadLinkedJDs() {
    const result = await forge.resumes.listJobDescriptions(resumeId)
    if (result.ok) linkedJDs = result.data
    loading = false
  }

  async function handleUnlink(jdId: string) {
    const result = await forge.jobDescriptions.unlinkResume(jdId, resumeId)
    if (result.ok) {
      linkedJDs = linkedJDs.filter(j => j.job_description_id !== jdId)
      addToast({ type: 'success', message: 'Job description unlinked' })
    } else {
      addToast({ type: 'error', message: friendlyError(result.error) })
    }
  }

  async function handleLink(jdId: string) {
    const result = await forge.jobDescriptions.linkResume(jdId, resumeId)
    if (result.ok) {
      // Refresh the full list to get JDLink format (the POST returns ResumeLink)
      await loadLinkedJDs()
      addToast({ type: 'success', message: 'Job description linked' })
    } else {
      addToast({ type: 'error', message: friendlyError(result.error) })
    }
    showPicker = false
  }

  $effect(() => {
    if (resumeId) {
      loading = true
      loadLinkedJDs()
    }
  })
</script>

<section class="resume-linked-jds">
  <h3>Targeted Job Descriptions</h3>

  {#if loading}
    <p class="muted">Loading...</p>
  {:else if linkedJDs.length === 0}
    <p class="muted">No job descriptions linked to this resume.</p>
  {:else}
    <ul class="linked-list">
      {#each linkedJDs as jd (jd.job_description_id)}
        <li class="linked-card">
          <div class="linked-card-info">
            <span class="linked-card-name">{jd.title}</span>
            <span class="status-badge status-{jd.status}">{jd.status}</span>
            <span class="linked-card-details muted">
              {#if jd.organization_name}{jd.organization_name}{/if}
              {#if jd.location}{#if jd.organization_name} &bull; {/if}{jd.location}{/if}
              {#if jd.salary_range}{#if jd.organization_name || jd.location} &bull; {/if}{jd.salary_range}{/if}
            </span>
          </div>
          <button
            class="unlink-btn"
            onclick={() => handleUnlink(jd.job_description_id)}
            aria-label="Unlink {jd.title}"
          >
            &times;
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <button class="link-btn" onclick={() => showPicker = true}>
    + Link JD
  </button>

  {#if showPicker}
    <JDPickerModal
      excludeIds={linkedJDs.map(j => j.job_description_id)}
      onselect={handleLink}
      onclose={() => showPicker = false}
    />
  {/if}
</section>

<style>
  .resume-linked-jds {
    margin-top: 0.5rem;
  }

  h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }

  .muted {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0.25rem 0;
  }

  .linked-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .linked-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    background: var(--color-surface);
  }

  .linked-card-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .linked-card-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .linked-card-details {
    font-size: 0.75rem;
  }

  .status-badge {
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-interested { background: var(--color-info-subtle); color: var(--color-info); }
  .status-analyzing { background: var(--color-warning-subtle); color: var(--color-warning-text); }
  .status-applied { background: var(--color-primary-subtle); color: var(--color-primary); }
  .status-interviewing { background: var(--color-warning-subtle); color: var(--color-warning-text); }
  .status-offered { background: var(--color-success-subtle); color: var(--color-success-text); }
  .status-rejected { background: var(--color-danger-subtle); color: var(--color-danger-text); }
  .status-withdrawn { background: var(--color-surface-sunken); color: var(--text-muted); }
  .status-closed { background: var(--color-surface-sunken); color: var(--text-muted); }

  .unlink-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    line-height: 1;
  }

  .unlink-btn:hover {
    background: var(--color-danger-subtle);
    color: var(--color-danger);
  }

  .link-btn {
    margin-top: 0.5rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    background: var(--color-surface);
    border: 1px dashed var(--color-border-strong);
    border-radius: 0.375rem;
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .link-btn:hover {
    border-color: var(--color-info);
    color: var(--color-info);
    background: var(--color-info-subtle);
  }
</style>
