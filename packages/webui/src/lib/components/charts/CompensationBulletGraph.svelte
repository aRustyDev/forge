<!--
  CompensationBulletGraph.svelte -- Bullet graph comparing JD salary range
  against user salary expectations (minimum/target/stretch).

  Uses stacked bar trick for range display, markArea for qualitative bands,
  and markLine for reference lines.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { forge } from '$lib/sdk'
  import EChart from './EChart.svelte'
  import { buildCompensationOption } from './compensation-utils'
  import type { SalaryExpectations } from './compensation-utils'

  let {
    jdTitle,
    salaryMin,
    salaryMax,
  }: {
    jdTitle: string
    salaryMin: number | null
    salaryMax: number | null
  } = $props()

  let expectations = $state<SalaryExpectations>({
    minimum: null,
    target: null,
    stretch: null,
  })
  let loadingProfile = $state(true)

  // Load user salary expectations from profile on mount (not $effect)
  // to avoid unnecessary re-fetches. Profile data does not depend on
  // the JD and only needs to be loaded once per component lifecycle.
  onMount(() => { loadExpectations() })

  async function loadExpectations() {
    loadingProfile = true
    try {
      const result = await forge.profile.get()
      if (result.ok) {
        expectations = {
          minimum: result.data.salary_minimum ?? null,
          target: result.data.salary_target ?? null,
          stretch: result.data.salary_stretch ?? null,
        }
      }
    } finally {
      loadingProfile = false
    }
  }

  // Treat salary_min = 0 and salary_max = 0 as 'not set' -- same as null.
  let hasJDSalary = $derived(
    (salaryMin != null && salaryMin > 0) || (salaryMax != null && salaryMax > 0)
  )
  let hasExpectations = $derived(
    expectations.minimum != null ||
    expectations.target != null ||
    expectations.stretch != null
  )

  let chartOption = $derived(
    hasJDSalary
      ? buildCompensationOption({
          jdSalary: { min: salaryMin, max: salaryMax },
          expectations,
          jdTitle,
        })
      : null
  )
</script>

{#if loadingProfile}
  <div class="comp-loading">Loading compensation data...</div>
{:else if !hasJDSalary}
  <div class="comp-empty">
    No salary data entered for this JD. Add salary values to see compensation analysis.
  </div>
{:else}
  <div class="comp-container">
    <EChart
      option={chartOption!}
      height="180px"
      notMerge={true}
    />
    {#if !hasExpectations}
      <div class="comp-hint">
        Set your salary expectations in
        <a href="/config/profile">Profile Settings</a>
        to see how this JD compares.
      </div>
    {/if}
  </div>
{/if}

<style>
  .comp-loading,
  .comp-empty {
    padding: 1rem;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--text-muted);
    border: 1px dashed var(--color-border);
    border-radius: 0.5rem;
    margin: 0.75rem 0;
  }

  .comp-container {
    margin: 0.75rem 0;
  }

  .comp-hint {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--text-muted);
    text-align: center;
    margin-top: 0.5rem;
  }

  .comp-hint a {
    color: var(--color-info);
    text-decoration: none;
  }

  .comp-hint a:hover {
    text-decoration: underline;
  }
</style>
