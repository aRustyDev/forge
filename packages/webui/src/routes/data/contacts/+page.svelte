<!--
  Contacts Page -- split-panel layout with list + editor.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, EmptyPanel, ListSearchInput, PageWrapper, SplitPanel, ListPanelHeader } from '$lib/components'
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

<PageWrapper>
  {#if loading}
    <div class="loading-container">
      <LoadingSpinner />
    </div>
  {:else}
    <SplitPanel>
      {#snippet list()}
        <ListPanelHeader title="Contacts" onNew={startCreate} />

        <div class="list-filters">
          <ListSearchInput bind:value={searchText} placeholder="Search name, title, email..." />
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
      {/snippet}
      {#snippet detail()}
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
          <EmptyPanel message="Select a contact or create a new one." />
        {/if}
      {/snippet}
    </SplitPanel>
  {/if}
</PageWrapper>

<style>
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
  }

  .list-filters {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-ghost);
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


</style>
