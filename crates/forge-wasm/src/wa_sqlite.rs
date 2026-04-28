//! Rust↔JS bindings to the wa-sqlite library.
//!
//! This module is **purely declarative** — it carries the `extern "C"` blocks
//! that wasm-bindgen turns into JS-imports and method-call shims at build
//! time. Higher-level wrappers (`Database`, `ForgeRuntime::open_database`)
//! live in sibling modules.
//!
//! ## What we bind
//!
//! - The wa-sqlite Asyncify ESM factory
//!   (`wa-sqlite/dist/wa-sqlite-async.mjs`) — produces a SQLite `Module`
//!   that supports async VFS callbacks via Asyncify (required by every
//!   browser-side persistent VFS in wa-sqlite@1.0.0).
//! - The `SQLite.Factory(module)` constructor (`wa-sqlite`) — wraps the
//!   module in an OOP-style API object (`SQLiteAPI`) that exposes the
//!   `open_v2` / `exec` / `close` / `vfs_register` methods we need.
//! - The `IDBBatchAtomicVFS` class
//!   (`wa-sqlite/src/examples/IDBBatchAtomicVFS.js`) — IndexedDB-backed
//!   VFS that runs on the main thread without Web Worker requirement.
//!
//! ## Why IDB and not OPFS for this PoC
//!
//! wa-sqlite@1.0.0 (the only npm-published version) ships
//! `OriginPrivateFileSystemVFS` which uses `createSyncAccessHandle()` —
//! Worker-only on Chromium/WebKit. The truly main-thread async OPFS VFS
//! (`OPFSAnyContextVFS`) only exists on master HEAD (1.1.1) and is not on
//! npm. To stay within decision A (npm distribution) AND decision B
//! (main-thread, defer Worker), we use IDB-backed wa-sqlite for the PoC.
//!
//! IndexedDB persistence is functionally equivalent to OPFS persistence
//! from the user's perspective (survives reload, subject to same
//! StorageManager quota, clearable via "clear site data"). The
//! progressive Svelte → Tauri → Dioxus rewrite story is unaffected by
//! VFS choice — the wasm-bindgen surface above this binding is identical.
//!
//! Migration to OPFS-backed persistence is tracked in **forge-n89p**
//! (created at the same time as this bead).
//!
//! ## What we deliberately do NOT bind here
//!
//! - `prepare_v2` / `step` / `column_*` / `bind_*` — the PoC uses
//!   `exec(db, sql, callback)` for both DDL and SELECT. Statement-level
//!   binding/iteration is added when the BrowserStore adapter (forge-lu5s)
//!   needs parameterized queries.
//! - Other VFS implementations — out of scope for forge-nst6.
//!
//! ## Async story
//!
//! All DB-side operations on `SQLiteAPI` are async (return `Promise`)
//! when running against the Asyncify build, even ones that look
//! synchronous in the pure-WASM C API. The Rust extern shims use
//! `#[wasm_bindgen(method, catch)]` with `async fn` and
//! `Result<JsValue, JsValue>` returns, which wasm-bindgen translates
//! into JS Promise unwrapping with error capture.

use wasm_bindgen::prelude::*;

// ── wa-sqlite Asyncify ESM factory ───────────────────────────────────────
//
// The default export of `wa-sqlite/dist/wa-sqlite-async.mjs` is an
// Emscripten-generated factory that resolves to a `Module` (the SQLite
// WASM glue object). We treat the returned `Module` as an opaque
// `JsValue` — passed through to `SQLite.Factory` and the VFS constructor
// and never inspected from Rust.

#[wasm_bindgen(module = "wa-sqlite/dist/wa-sqlite-async.mjs")]
extern "C" {
    /// Default export — the Emscripten module factory (Asyncify build).
    #[wasm_bindgen(js_name = "default", catch)]
    pub async fn sqlite_esm_factory() -> Result<JsValue, JsValue>;
}

// ── wa-sqlite SQLiteAPI ──────────────────────────────────────────────────
//
// `SQLite.Factory(module)` returns the OOP-style API object that exposes
// per-database methods. Modeled here as an opaque wasm-bindgen type
// (`SqliteApi`) with method bindings.

#[wasm_bindgen(module = "wa-sqlite")]
extern "C" {
    /// Opaque handle to a wa-sqlite API instance, returned by `Factory`.
    pub type SqliteApi;

    /// `Factory(module: Module): SQLiteAPI`
    #[wasm_bindgen(js_name = "Factory")]
    pub fn sqlite_api_factory(module: JsValue) -> SqliteApi;

    /// `vfs_register(vfs, makeDefault)` — register a VFS instance and
    /// optionally promote it to the default for subsequent `open_v2` calls
    /// that don't pass an explicit `vfs` argument.
    #[wasm_bindgen(method, catch, js_name = "vfs_register")]
    pub fn vfs_register(this: &SqliteApi, vfs: &JsValue, make_default: bool) -> Result<JsValue, JsValue>;

    /// `open_v2(filename, flags?, zVfs?) -> Promise<dbHandle>`
    /// — `flags` defaults internally to `SQLITE_OPEN_CREATE | _READWRITE`.
    /// — `vfs` selects a registered VFS by name; pass `None` to use the
    ///   default (set via `vfs_register`).
    #[wasm_bindgen(method, catch, js_name = "open_v2")]
    pub async fn open_v2(
        this: &SqliteApi,
        filename: &str,
        flags: Option<i32>,
        vfs: Option<String>,
    ) -> Result<JsValue, JsValue>;

    /// `exec(db, sql, callback?) -> Promise<resultCode>`
    /// — `callback` is a JS function `(rowValues, colNames) => void`
    ///   invoked once per row. Pass `JsValue::UNDEFINED` to skip rows.
    #[wasm_bindgen(method, catch)]
    pub async fn exec(
        this: &SqliteApi,
        db: &JsValue,
        sql: &str,
        callback: &JsValue,
    ) -> Result<JsValue, JsValue>;

    /// `close(db) -> Promise<resultCode>`
    #[wasm_bindgen(method, catch)]
    pub async fn close(this: &SqliteApi, db: &JsValue) -> Result<JsValue, JsValue>;
}

// ── IDBBatchAtomicVFS ────────────────────────────────────────────────────
//
// IndexedDB-backed VFS chosen for the forge-nst6 PoC. Constructor is
// synchronous; opens its IDB database lazily on first SQLite I/O. The
// instance's `name` field becomes the VFS name we pass to `open_v2`.
//
// Constructor signature:
//   new IDBBatchAtomicVFS(idbDatabaseName = 'wa-sqlite', options?)
//
// We pass our own database name so the IDB database is namespaced to
// forge specifically, not the generic 'wa-sqlite' default.

#[allow(non_camel_case_types)]
#[wasm_bindgen(module = "wa-sqlite/src/examples/IDBBatchAtomicVFS.js")]
extern "C" {
    /// Opaque handle to an IDBBatchAtomicVFS instance.
    pub type IDBBatchAtomicVFS;

    /// `new IDBBatchAtomicVFS(idbDatabaseName)` — synchronous
    /// constructor. The IDB database is created lazily on first access.
    #[wasm_bindgen(constructor)]
    pub fn new(idb_database_name: &str) -> IDBBatchAtomicVFS;
}

// ── SQLite constants ─────────────────────────────────────────────────────
//
// Result codes we care about for error mapping. Mirrors the canonical
// SQLite values; identical to the constants in
// `wa-sqlite/src/sqlite-constants.js` so we don't have to import them at
// runtime.

/// Operation completed successfully.
pub const SQLITE_OK: i32 = 0;

/// Statement returned a row (from `step`).
pub const SQLITE_ROW: i32 = 100;

/// Statement finished — no more rows.
pub const SQLITE_DONE: i32 = 101;
