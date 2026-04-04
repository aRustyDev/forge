<!--
  ContactCard.svelte -- Card for the contact list panel.
  Displays name, title, organization, and email.
-->
<script lang="ts">
  import type { ContactWithOrg } from '@forge/sdk'

  let {
    contact,
    selected = false,
    onclick,
  }: {
    contact: ContactWithOrg
    selected?: boolean
    onclick: () => void
  } = $props()
</script>

<button
  class="contact-card"
  class:selected
  onclick={onclick}
  type="button"
>
  <span class="name">{contact.name}</span>
  {#if contact.title}
    <span class="title">{contact.title}</span>
  {/if}
  {#if contact.organization_name}
    <span class="org">{contact.organization_name}</span>
  {/if}
  {#if contact.email}
    <span class="email">{contact.email}</span>
  {/if}
</button>

<style>
  .contact-card {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 100%;
    text-align: left;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface);
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .contact-card:hover {
    border-color: var(--color-info-border);
    background: var(--color-info-subtle);
  }

  .contact-card.selected {
    border-color: var(--color-info);
    background: var(--color-info-subtle);
  }

  .name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .title {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .org {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .email {
    font-size: 0.75rem;
    color: var(--text-faint);
  }
</style>
