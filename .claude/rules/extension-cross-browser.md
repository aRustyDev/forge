# Cross-Browser Extension Development Rules

These rules apply to all files in `packages/extension/`.

## Dual-Browser Build

The extension builds for both Chrome and Firefox from a single codebase.

- `BROWSER=chrome|firefox` env var selects the target (default: `chrome`)
- Output: `dist/chrome/` and `dist/firefox/`
- `bun run build` builds both; `bun run build:chrome` / `bun run build:firefox` for one
- `bun run dev` defaults to Firefox (user's daily browser is Zen)
- Manifests: `manifest.json` (Chrome MV3, service_worker) and `manifest.firefox.json` (Firefox MV3, background.scripts)

## Manifest Parity

When modifying one manifest, update the other to match. Fields that MUST stay in sync:
- `version`
- `permissions`
- `host_permissions`
- `action.default_popup`
- `name`, `description`

Fields that intentionally differ:
- `background.service_worker` (Chrome) vs `background.scripts` (Firefox)
- `browser_specific_settings.gecko` (Firefox only)

Tests in `tests/build/manifests.test.ts` enforce parity — update tests when adding new manifest fields.

## chrome.* API Usage

Both Chrome and Firefox MV3 support the `chrome.*` Promise-based API namespace. Use `chrome.*` directly — no polyfill or abstraction layer needed. If a future API divergence requires it, create `src/lib/browser.ts` as a thin abstraction.

## Content Script Constraint (Critical)

Content scripts (`src/content/*.ts`) are injected via `chrome.scripting.executeScript` at runtime. They CANNOT use ES module imports — they must be fully self-contained IIFE bundles.

**Rules:**
- Content scripts may import from `src/plugin/plugins/*` and `src/lib/*` — Vite inlines these
- Background worker (`src/background/`) must NEVER import from `src/plugin/plugins/*` — this would create shared chunks that break content script injection
- Build output tests (`tests/build/output.test.ts`) verify no `import` statements in content scripts
- If content scripts start showing `import` statements in build output, the build must be split into separate Vite passes (IIFE for content, ESM for background)

## Testing After Build Changes

After any change to `vite.config.ts`, manifests, or build scripts:
1. Run `bun run build` (both browsers)
2. Run `bun test` (includes build output verification)
3. Manually verify in both Chrome and Firefox/Zen that the extension loads and basic functions work

## Version Bumping

Extension version lives in BOTH `manifest.json` and `manifest.firefox.json`. Always bump both simultaneously. MVP versioning: `0.1.x` where x = MVP phase number.
