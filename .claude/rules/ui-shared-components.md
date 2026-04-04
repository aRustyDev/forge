---
globs:
  - "packages/webui/src/**/*.svelte"
  - "packages/webui/src/**/*.css"
---

# UI Shared Component Rules

These rules apply to all Svelte and CSS files in the webui package.

## Forbidden Patterns

1. **No inline viewport-escape CSS.** Full-viewport pages MUST use `<PageWrapper>`, not inline `height: calc(100vh - 4rem); margin: -2rem`.

2. **No inline split-panel CSS.** Two-column list+detail layouts MUST use `<SplitPanel>`, not inline `.list-panel` / `.editor-panel` CSS.

3. **No inline list-header CSS.** Split-panel list headers MUST use `<ListPanelHeader>`, not inline `.list-header` + `.btn-new` markup and CSS.

4. **No page-scoped button CSS.** Button styling MUST use global `.btn` + `.btn-primary`/`.btn-danger`/`.btn-ghost` classes from `base.css`, not page-scoped button CSS. "Create new" action buttons MUST use `--color-primary`, not `--color-info`.

5. **No inline page-title CSS.** Page titles MUST use `<PageHeader>`, not inline `.page-title` CSS.

6. **No inline tab-btn CSS.** Tab navigation MUST use `<TabBar>`, not hand-rolled `.tab-btn` or `.filter-tab` CSS.

7. **No inline editor-empty CSS.** "No selection" panel states MUST use `<EmptyPanel>`, not inline `.editor-empty` CSS or `<EmptyState>`.

8. **No inline search-input CSS.** List search/filter inputs MUST use `<ListSearchInput>`, not inline `.search-input` CSS.

## Component Import Pattern

All shared components are exported from `$lib/components/index.ts`:

```svelte
<script lang="ts">
  import { PageWrapper, SplitPanel, ListPanelHeader, PageHeader, TabBar, EmptyPanel, ListSearchInput } from '$lib/components'
</script>
```

## When Adding New Pages

New pages that use any of the patterns above MUST use the shared component. Never copy CSS from an existing page -- import the component instead.
