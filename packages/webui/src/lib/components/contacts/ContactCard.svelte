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
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: #fff;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .contact-card:hover {
    border-color: #93c5fd;
    background: #f0f9ff;
  }

  .contact-card.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1a1a2e;
  }

  .title {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .org {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .email {
    font-size: 0.75rem;
    color: #9ca3af;
  }
</style>
