<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { UserProfile } from '@forge/sdk'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'

  let loading = $state(true)
  let saving = $state(false)
  let profile = $state<UserProfile | null>(null)
  let form = $state<Record<string, string | null>>({
    name: '',
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    website: null,
    clearance: null,
  })

  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  onDestroy(() => {
    if (saveTimeout) clearTimeout(saveTimeout)
  })

  async function loadProfile() {
    loading = true
    const result = await forge.profile.get()
    if (result.ok) {
      profile = result.data
      form = {
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone,
        location: result.data.location,
        linkedin: result.data.linkedin,
        github: result.data.github,
        website: result.data.website,
        clearance: result.data.clearance,
      }
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
    loading = false
  }

  async function handleSave() {
    saving = true
    try {
      const patch: Record<string, string | null> = {}
      for (const [key, value] of Object.entries(form)) {
        if (profile && value !== (profile as Record<string, unknown>)[key]) {
          if (key === 'name') {
            patch[key] = value  // name: send as-is (empty string triggers server validation)
          } else {
            patch[key] = value === '' ? null : value
          }
        }
      }

      if (Object.keys(patch).length === 0) {
        saving = false
        return
      }

      const result = await forge.profile.update(patch)
      if (result.ok) {
        profile = result.data
        addToast({ message: 'Profile saved', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } finally {
      saving = false
    }
  }

  function scheduleAutosave() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => handleSave(), 500)
  }

  // Load on mount
  $effect(() => {
    loadProfile()
  })
</script>

<div class="page-header">
  <h1>Profile</h1>
  <p class="page-subtitle">Your contact information, shared across all resumes.</p>
</div>

{#if loading}
  <div class="loading">Loading profile...</div>
{:else if profile}
  <form class="profile-form" onsubmit={(e) => { e.preventDefault(); handleSave() }}>
    <div class="form-grid">
      <div class="form-field full-width">
        <label for="pf-name">Name <span class="required">*</span></label>
        <input id="pf-name" type="text" bind:value={form.name} required
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-email">Email</label>
        <input id="pf-email" type="email" bind:value={form.email}
               placeholder="adam@example.com"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-phone">Phone</label>
        <input id="pf-phone" type="tel" bind:value={form.phone}
               placeholder="+1-555-0123"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-location">Location</label>
        <input id="pf-location" type="text" bind:value={form.location}
               placeholder="Washington, DC"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-linkedin">LinkedIn</label>
        <input id="pf-linkedin" type="text" bind:value={form.linkedin}
               placeholder="linkedin.com/in/username"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-github">GitHub</label>
        <input id="pf-github" type="text" bind:value={form.github}
               placeholder="github.com/username"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-website">Website</label>
        <input id="pf-website" type="text" bind:value={form.website}
               placeholder="yoursite.dev"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field full-width">
        <label for="pf-clearance">Security Clearance</label>
        <input id="pf-clearance" type="text" bind:value={form.clearance}
               placeholder="TS/SCI with CI Polygraph - Active"
               oninput={scheduleAutosave} />
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  </form>
{:else}
  <div class="error">Failed to load profile. Check that the API server is running.</div>
{/if}

<style>
  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .page-subtitle {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .profile-form {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 640px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .form-field label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .required {
    color: var(--color-danger);
  }

  .form-field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s;
  }

  .form-field input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: var(--color-primary); color: var(--text-inverse); }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
  }

  .error {
    color: var(--color-danger);
  }
</style>
