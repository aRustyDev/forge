<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { LoadingSpinner, EmptyState } from '$lib/components'
  import { goto } from '$app/navigation'

  let loading = $state(true)
  let error = $state<string | null>(null)

  let pendingBullets = $state(0)
  let pendingPerspectives = $state(0)
  let totalSources = $state(0)
  let totalBullets = $state(0)
  let totalPerspectives = $state(0)
  let totalOrganizations = $state(0)
  let totalResumes = $state(0)
  let driftCount = $state(0)

  let nothingPending = $derived(pendingBullets === 0 && pendingPerspectives === 0)

  $effect(() => {
    loadData()
  })

  async function loadData() {
    loading = true
    error = null
    try {
      const [review, sources, bullets, perspectives, orgs, resumesList, drift] = await Promise.all([
        forge.review.pending(),
        forge.sources.list({ limit: 1 }),
        forge.bullets.list({ limit: 1 }),
        forge.perspectives.list({ limit: 1 }),
        forge.organizations.list({ limit: 1 }),
        forge.resumes.list({ limit: 1 }),
        forge.integrity.drift(),
      ])

      // Check if API is reachable
      const allFailed = !review.ok && !sources.ok && !bullets.ok && !perspectives.ok
      if (allFailed) {
        error = friendlyError(!review.ok ? review.error : { code: 'UNKNOWN_ERROR', message: 'Unknown error' })
        return
      }

      if (review.ok) {
        pendingBullets = review.data.bullets.count
        pendingPerspectives = review.data.perspectives.count
      }

      if (sources.ok) {
        totalSources = sources.pagination.total
      }

      if (bullets.ok) {
        totalBullets = bullets.pagination.total
      }

      if (perspectives.ok) {
        totalPerspectives = perspectives.pagination.total
      }

      if (orgs.ok) {
        totalOrganizations = orgs.pagination.total
      }

      if (resumesList.ok) {
        totalResumes = resumesList.pagination.total
      }

      if (drift.ok) {
        // drift.data may be a flat array or a grouped object — handle both
        if (Array.isArray(drift.data)) {
          driftCount = drift.data.length
        } else if (drift.data && typeof drift.data === 'object') {
          driftCount = (drift.data.bullets?.length ?? 0) + (drift.data.perspectives?.length ?? 0) + (drift.data.resume_entries?.length ?? 0)
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load dashboard data'
    } finally {
      loading = false
    }
  }
</script>

<div class="dashboard">
  <h1 class="page-title">Dashboard</h1>

  {#if loading}
    <div class="loading-container">
      <LoadingSpinner size="lg" message="Loading dashboard..." />
    </div>
  {:else if error}
    <div class="error-banner">
      <p>{error}</p>
      <button class="retry-btn" onclick={loadData}>Retry</button>
    </div>
  {:else}
    <!-- Pending Review Cards -->
    <section class="section">
      <h2 class="section-title">Pending Review</h2>

      {#if nothingPending}
        <EmptyState
          title="All caught up!"
          description="No bullets or perspectives are waiting for review."
          action="View Sources"
          onaction={() => goto('/data/sources')}
        />
      {:else}
        <div class="pending-grid">
          <a href="/data/sources?tab=bullets" class="pending-card">
            <div class="pending-count">{pendingBullets}</div>
            <div class="pending-label">Pending Bullets</div>
            <div class="pending-hint">Click to review</div>
          </a>
          <a href="/data/sources?tab=bullets" class="pending-card">
            <div class="pending-count">{pendingPerspectives}</div>
            <div class="pending-label">Pending Perspectives</div>
            <div class="pending-hint">Click to review</div>
          </a>
        </div>
      {/if}
    </section>

    <!-- Integrity Alerts -->
    <section class="section">
      <h2 class="section-title">Integrity Alerts</h2>

      {#if driftCount === 0}
        <div class="integrity-ok">
          <p>All snapshots are current. No drift detected.</p>
        </div>
      {:else}
        <a href="/chain" class="alert-card">
          <div class="alert-count">{driftCount}</div>
          <div class="alert-label">Drifted Entities</div>
          <div class="alert-hint">Snapshots no longer match current content. Click to view in Chain View.</div>
        </a>
      {/if}
    </section>

    <!-- Quick Stats -->
    <section class="section">
      <h2 class="section-title">Quick Stats</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">{totalSources}</div>
          <div class="stat-label">Sources</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{totalBullets}</div>
          <div class="stat-label">Bullets</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{totalPerspectives}</div>
          <div class="stat-label">Perspectives</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{totalOrganizations}</div>
          <div class="stat-label">Organizations</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{totalResumes}</div>
          <div class="stat-label">Resumes</div>
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 900px;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 1.75rem;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 4rem 0;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: #991b1b;
    font-size: 0.9rem;
  }

  .retry-btn {
    padding: 0.4rem 1rem;
    background: #ef4444;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: #dc2626;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Pending review cards -- 2-column grid */
  .pending-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .pending-card {
    display: block;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s, border-color 0.15s;
    cursor: pointer;
  }

  .pending-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-left-color: #d97706;
  }

  .pending-count {
    font-size: 2.25rem;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .pending-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .pending-hint {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  /* Integrity alerts */
  .integrity-ok {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
    color: #166534;
    font-size: 0.9rem;
  }

  .alert-card {
    display: block;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-left: 4px solid #ef4444;
    border-radius: 8px;
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s;
    cursor: pointer;
  }

  .alert-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .alert-count {
    font-size: 2.25rem;
    font-weight: 700;
    color: #ef4444;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .alert-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .alert-hint {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  /* Quick stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: #6c63ff;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #6b7280;
    font-weight: 500;
  }
</style>
