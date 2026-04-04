<!--
  LinkContactDialog.svelte -- Dialog for linking a contact to an entity.
  Shows a contact dropdown and a relationship type dropdown.
-->
<script lang="ts">
  import type { ContactWithOrg } from '@forge/sdk'

  let {
    title = 'Link Contact',
    contacts = [],
    relationships = [],
    onlink,
    oncancel,
  }: {
    title?: string
    contacts: ContactWithOrg[]
    relationships: { value: string; label: string }[]
    onlink: (contactId: string, relationship: string) => void
    oncancel: () => void
  } = $props()

  let selectedContactId = $state('')
  let selectedRelationship = $state(relationships[0]?.value ?? '')

  function handleLink() {
    if (!selectedContactId || !selectedRelationship) return
    onlink(selectedContactId, selectedRelationship)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={oncancel}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog" onclick={(e) => e.stopPropagation()}>
    <div class="dialog-header">
      <h3>{title}</h3>
      <button class="close-btn" onclick={oncancel} type="button">&times;</button>
    </div>

    <div class="dialog-body">
      <div class="field">
        <label for="link-contact">Contact</label>
        <select id="link-contact" bind:value={selectedContactId}>
          <option value="" disabled>Select a contact...</option>
          {#each contacts.sort((a, b) => a.name.localeCompare(b.name)) as c (c.id)}
            <option value={c.id}>{c.name}{c.title ? ` -- ${c.title}` : ''}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="link-relationship">Relationship</label>
        <select id="link-relationship" bind:value={selectedRelationship}>
          {#each relationships as rel}
            <option value={rel.value}>{rel.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="dialog-footer">
      <button class="btn-cancel" onclick={oncancel} type="button">Cancel</button>
      <button
        class="btn-link"
        onclick={handleLink}
        disabled={!selectedContactId || !selectedRelationship}
        type="button"
      >
        Link
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }

  .dialog {
    background: #fff;
    border-radius: 0.5rem;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    line-height: 1;
  }

  .dialog-body {
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
  }

  .field select {
    padding: 0.5rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    outline: none;
  }

  .field select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-cancel {
    padding: 0.4rem 1rem;
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: #374151;
  }

  .btn-link {
    padding: 0.4rem 1rem;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-link:hover:not(:disabled) {
    background: #2563eb;
  }
</style>
