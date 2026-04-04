<!--
  ContactEditor.svelte -- Contact editor form with relationship sections.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { ConfirmDialog } from '$lib/components'
  import ContactLinkSection from './ContactLinkSection.svelte'
  import type { ContactWithOrg, Organization, ContactLink } from '@forge/sdk'

  const ORG_RELATIONSHIPS = [
    { value: 'recruiter', label: 'Recruiter' },
    { value: 'hr', label: 'HR' },
    { value: 'referral', label: 'Referral' },
    { value: 'peer', label: 'Peer' },
    { value: 'manager', label: 'Manager' },
    { value: 'other', label: 'Other' },
  ]

  const JD_RELATIONSHIPS = [
    { value: 'hiring_manager', label: 'Hiring Manager' },
    { value: 'recruiter', label: 'Recruiter' },
    { value: 'interviewer', label: 'Interviewer' },
    { value: 'referral', label: 'Referral' },
    { value: 'other', label: 'Other' },
  ]

  const RESUME_RELATIONSHIPS = [
    { value: 'reference', label: 'Reference' },
    { value: 'recommender', label: 'Recommender' },
    { value: 'other', label: 'Other' },
  ]

  let {
    contact = null,
    organizations = [],
    createMode = false,
    oncreated,
    onupdated,
    ondeleted,
  }: {
    contact: ContactWithOrg | null
    organizations: Organization[]
    createMode?: boolean
    oncreated: (c: ContactWithOrg) => void
    onupdated: (c: ContactWithOrg) => void
    ondeleted: (id: string) => void
  } = $props()

  // Form state
  let name = $state('')
  let title = $state('')
  let organizationId = $state<string | null>(null)
  let email = $state('')
  let phone = $state('')
  let linkedin = $state('')
  let team = $state('')
  let dept = $state('')
  let notes = $state('')

  let saving = $state(false)
  let confirmDeleteOpen = $state(false)

  // Linked entities for relationship sections
  let linkedOrgs = $state<ContactLink[]>([])
  let linkedJds = $state<ContactLink[]>([])
  let linkedResumes = $state<ContactLink[]>([])

  let isDirty = $derived.by(() => {
    if (createMode || !contact) return false
    return (
      name !== contact.name ||
      title !== (contact.title ?? '') ||
      organizationId !== (contact.organization_id ?? null) ||
      email !== (contact.email ?? '') ||
      phone !== (contact.phone ?? '') ||
      linkedin !== (contact.linkedin ?? '') ||
      team !== (contact.team ?? '') ||
      dept !== (contact.dept ?? '') ||
      notes !== (contact.notes ?? '')
    )
  })

  $effect(() => {
    if (contact && !createMode) {
      name = contact.name
      title = contact.title ?? ''
      organizationId = contact.organization_id ?? null
      email = contact.email ?? ''
      phone = contact.phone ?? ''
      linkedin = contact.linkedin ?? ''
      team = contact.team ?? ''
      dept = contact.dept ?? ''
      notes = contact.notes ?? ''
      loadRelationships(contact.id)
    } else if (createMode) {
      name = ''
      title = ''
      organizationId = null
      email = ''
      phone = ''
      linkedin = ''
      team = ''
      dept = ''
      notes = ''
      linkedOrgs = []
      linkedJds = []
      linkedResumes = []
    }
  })

  async function loadRelationships(contactId: string) {
    const [orgList, jdList, resumeList] = await Promise.all([
      forge.contacts.listOrganizations(contactId),
      forge.contacts.listJobDescriptions(contactId),
      forge.contacts.listResumes(contactId),
    ])
    if (orgList.ok) {
      linkedOrgs = orgList.data.map(o => ({
        contact_id: contactId,
        contact_name: o.name,
        contact_title: null,
        contact_email: null,
        relationship: o.relationship,
      }))
    }
    if (jdList.ok) {
      linkedJds = jdList.data.map(j => ({
        contact_id: contactId,
        contact_name: j.title,
        contact_title: j.organization_name,
        contact_email: null,
        relationship: j.relationship,
      }))
    }
    if (resumeList.ok) {
      linkedResumes = resumeList.data.map(r => ({
        contact_id: contactId,
        contact_name: r.name,
        contact_title: null,
        contact_email: null,
        relationship: r.relationship,
      }))
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      addToast({ type: 'error', message: 'Name is required' })
      return
    }

    saving = true
    const payload = {
      name: name.trim(),
      title: title.trim() || null,
      organization_id: organizationId,
      email: email.trim() || null,
      phone: phone.trim() || null,
      linkedin: linkedin.trim() || null,
      team: team.trim() || null,
      dept: dept.trim() || null,
      notes: notes.trim() || null,
    }

    if (createMode) {
      const res = await forge.contacts.create(payload as any)
      if (res.ok) {
        oncreated(res.data)
        addToast({ type: 'success', message: 'Contact created' })
      } else {
        addToast({ type: 'error', message: friendlyError(res.error) })
      }
    } else if (contact) {
      const res = await forge.contacts.update(contact.id, payload)
      if (res.ok) {
        onupdated(res.data)
        addToast({ type: 'success', message: 'Contact updated' })
      } else {
        addToast({ type: 'error', message: friendlyError(res.error) })
      }
    }
    saving = false
  }

  async function handleDelete() {
    if (!contact) return
    const res = await forge.contacts.delete(contact.id)
    if (res.ok) {
      ondeleted(contact.id)
      addToast({ type: 'success', message: 'Contact deleted' })
    } else {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
    confirmDeleteOpen = false
  }
</script>

<div class="editor">
  <div class="field">
    <label for="contact-name">Name <span class="required">*</span></label>
    <input id="contact-name" type="text" bind:value={name} placeholder="Full name" />
  </div>

  <div class="field">
    <label for="contact-title">Title</label>
    <input id="contact-title" type="text" bind:value={title} placeholder="Job title" />
  </div>

  <div class="field">
    <label for="contact-org">Organization</label>
    <select id="contact-org" bind:value={organizationId}>
      <option value={null}>None</option>
      {#each organizations.sort((a, b) => a.name.localeCompare(b.name)) as org (org.id)}
        <option value={org.id}>{org.name}</option>
      {/each}
    </select>
  </div>

  <div class="field-row">
    <div class="field half">
      <label for="contact-email">Email</label>
      <input id="contact-email" type="email" bind:value={email} placeholder="email@example.com" />
    </div>
    <div class="field half">
      <label for="contact-phone">Phone</label>
      <input id="contact-phone" type="tel" bind:value={phone} placeholder="+1-555-0123" />
    </div>
  </div>

  <div class="field">
    <label for="contact-linkedin">LinkedIn</label>
    <div class="url-field">
      <input id="contact-linkedin" type="url" bind:value={linkedin} placeholder="https://linkedin.com/in/..." />
      {#if linkedin.trim() && !createMode}
        <a href={linkedin} target="_blank" rel="noopener noreferrer" class="url-link">
          Open
        </a>
      {/if}
    </div>
  </div>

  <div class="field-row">
    <div class="field half">
      <label for="contact-team">Team</label>
      <input id="contact-team" type="text" bind:value={team} placeholder="Platform Security" />
    </div>
    <div class="field half">
      <label for="contact-dept">Dept</label>
      <input id="contact-dept" type="text" bind:value={dept} placeholder="Engineering" />
    </div>
  </div>

  <div class="field">
    <label for="contact-notes">Notes</label>
    <textarea id="contact-notes" bind:value={notes} placeholder="Your private notes..." rows="4"></textarea>
  </div>

  {#if !createMode && contact}
    <ContactLinkSection
      sectionTitle="Linked Organizations"
      entityType="organization"
      entityId={contact.id}
      relationships={ORG_RELATIONSHIPS}
      bind:linkedContacts={linkedOrgs}
    />

    <ContactLinkSection
      sectionTitle="Linked Job Descriptions"
      entityType="job_description"
      entityId={contact.id}
      relationships={JD_RELATIONSHIPS}
      bind:linkedContacts={linkedJds}
    />

    <ContactLinkSection
      sectionTitle="Linked Resumes"
      entityType="resume"
      entityId={contact.id}
      relationships={RESUME_RELATIONSHIPS}
      bind:linkedContacts={linkedResumes}
    />
  {/if}

  <div class="actions">
    <button
      class="btn-primary"
      onclick={handleSave}
      disabled={saving || (!createMode && !isDirty)}
    >
      {saving ? 'Saving...' : createMode ? 'Create' : 'Save'}
    </button>
    {#if !createMode && contact}
      <button
        class="btn-danger"
        onclick={() => (confirmDeleteOpen = true)}
        type="button"
      >
        Delete
      </button>
    {/if}
  </div>
</div>

<ConfirmDialog
  open={confirmDeleteOpen}
  title="Delete Contact"
  message="Are you sure you want to delete this contact? This cannot be undone."
  onconfirm={handleDelete}
  oncancel={() => (confirmDeleteOpen = false)}
/>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-row {
    display: flex;
    gap: 1rem;
  }

  .half {
    flex: 1;
  }

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
  }

  .required {
    color: #ef4444;
  }

  input[type="text"],
  input[type="email"],
  input[type="tel"],
  input[type="url"],
  select,
  textarea {
    padding: 0.5rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    outline: none;
    font-family: inherit;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .url-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .url-field input {
    flex: 1;
  }

  .url-link {
    font-size: 0.8rem;
    color: #3b82f6;
    text-decoration: none;
    white-space: nowrap;
  }

  .url-link:hover {
    text-decoration: underline;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-primary {
    padding: 0.5rem 1.25rem;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    padding: 0.5rem 1.25rem;
    background: none;
    color: #ef4444;
    border: 1px solid #ef4444;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-danger:hover {
    background: #fef2f2;
  }
</style>
