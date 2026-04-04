<!--
  JDSkillPicker.svelte -- Skill tag picker for JD required skills.
  Matches the source/bullet skill picker pattern: immediate persistence.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { Skill } from '@forge/sdk'

  let {
    jdId,
    jdSkills = $bindable([]),
  }: {
    jdId: string
    jdSkills: Skill[]
  } = $props()

  let allSkills = $state<Skill[]>([])
  let skillSearch = $state('')
  let showDropdown = $state(false)
  let loading = $state(false)

  let filteredSkills = $derived.by(() => {
    const linked = new Set(jdSkills.map(s => s.id))
    let available = allSkills.filter(s => !linked.has(s.id))
    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase()
      available = available.filter(s => s.name.toLowerCase().includes(q))
    }
    return available.slice(0, 20)
  })

  $effect(() => {
    loadAllSkills()
  })

  async function loadAllSkills() {
    const res = await forge.skills.list()
    if (res.ok) {
      allSkills = res.data
    }
  }

  async function addSkillById(skillId: string) {
    loading = true
    const res = await forge.jobDescriptions.addSkill(jdId, { skill_id: skillId })
    if (res.ok) {
      jdSkills = [...jdSkills, res.data]
    } else {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
    skillSearch = ''
    showDropdown = false
    loading = false
  }

  async function addSkillByName(name: string) {
    if (!name.trim()) return
    loading = true
    const res = await forge.jobDescriptions.addSkill(jdId, { name: name.trim() })
    if (res.ok) {
      jdSkills = [...jdSkills, res.data]
      // Refresh all skills list so new skill appears in dropdown next time
      await loadAllSkills()
    } else {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
    skillSearch = ''
    showDropdown = false
    loading = false
  }

  async function removeSkill(skillId: string) {
    const res = await forge.jobDescriptions.removeSkill(jdId, skillId)
    if (res.ok) {
      jdSkills = jdSkills.filter(s => s.id !== skillId)
    } else {
      addToast({ type: 'error', message: friendlyError(res.error) })
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSkills.length > 0) {
        addSkillById(filteredSkills[0].id)
      } else if (skillSearch.trim()) {
        addSkillByName(skillSearch)
      }
    }
    if (e.key === 'Escape') {
      showDropdown = false
      skillSearch = ''
    }
  }
</script>

<div class="skill-picker">
  <div class="skill-tags">
    {#each jdSkills as skill (skill.id)}
      <span class="skill-pill">
        {skill.name}
        <button
          class="remove-btn"
          onclick={() => removeSkill(skill.id)}
          type="button"
          aria-label="Remove {skill.name}"
        >&times;</button>
      </span>
    {/each}
  </div>

  <div class="search-wrapper">
    <input
      type="text"
      class="skill-input"
      placeholder="Search or add skill..."
      bind:value={skillSearch}
      onfocus={() => (showDropdown = true)}
      onkeydown={handleKeydown}
      disabled={loading}
    />
    {#if showDropdown && (filteredSkills.length > 0 || skillSearch.trim())}
      <div class="dropdown">
        {#each filteredSkills as skill (skill.id)}
          <button
            class="dropdown-item"
            type="button"
            onclick={() => addSkillById(skill.id)}
          >
            {skill.name}
            {#if skill.category && skill.category !== 'general'}
              <span class="category-label">{skill.category}</span>
            {/if}
          </button>
        {/each}
        {#if skillSearch.trim() && filteredSkills.length === 0}
          <button
            class="dropdown-item create-item"
            type="button"
            onclick={() => addSkillByName(skillSearch)}
          >
            Create "{skillSearch.trim()}"
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .skill-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skill-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .skill-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2em 0.5em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.15em;
  }

  .remove-btn:hover {
    color: var(--color-danger);
  }

  .search-wrapper {
    position: relative;
  }

  .skill-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    font-size: 0.85rem;
    outline: none;
  }

  .skill-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    max-height: 200px;
    overflow-y: auto;
    z-index: 50;
    margin-top: 0.25rem;
  }

  .dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .dropdown-item:hover {
    background: var(--color-info-subtle);
  }

  .category-label {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .create-item {
    color: var(--color-primary);
    font-style: italic;
  }
</style>
