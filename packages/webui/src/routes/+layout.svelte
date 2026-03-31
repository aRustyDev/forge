<script>
  import { page } from '$app/state'
  import { ToastContainer } from '$lib/components'
  import { navigation, isNavGroup } from '$lib/nav'

  let { children } = $props()

  // Accordion expanded state: keyed by group prefix.
  // NOTE: Must use Record<string, boolean> with $state, NOT a Set.
  // Set.add() / Set.delete() are method calls that mutate without assignment,
  // so $effect and {#if} blocks won't re-trigger. Record property writes
  // (expanded[key] = value) ARE tracked by Svelte 5 runes.
  let expanded = $state<Record<string, boolean>>({})

  // Auto-expand group matching current route on navigation
  $effect(() => {
    for (const entry of navigation) {
      if (isNavGroup(entry) && page.url.pathname.startsWith(entry.prefix)) {
        expanded[entry.prefix] = true
      }
    }
  })

  function toggleGroup(prefix: string) {
    expanded[prefix] = !expanded[prefix]
  }

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/'
    return page.url.pathname.startsWith(href)
  }

  function isGroupActive(group: { prefix: string }): boolean {
    return page.url.pathname.startsWith(group.prefix)
  }
</script>

<div class="app">
  <nav class="sidebar">
    <div class="logo">
      <h2>Forge</h2>
    </div>
    <ul class="nav-list">
      {#each navigation as entry}
        {#if isNavGroup(entry)}
          <li class="nav-group">
            <button
              class="group-label"
              class:group-active={isGroupActive(entry)}
              onclick={() => toggleGroup(entry.prefix)}
            >
              <span>{entry.label}</span>
              <span class="chevron" class:open={expanded[entry.prefix]}>
                &#9656;
              </span>
            </button>
            {#if expanded[entry.prefix]}
              <ul class="group-children">
                {#each entry.children as child}
                  <li>
                    <a
                      href={child.href}
                      class:active={isActive(child.href)}
                    >
                      {child.label}
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {:else}
          <li>
            <a
              href={entry.href}
              class="top-link"
              class:active={isActive(entry.href)}
            >
              {entry.label}
            </a>
          </li>
        {/if}
      {/each}
    </ul>
  </nav>
  <main class="content">
    {@render children()}
  </main>
</div>

<ToastContainer />

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen, Ubuntu, Cantarell, sans-serif;
    color: #1a1a1a;
    background: #f5f5f5;
  }

  .app {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 220px;
    background: #1a1a2e;
    color: #e0e0e0;
    padding: 1.5rem 0;
    flex-shrink: 0;
    overflow-y: auto;
  }

  .logo {
    padding: 0 1.5rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 1rem;
  }

  .logo h2 {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .nav-list {
    list-style: none;
  }

  /* Top-level standalone links (Dashboard, Resumes) */
  .top-link {
    display: block;
    padding: 0.625rem 1.5rem;
    color: #b0b0c0;
    text-decoration: none;
    font-size: 0.9rem;
    transition: background 0.15s, color 0.15s;
  }

  .top-link:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .top-link.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-left: 3px solid #6c63ff;
    padding-left: calc(1.5rem - 3px);
  }

  /* Group label (accordion toggle) */
  .nav-group {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .nav-group:first-child {
    border-top: none;
  }

  .group-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.625rem 1.5rem;
    background: none;
    border: none;
    color: #b0b0c0;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-align: left;
  }

  .group-label:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .group-label.group-active {
    color: #fff;
    font-weight: 600;
  }

  .chevron {
    font-size: 0.7rem;
    transition: transform 0.15s;
    display: inline-block;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  /* Child links within a group */
  .group-children {
    list-style: none;
  }

  .group-children li a {
    display: block;
    padding: 0.45rem 1.5rem 0.45rem 2.5rem;
    color: #9090a8;
    text-decoration: none;
    font-size: 0.82rem;
    transition: background 0.15s, color 0.15s;
  }

  .group-children li a:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #d0d0e0;
  }

  .group-children li a.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-left: 3px solid #6c63ff;
    padding-left: calc(2.5rem - 3px);
  }

  .content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }
</style>
