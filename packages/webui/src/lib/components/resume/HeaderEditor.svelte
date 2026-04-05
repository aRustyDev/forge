<script lang="ts">
  import type { ResumeHeader } from '@forge/sdk'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'

  let {
    header,
    resumeId,
    onSave,
  }: {
    header: ResumeHeader
    resumeId: string
    onSave: () => Promise<void>
  } = $props()

  let editingTagline = $state(false)
  let saving = $state(false)
  let taglineValue = $state(header.tagline ?? '')

  async function handleSaveTagline() {
    saving = true
    try {
      // Update the resume header JSON — only tagline is resume-specific
      const currentHeader = header
      const headerJson = JSON.stringify({
        ...currentHeader,
        tagline: taglineValue || null,
      })
      const result = await forge.resumes.updateHeader(resumeId, { header: headerJson } as unknown as Record<string, unknown>)
      if (result.ok) {
        addToast({ message: 'Tagline updated', type: 'success' })
        editingTagline = false
        await onSave()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } finally {
      saving = false
    }
  }
</script>

<div class="header-editor">
  <div class="header-display">
    <div class="header-display-top">
      <h2 class="header-name">{header.name}</h2>
    </div>

    {#if editingTagline}
      <form class="tagline-edit" onsubmit={(e) => { e.preventDefault(); handleSaveTagline() }}>
        <input type="text" bind:value={taglineValue}
               placeholder="Security Engineer | Cloud + DevSecOps"
               class="tagline-input" />
        <div class="tagline-actions">
          <button class="btn btn-ghost btn-sm" type="button"
                  onclick={() => { editingTagline = false; taglineValue = header.tagline ?? '' }}>
            Cancel
          </button>
          <button class="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    {:else}
      <div class="tagline-row">
        {#if header.tagline}
          <p class="header-tagline">{header.tagline}</p>
        {:else}
          <p class="header-tagline placeholder">No tagline set</p>
        {/if}
        <button class="btn btn-sm btn-ghost" onclick={() => { editingTagline = true; taglineValue = header.tagline ?? '' }}>
          Edit Tagline
        </button>
      </div>
    {/if}

    <div class="header-contact">
      {#if header.location}<span>{header.location}</span>{/if}
      {#if header.email}<span>{header.email}</span>{/if}
      {#if header.phone}<span>{header.phone}</span>{/if}
      {#if header.linkedin}<a href={header.linkedin} target="_blank" rel="noopener">LinkedIn</a>{/if}
      {#if header.github}<a href={header.github} target="_blank" rel="noopener">GitHub</a>{/if}
      {#if header.website}<a href={header.website} target="_blank" rel="noopener">Website</a>{/if}
    </div>
    {#if header.clearance}
      <p class="header-clearance">{header.clearance}</p>
    {/if}

    <a href="/config/profile" class="edit-profile-link">
      Edit contact info in Profile
    </a>
  </div>
</div>

<style>
  .header-display {
    padding: 1.25rem;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-align: center;
  }

  .header-display-top {
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .header-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .tagline-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .header-tagline {
    font-size: 0.95rem;
    color: #374151;
  }

  .header-tagline.placeholder {
    color: #9ca3af;
    font-style: italic;
  }

  .tagline-edit {
    margin-top: 0.5rem;
  }

  .tagline-input {
    width: 100%;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1a1a1a;
    text-align: center;
  }

  .tagline-input:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .tagline-actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .header-contact {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .header-contact a {
    color: #6c63ff;
    text-decoration: none;
  }

  .header-contact a:hover {
    text-decoration: underline;
  }

  .header-clearance {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #059669;
  }

  .edit-profile-link {
    display: inline-block;
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: #6c63ff;
    text-decoration: none;
  }

  .edit-profile-link:hover {
    text-decoration: underline;
  }

</style>
