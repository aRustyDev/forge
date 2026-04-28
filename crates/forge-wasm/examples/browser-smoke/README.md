# forge-wasm browser smoke test (forge-nst6)

Manual proof-of-concept harness. Exercises the wa-sqlite round-trip
through `ForgeRuntime` + `Database`, backed by `IDBBatchAtomicVFS`
(IndexedDB persistence). Automated by **forge-901c** (headless Chrome
wasm-pack test harness) once that bead lands. OPFS migration tracked in
**forge-n89p**.

## Prerequisites

- `rustup install stable` and `rustup target add wasm32-unknown-unknown --toolchain stable`
- `cargo install wasm-pack`
- `bun` or `npm` (any modern Node-compatible package manager)

## Running

```bash
# 1. Build the wasm-pack output (creates ../../pkg/)
cd crates/forge-wasm
just wasm-pack-build              # or: wasm-pack build --target bundler

# 2. Install harness deps and start dev server
cd examples/browser-smoke
bun install                       # or npm install
bun run dev                       # serves on http://localhost:5180

# 3. Open http://localhost:5180 in Chromium / Firefox / Safari.
```

## What it exercises

1. **wa-sqlite npm resolution** — validates the bundler-resolved npm@1.0.0
   distribution decision (forge-zf8i tracks revisiting this).
2. **IDBBatchAtomicVFS** — IndexedDB-backed VFS that runs on the main
   thread without Web Worker requirement. Functionally equivalent to OPFS
   for the user (survives reload, same StorageManager quota); migrates to
   OPFS via forge-n89p when wa-sqlite ships a main-thread async OPFS VFS
   on npm.
3. **`Database::open` / `exec` / `query` / `close`** — validates the
   forge-nst6 binding signatures on real wa-sqlite calls.
4. **Browser persistence across reloads** — manual: insert a row, reload,
   run again. Each run's `SELECT` should return rows from prior runs in
   addition to the new one.

## Expected output (first run)

```
bundle version: 0.1.0
opened forge-poc.db on IDBBatchAtomicVFS
CREATE TABLE smoke ok
INSERT smoke(<timestamp>, <random>) ok
SELECT returned 1 row(s)
round-trip assertions PASSED
first run — reload and click "Run round-trip" again to verify IDB persistence
database closed cleanly
```

## Resetting the database

In Chromium DevTools: Application → Storage → IndexedDB → `forge-idb`
→ Delete database.

In Firefox: Tools → Browser Tools → Storage Inspector → IndexedDB →
`forge-idb` → Delete.

## Why this isn't `wasm-pack test`

`wasm-pack test --chrome --headless` (forge-901c) has limitations:

- It runs the wasm in a single page-load context, so persistence *across
  reloads* can't be exercised by it directly. forge-901c will cover the
  binding shape; cross-reload persistence stays a manual or Playwright-
  based check.
- It requires a CSP-permissive harness page that wasm-pack generates
  internally; configuring it for COOP/COEP cross-origin isolation is
  awkward.

This Vite-based example complements the headless harness — same code
path, manually verified.
