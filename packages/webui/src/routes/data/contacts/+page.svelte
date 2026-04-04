<!--
  Contacts Page -- split-panel layout with list + editor.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState } from '$lib/components'
  import ContactCard from '$lib/components/contacts/ContactCard.svelte'
  import ContactEditor from '$lib/components/contacts/ContactEditor.svelte'
  import type { ContactWithOrg, Organization } from '@forge/sdk'

  let contacts = $state<ContactWithOrg[]>([])
  let organizations = $state<Organization[]>([])
  let selectedId = $state<string | null>(null)
  let createMode = $state(false)
  let searchText = $state('')
  let loading = $state(true)

  let filteredContacts = $derived.by(() => {
    if (!searchText.trim()) return contacts
    const q = searchText.toLowerCase()
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

  let selectedContact = $derived(contacts.find(c => c.id === selectedId) ?? null)

  $effect(() => {
    loadData()
  })

  async function loadData() {
    loading = true
    const [contactRes, orgRes] = await Promise.all([
      forge.contacts.list({ limit: 500 }),
      forge.organizations.list({ limit: 500 }),
    ])

    if (contactRes.ok) {
      contacts = contactRes.data
    } else {
      addToast({ type: 'error', message: friendlyError(contactRes.error) })
    }

    if (orgRes.ok) {
      organizations = orgRes.data
    }
    loading = false
  }

  async function refreshContacts() {
    const res = await forge.contacts.list({ limit: 500 })
    if (res.ok) {
      contacts = res.data
    }
  }

  function selectContact(id: string) {
    createMode = false
    selectedId = id
  }

  function startCreate() {
    selectedId = null
    createMode = true
  }

  function handleCreated(c: ContactWithOrg) {
    createMode = false
    selectedId = c.id
    refreshContacts()
  }

  function handleUpdated(c: ContactWithOrg) {
    refreshContacts()
  }

  function handleDeleted(id: string) {
    selectedId = null
    refreshContacts()
  }
</script>

<div class="contacts-page">
  {#if loading}
    <div class="loading-container">
      <LoadingSpinner />
    </div>
  {:else}
    <div class="split-panel">
      <!-- List Panel -->
      <div class="list-panel">
        <div class="list-header">
          <h2 class="panel-title">Contacts</h2>
          <button class="btn-new" onclick={startCreate} type="button">
            + New Contact
          </button>
        </div>

        <div class="list-filters">
          <input
            type="text"
            class="search-input"
            placeholder="Search name, title, email..."
            bind:value={searchText}
          />
        </div>

        <div class="card-list">
          {#if filteredContacts.length === 0}
            <p class="empty-list">No contacts found.</p>
          {:else}
            {#each filteredContacts as contact (contact.id)}
              <ContactCard
                {contact}
                selected={selectedId === contact.id}
                onclick={() => selectContact(contact.id)}
              />
            {/each}
          {/if}
        </div>
      </div>

      <!-- Editor Panel -->
      <div class="editor-panel">
        {#if createMode}
          <ContactEditor
            contact={null}
            {organizations}
            createMode={true}
            oncreated={handleCreated}
            onupdated={handleUpdated}
            ondeleted={handleDeleted}
          />
        {:else if selectedContact}
          {#key selectedContact.id}
            <ContactEditor
              contact={selectedContact}
              {organizations}
              createMode={false}
              oncreated={handleCreated}
              onupdated={handleUpdated}
              ondeleted={handleDeleted}
            />
          {/key}
        {:else}
          <div class="empty-editor">
            <EmptyState
              title="No contact selected"
              description="Select a contact or create a new one"
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .contacts-page {
    height: calc(100vh - 4rem);
    margin: -2rem;
    display: flex;
    flex-direction: column;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
  }

  .split-panel {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .list-panel {
    width: 320px;
    min-width: 280px;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-new {
    padding: 0.35rem 0.75rem;
    background: var(--color-info);
    color: var(--text-inverse);
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-new:hover {
    background: var(--color-primary-hover);
  }

  .list-filters {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-ghost);
  }

  .search-input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    font-size: 0.8rem;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-border-focus);
  }

  .card-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-list {
    text-align: center;
    color: var(--text-faint);
    padding: 2rem 1rem;
    font-size: 0.85rem;
  }

  .editor-panel {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }

  .empty-editor {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
</style>
