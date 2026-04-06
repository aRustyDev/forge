<!--
  Redirect: /experience/clearances → /qualifications/credentials

  Migration 037 (Phase 84) moved clearances from sources to credentials.
  This page previously rendered SourcesView with sourceTypeFilter="clearance".
  Now it redirects to the Qualifications sidebar group.
-->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    goto('/qualifications/credentials', { replaceState: true })
  })
</script>

<p style="padding: 2rem; color: var(--text-muted);">
  Redirecting to <a href="/qualifications/credentials">Qualifications &gt; Credentials</a>...
</p>
