<!--
  ContactLinkSection.svelte -- Reusable cross-entity contact linking section.
  Shows contacts linked to an entity and allows link/unlink operations.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import LinkContactDialog from './LinkContactDialog.svelte'
  import type { ContactLink, ContactWithOrg } from '@forge/sdk'

  let {
    sectionTitle = 'Contacts',
    entityType,
    entityId,
    relationships,
    linkedContacts = $bindable([]),
  }: {
    sectionTitle?: string
    entityType: 'organization' | 'job_description' | 'resume'
    entityId: string
    relationships: { value: string; label: string }[]
    linkedContacts: ContactLink[]
  } = $props()

  let showLinkDialog = $state(false)
  let allContacts = $state<ContactWithOrg[]>([])

  async function openLinkDialog() {
    const res = await forge.contacts.list({ limit: 500 })
    if (res.ok) {
      allContacts = res.data
    }
    showLinkDialog = true
  }

  async function handleLink(contactId: string, relationship: string) {
    let res: any
    if (entityType === 'organization') {
      res = await forge.contacts.linkOrganization(contactId, entityId, relationship as any)
    } else if (entityType === 'job_description') {
      res = await forge.contacts.linkJobDescription(contactId, entityId, relationship as any)
    } else if (entityType === 'resume') {
      res = await forge.contacts.linkResume(contactId, entityId, relationship as any)
    }

    if (res?.ok) {
      await refreshLinkedContacts()
      addToast({ type: 'success', message: 'Contact linked' })
    } else if (res) {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
    showLinkDialog = false
  }

  async function handleUnlink(contactId: string, relationship: string) {
    let res: any
    if (entityType === 'organization') {
      res = await forge.contacts.unlinkOrganization(contactId, entityId, relationship)
    } else if (entityType === 'job_description') {
      res = await forge.contacts.unlinkJobDescription(contactId, entityId, relationship)
    } else if (entityType === 'resume') {
      res = await forge.contacts.unlinkResume(contactId, entityId, relationship)
    }

    if (res?.ok) {
      linkedContacts = linkedContacts.filter(
        c => !(c.contact_id === contactId && c.relationship === relationship)
      )
      addToast({ type: 'success', message: 'Contact unlinked' })
    } else if (res) {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
  }

  async function refreshLinkedContacts() {
    let res: any
    if (entityType === 'organization') {
      res = await forge.contacts.listByOrganization(entityId)
    } else if (entityType === 'job_description') {
      res = await forge.contacts.listByJobDescription(entityId)
    } else if (entityType === 'resume') {
      res = await forge.contacts.listByResume(entityId)
    }

    if (res?.ok) {
      linkedContacts = res.data
    }
  }

  function formatRelationship(rel: string): string {
    return rel.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
</script>

<div class="link-section">
  <div class="section-header">
    <span class="section-title">{sectionTitle}</span>
    <button class="btn-add" onclick={openLinkDialog} type="button">
      + Link Contact
    </button>
  </div>

  {#if linkedContacts.length === 0}
    <p class="empty-text">No contacts linked.</p>
  {:else}
    <div class="linked-list">
      {#each linkedContacts as link (link.contact_id + link.relationship)}
        <div class="linked-item">
          <span class="contact-info">
            {link.contact_name}
            {#if link.contact_title}
              <span class="contact-role"> -- {link.contact_title}</span>
            {/if}
          </span>
          <span class="relationship-badge">{formatRelationship(link.relationship)}</span>
          <button
            class="unlink-btn"
            onclick={() => handleUnlink(link.contact_id, link.relationship)}
            type="button"
            aria-label="Unlink {link.contact_name}"
          >&times;</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showLinkDialog}
  <LinkContactDialog
    title="Link Contact to {sectionTitle}"
    contacts={allContacts}
    {relationships}
    onlink={handleLink}
    oncancel={() => (showLinkDialog = false)}
  />
{/if}

<style>
  .link-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 0.75rem;
    margin-top: 0.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .btn-add {
    padding: 0.25rem 0.5rem;
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #3b82f6;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-add:hover {
    background: #f0f9ff;
    border-color: #93c5fd;
  }

  .empty-text {
    font-size: 0.8rem;
    color: #9ca3af;
    font-style: italic;
  }

  .linked-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .linked-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    font-size: 0.85rem;
  }

  .contact-info {
    flex: 1;
    color: #1a1a2e;
    font-weight: 500;
  }

  .contact-role {
    font-weight: 400;
    color: #6b7280;
  }

  .relationship-badge {
    font-size: 0.7rem;
    padding: 0.15em 0.5em;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 999px;
    font-weight: 500;
    white-space: nowrap;
  }

  .unlink-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    padding: 0 0.25rem;
  }

  .unlink-btn:hover {
    color: #ef4444;
  }
</style>
