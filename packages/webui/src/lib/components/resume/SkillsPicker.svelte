<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { Skill } from '@forge/sdk'

  let {
    resumeId,
    sectionId,
    onClose,
    onUpdate,
  }: {
    resumeId: string
    sectionId: string
    onClose: () => void
    onUpdate: () => Promise<void>
  } = $props()

  let allSkills = $state<Skill[]>([])
  let selectedSkillIds = $state<Set<string>>(new Set())
  let loading = $state(true)

  // Load all skills and currently-selected skills
  $effect(() => {
    loadData()
  })

  async function loadData() {
    loading = true
    try {
      // Load all skills
      const skillsResult = await forge.skills.list({ limit: 500 })
      if (skillsResult.ok) {
        allSkills = skillsResult.data
      }

      // Load currently-selected skill IDs from the API
      await loadSelectedSkills()
    } catch (e) {
      addToast({ message: 'Failed to load skills', type: 'error' })
    } finally {
      loading = false
    }
  }

  async function loadSelectedSkills() {
    const result = await forge.resumes.listSkills(resumeId, sectionId)
    if (result.ok) {
      selectedSkillIds = new Set(result.data.map(rs => rs.skill_id))
    }
  }

  // Group skills by category
  let groupedSkills = $derived.by(() => {
    const groups = new Map<string, Skill[]>()
    for (const skill of allSkills) {
      const cat = skill.category ?? 'Other'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(skill)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  })

  async function toggleSkill(skillId: string) {
    if (selectedSkillIds.has(skillId)) {
      // Remove
      const result = await forge.resumes.removeSkill(resumeId, sectionId, skillId)
      if (result.ok) {
        await loadSelectedSkills()
        await onUpdate()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } else {
      // Add
      const result = await forge.resumes.addSkill(resumeId, sectionId, skillId)
      if (result.ok) {
        await loadSelectedSkills()
        await onUpdate()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="skills-picker-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Select Skills">
    <div class="picker-header">
      <h3>Select Skills</h3>
      <button class="btn btn-sm btn-ghost" onclick={onClose}>Close</button>
    </div>

    {#if loading}
      <p class="loading-text">Loading skills...</p>
    {:else if groupedSkills.length === 0}
      <p class="empty-text">No skills found. Add skills first.</p>
    {:else}
      <div class="skills-grid">
        {#each groupedSkills as [category, skills]}
          <div class="skill-category-group">
            <h4 class="category-label">{category}</h4>
            <div class="skill-checkboxes">
              {#each skills as skill}
                <label class="skill-checkbox" class:checked={selectedSkillIds.has(skill.id)}>
                  <input
                    type="checkbox"
                    checked={selectedSkillIds.has(skill.id)}
                    onchange={() => toggleSkill(skill.id)}
                  />
                  <span>{skill.name}</span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .skills-picker-modal {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .picker-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--text-primary);
  }

  .skill-category-group {
    margin-bottom: var(--space-4);
  }

  .category-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.35rem;
    border-bottom: 1px solid var(--color-surface-sunken);
    padding-bottom: 0.15rem;
  }

  .skill-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .skill-checkbox {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s;
  }

  .skill-checkbox:hover {
    background: var(--color-primary-subtle);
  }

  .skill-checkbox.checked {
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
  }

  .skill-checkbox input[type="checkbox"] {
    accent-color: var(--color-primary);
  }

  .loading-text, .empty-text {
    text-align: center;
    color: var(--text-faint);
    font-size: 0.85rem;
    padding: 2rem;
  }

  .btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: var(--text-xs); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
</style>
