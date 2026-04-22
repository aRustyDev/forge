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
  })

  // Address fields
  let address = $state({
    name: '', street_1: '', street_2: '', city: '', state: '', zip: '', country_code: 'US',
  })

  // URL fields
  let urls = $state<Array<{ key: string; url: string }>>([])
  let newUrlKey = $state('')
  let newCustomKey = $state('')
  let newCustomUrl = $state('')

  const WELL_KNOWN_URL_KEYS = ['linkedin', 'github', 'gitlab', 'indeed', 'blog', 'portfolio']
  const WELL_KNOWN_LABELS: Record<string, string> = {
    linkedin: 'LinkedIn', github: 'GitHub', gitlab: 'GitLab',
    indeed: 'Indeed', blog: 'Blog', portfolio: 'Portfolio',
  }

  // Salary expectation fields (numeric, separate from the text form)
  let salaryMinimum = $state<number | null>(null)
  let salaryTarget = $state<number | null>(null)
  let salaryStretch = $state<number | null>(null)

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
      }
      if (result.data.address) {
        address = {
          name: result.data.address.name ?? '',
          street_1: result.data.address.street_1 ?? '',
          street_2: result.data.address.street_2 ?? '',
          city: result.data.address.city ?? '',
          state: result.data.address.state ?? '',
          zip: result.data.address.zip ?? '',
          country_code: result.data.address.country_code ?? 'US',
        }
      }
      urls = result.data.urls.map((u: any) => ({ key: u.key, url: u.url }))
      salaryMinimum = result.data.salary_minimum ?? null
      salaryTarget = result.data.salary_target ?? null
      salaryStretch = result.data.salary_stretch ?? null
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
    loading = false
  }

  async function handleSave() {
    saving = true
    try {
      const patch: Record<string, unknown> = {}

      // Text fields
      for (const [key, value] of Object.entries(form)) {
        if (profile && value !== (profile as Record<string, unknown>)[key]) {
          if (key === 'name') patch[key] = value
          else patch[key] = value === '' ? null : value
        }
      }

      // Address (send if any field has content)
      const hasAddress = address.name || address.street_1 || address.city || address.state || address.zip
      if (hasAddress || profile?.address) {
        patch.address = {
          name: address.name || null,
          street_1: address.street_1 || null,
          street_2: address.street_2 || null,
          city: address.city || null,
          state: address.state || null,
          zip: address.zip || null,
          country_code: address.country_code || 'US',
        }
      }

      // URLs (always send full array, filter empty)
      patch.urls = urls.filter(u => u.url.trim() !== '')

      // Salary
      if (profile && salaryMinimum !== (profile.salary_minimum ?? null)) patch.salary_minimum = salaryMinimum
      if (profile && salaryTarget !== (profile.salary_target ?? null)) patch.salary_target = salaryTarget
      if (profile && salaryStretch !== (profile.salary_stretch ?? null)) patch.salary_stretch = salaryStretch

      if (Object.keys(patch).length === 0) { saving = false; return }

      const result = await forge.profile.update(patch as any)
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

  function addWellKnownUrl() {
    if (!newUrlKey) return
    if (urls.some(u => u.key === newUrlKey)) return
    urls = [...urls, { key: newUrlKey, url: '' }]
    newUrlKey = ''
  }

  function addCustomUrl() {
    const key = newCustomKey.trim().toLowerCase()
    if (!key || !newCustomUrl.trim()) return
    if (urls.some(u => u.key === key)) return
    urls = [...urls, { key, url: newCustomUrl.trim() }]
    newCustomKey = ''
    newCustomUrl = ''
  }

  function removeUrl(key: string) {
    urls = urls.filter(u => u.key !== key)
  }

  function urlLabel(key: string): string {
    return WELL_KNOWN_LABELS[key] ?? key
  }

  let availableWellKnownKeys = $derived(WELL_KNOWN_URL_KEYS.filter(k => !urls.some(u => u.key === k)))

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

    <!-- Personal Info -->
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
    </div>

    <!-- Address -->
    <h3 class="section-heading">Address</h3>
    <div class="form-grid">
      <div class="form-field full-width">
        <label for="pf-addr-name">Display Location</label>
        <input id="pf-addr-name" type="text" bind:value={address.name}
               placeholder="Washington, DC"
               oninput={scheduleAutosave} />
        <p class="field-hint">This is what appears on your resumes</p>
      </div>

      <div class="form-field">
        <label for="pf-addr-street1">Street 1</label>
        <input id="pf-addr-street1" type="text" bind:value={address.street_1}
               placeholder="123 Main St"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-addr-street2">Street 2</label>
        <input id="pf-addr-street2" type="text" bind:value={address.street_2}
               placeholder="Apt 4B"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field addr-city">
        <label for="pf-addr-city">City</label>
        <input id="pf-addr-city" type="text" bind:value={address.city}
               placeholder="Washington"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field addr-state">
        <label for="pf-addr-state">State</label>
        <input id="pf-addr-state" type="text" bind:value={address.state}
               placeholder="DC"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field addr-zip">
        <label for="pf-addr-zip">Zip</label>
        <input id="pf-addr-zip" type="text" bind:value={address.zip}
               placeholder="20001"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field addr-country">
        <label for="pf-addr-country">Country</label>
        <input id="pf-addr-country" type="text" bind:value={address.country_code}
               placeholder="US"
               oninput={scheduleAutosave} />
      </div>
    </div>

    <!-- URLs -->
    <h3 class="section-heading">Links</h3>
    <div class="url-list">
      {#each urls as entry (entry.key)}
        <div class="url-row">
          <span class="url-label">{urlLabel(entry.key)}</span>
          <input type="url" bind:value={entry.url}
                 placeholder="https://..."
                 onblur={scheduleAutosave} />
          <button type="button" class="btn btn-ghost btn-sm"
                  onclick={() => { removeUrl(entry.key); scheduleAutosave() }}>
            Remove
          </button>
        </div>
      {/each}
    </div>

    {#if availableWellKnownKeys.length > 0}
      <div class="url-add">
        <select bind:value={newUrlKey} class="url-add-select">
          <option value="">+ Add well-known URL...</option>
          {#each availableWellKnownKeys as key}
            <option value={key}>{WELL_KNOWN_LABELS[key]}</option>
          {/each}
        </select>
        <button type="button" class="btn btn-ghost btn-sm"
                onclick={addWellKnownUrl}
                disabled={!newUrlKey}>
          Add
        </button>
      </div>
    {/if}

    <div class="url-add-custom">
      <input type="text" bind:value={newCustomKey}
             placeholder="Custom label (e.g. blog)"
             class="url-custom-key" />
      <input type="url" bind:value={newCustomUrl}
             placeholder="https://..." />
      <button type="button" class="btn btn-ghost btn-sm"
              onclick={addCustomUrl}
              disabled={!newCustomKey.trim() || !newCustomUrl.trim() || WELL_KNOWN_URL_KEYS.includes(newCustomKey.trim().toLowerCase())}>
        Add Custom
      </button>
    </div>

    <!-- Salary Expectations -->
    <h3 class="section-heading">Salary Expectations</h3>
    <div class="form-grid">
      <div class="form-field">
        <label for="pf-sal-min">Minimum Acceptable ($)</label>
        <input id="pf-sal-min" type="number" bind:value={salaryMinimum}
               placeholder="120000" step="1000"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-sal-target">Target ($)</label>
        <input id="pf-sal-target" type="number" bind:value={salaryTarget}
               placeholder="160000" step="1000"
               oninput={scheduleAutosave} />
      </div>

      <div class="form-field">
        <label for="pf-sal-stretch">Stretch ($)</label>
        <input id="pf-sal-stretch" type="number" bind:value={salaryStretch}
               placeholder="200000" step="1000"
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

  /* Three-column city/state/zip row */
  .addr-city { grid-column: span 1; }
  .addr-state { grid-column: span 1; }
  .addr-zip { grid-column: span 1; }
  .addr-country { grid-column: span 1; }

  .section-heading {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
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

  .loading, .error {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
  }

  .error {
    color: var(--color-danger);
  }

  /* URL list */
  .url-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
  .url-row { display: flex; align-items: center; gap: 0.5rem; }
  .url-label { min-width: 80px; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary); }
  .url-row input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-strong); border-radius: 6px; font-size: 0.875rem; color: var(--text-primary); background: var(--color-surface); }
  .url-add { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
  .url-add-select { font-size: var(--text-sm); padding: 0.4rem 0.5rem; border: 1px solid var(--color-border-strong); border-radius: 6px; background: var(--color-surface); color: var(--text-primary); }
  .url-add-custom { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .url-add-custom input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-strong); border-radius: 6px; font-size: 0.875rem; color: var(--text-primary); background: var(--color-surface); }
  .url-custom-key { max-width: 160px; flex: none !important; }
  .field-hint { font-size: var(--text-xs); color: var(--text-muted); margin-top: 0.25rem; }

  .btn-sm { padding: 0.35rem 0.65rem; font-size: var(--text-sm); }
</style>
