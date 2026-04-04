<!--
  ExtractedSkillCard.svelte -- Individual extracted skill row with accept/reject/edit.
  Skill name is editable inline: click name to edit, Enter commits, Escape cancels.
-->
<script lang="ts">
  import type { ExtractedSkill } from '@forge/sdk'
  import ConfidenceBar from '$lib/components/ConfidenceBar.svelte'

  let { skill, isLinked, onaccept, ondismiss, onedit }: {
    skill: ExtractedSkill
    isLinked: boolean
    onaccept: () => void
    ondismiss: () => void
    onedit: (newName: string) => void
  } = $props()

  let editing = $state(false)
  let editValue = $state(skill.name)

  function startEdit() {
    if (isLinked) return
    editing = true
    editValue = skill.name
  }

  function commitEdit() {
    editing = false
    if (editValue.trim() && editValue.trim() !== skill.name) {
      onedit(editValue.trim())
    }
  }

  function cancelEdit() {
    editing = false
    editValue = skill.name
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const CATEGORY_COLORS: Record<string, string> = {
    language: '#3b82f6',
    framework: '#8b5cf6',
    tool: '#06b6d4',
    platform: '#f59e0b',
    methodology: '#10b981',
    domain: '#ec4899',
    soft_skill: '#6b7280',
    certification: '#f97316',
    other: '#9ca3af',
  }

  let categoryColor = $derived(CATEGORY_COLORS[skill.category] ?? '#9ca3af')
</script>

<div class="extracted-skill-card" class:linked={isLinked}>
  <div class="skill-info">
    {#if editing}
      <input
        type="text"
        class="skill-name-input"
        bind:value={editValue}
        onkeydown={handleKeydown}
        onblur={commitEdit}
        autofocus
      />
    {:else}
      <button
        class="skill-name"
        class:editable={!isLinked}
        onclick={startEdit}
        disabled={isLinked}
        title={isLinked ? 'Already linked' : 'Click to edit name'}
      >
        {skill.name}
      </button>
    {/if}

    <span
      class="category-badge"
      style="background: {categoryColor}20; color: {categoryColor};"
    >
      {skill.category}
    </span>

    <ConfidenceBar value={skill.confidence} />
    <span class="confidence-value">{skill.confidence.toFixed(2)}</span>
  </div>

  <div class="skill-actions">
    {#if isLinked}
      <span class="linked-label muted">Already linked</span>
    {:else}
      <button class="accept-btn" onclick={onaccept}>Accept</button>
      <button class="dismiss-btn" onclick={ondismiss} aria-label="Dismiss">&times;</button>
    {/if}
  </div>
</div>

<style>
  .extracted-skill-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px solid var(--color-border, #f3f4f6);
    gap: 8px;
  }

  .extracted-skill-card.linked {
    opacity: 0.5;
  }

  .skill-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .skill-name {
    font-weight: 500;
    font-size: 0.875rem;
    background: none;
    border: none;
    padding: 0;
    cursor: default;
    text-align: left;
  }

  .skill-name.editable {
    cursor: pointer;
  }

  .skill-name.editable:hover {
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  .skill-name-input {
    font-weight: 500;
    font-size: 0.875rem;
    padding: 1px 4px;
    border: 1px solid var(--color-border-strong, #d1d5db);
    border-radius: 3px;
    width: 140px;
  }

  .category-badge {
    font-size: 0.625rem;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .confidence-value {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
    min-width: 28px;
    text-align: right;
  }

  .skill-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .accept-btn {
    font-size: 0.75rem;
    padding: 2px 8px;
    border: 1px solid var(--color-success, #22c55e);
    border-radius: 4px;
    background: var(--color-success-subtle, #f0fdf4);
    color: var(--color-success-text, #16a34a);
    cursor: pointer;
  }

  .accept-btn:hover {
    background: #dcfce7;
  }

  .dismiss-btn {
    font-size: 1rem;
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--text-muted, #6b7280);
    cursor: pointer;
  }

  .dismiss-btn:hover {
    color: var(--color-danger, #ef4444);
  }

  .linked-label {
    font-size: 0.75rem;
    font-style: italic;
    color: var(--text-muted, #6b7280);
  }
</style>
