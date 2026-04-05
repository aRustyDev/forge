# Entity Overlay Modals

This directory houses the **reusable entity overlay modal pattern** — read-only detail views that any consumer in the app can open with a single function call, without any prop plumbing.

## The three-piece pattern

Each entity overlay consists of three files:

1. **`<Entity>OverlayModal.svelte`** — the prop-driven primitive. Wraps the base `$lib/components/Modal.svelte`, handles fetch state (`fetching` → `loaded` / `error`), renders the detail view. Can be used directly by consumers who want local-state control.

2. **`<Entity>OverlayHost.svelte`** — a zero-prop singleton mount. Reads the store and drives a single `<{Entity}OverlayModal>` instance. Mounted **exactly once** in `src/routes/+layout.svelte`.

3. **`<entity>Overlay.svelte.ts`** — the store: module-level `$state` + `open<Entity>Overlay(id, initialData?)` + `close<Entity>Overlay()` + a reactive getter object `<entity>OverlayState`. Follows the project convention established by `lib/stores/chain-view.svelte.ts`.

Plus a barrel in `index.ts` and this README.

## Consumer usage

```svelte
<script>
  import { openJDOverlay } from '$lib/components/overlays'
</script>

<button onclick={() => openJDOverlay(jd.id, {
  title: jd.title,
  status: jd.status,
  organization_name: jd.organization_name,
})}>
  {jd.title}
</button>
```

That's it. One import, one function call per consumer site. The modal is already mounted globally.

## The `initialData` optimization

Most consumer sites already have some JD fields in hand (e.g. a list row from `listJobDescriptions` has title/status/org but not raw_text). Passing those as `initialData` lets the modal paint instantly with the known fields while the canonical fetch runs in the background. Users see a fully-populated header immediately, then the body fills in ~100ms later instead of showing a loading spinner.

Skip `initialData` entirely if the caller has no pre-fetched fields — the modal will show a brief spinner while fetching.

## When to use this pattern

Use when:
- The overlay is **read-only** (detail view, not an editor)
- Multiple consumer sites might want to open it (more than 1–2)
- You want zero prop plumbing at the consumer sites

Don't use when:
- You need full CRUD in the modal (editing, creating) — use a dedicated editor modal instead
- The modal is tied to a single specific consumer with unique state (e.g. a picker dialog that has to cooperate with a form) — use a prop-driven local modal

## Migration policy for existing modals

Existing detail modals (`OrgDetailModal`, `BulletDetailModal`, `ChainViewModal`) are **not refactored** as part of this pattern's introduction. They stay prop-driven, matching their current consumer sites.

Migrate them opportunistically:
- When adding a second consumer site for the same entity
- When the modal is being touched for other reasons anyway
- Never as a batch refactor — that's churn without direct value

## Out of scope (for any overlay in this module)

- Markdown rendering of long text fields — plain text with `white-space: pre-wrap` unless a specific ticket calls for it
- Copy-to-clipboard actions — users can select text manually
- Status changes or any other interactive mutations — this is a read-only module by design
- Deep-linking overlay state to URL query params — future UX polish, not in this pattern
