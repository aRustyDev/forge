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

    /// `prepare_v2(db, sqlPtr) -> Promise<{stmt, sql} | null>` — `stmt` is
    /// the prepared-statement handle (opaque); `sql` is the unconsumed
    /// remainder POINTER (not a JS string). The whole call returns `null`
    /// when there's no SQL left to prepare.
    ///
    /// IMPORTANT: `sqlPtr` is a numeric C-pointer into wa-sqlite's heap.
    /// Allocate it via `str_new` + `str_value`. Passing a JS string here
    /// silently coerces to NaN/0, sqlite3 errors out, and `sqlite3_errmsg`
    /// returns "not an error" because no real op set the error string.
    #[wasm_bindgen(method, catch, js_name = "prepare_v2")]
    pub async fn prepare_v2(
        this: &SqliteApi,
        db: &JsValue,
        sql_ptr: &JsValue,
    ) -> Result<JsValue, JsValue>;

    /// `str_new(db, sql) -> str_handle (number)`. Allocates SQLite memory
    /// for the SQL string and returns an opaque integer handle managed by
    /// wa-sqlite's internal `strings` map. Pair with `str_finish`.
    #[wasm_bindgen(method, js_name = "str_new")]
    pub fn str_new(this: &SqliteApi, db: &JsValue, sql: &str) -> JsValue;

    /// `str_value(str_handle) -> sqlPointer (number)`. Returns the C-pointer
    /// to the allocated SQL bytes, suitable for passing to `prepare_v2`.
    #[wasm_bindgen(method, js_name = "str_value")]
    pub fn str_value(this: &SqliteApi, str_handle: &JsValue) -> JsValue;

    /// `str_finish(str_handle)`. Frees the allocated SQL memory.
    #[wasm_bindgen(method, js_name = "str_finish")]
    pub fn str_finish(this: &SqliteApi, str_handle: &JsValue);

    /// `step(stmt) -> Promise<resultCode>` — `SQLITE_ROW` (100) when a
    /// row is available, `SQLITE_DONE` (101) when iteration is complete.
    #[wasm_bindgen(method, catch)]
    pub async fn step(this: &SqliteApi, stmt: &JsValue) -> Result<JsValue, JsValue>;

    /// `reset(stmt) -> Promise<resultCode>` — rewinds the statement so
    /// `bind_*` + `step` can run again with new parameters.
    #[wasm_bindgen(method, catch)]
    pub async fn reset(this: &SqliteApi, stmt: &JsValue) -> Result<JsValue, JsValue>;

    /// `finalize(stmt) -> Promise<resultCode>` — destroys the prepared
    /// statement, releasing its memory. Idempotent in our wrapper.
    #[wasm_bindgen(method, catch)]
    pub async fn finalize(this: &SqliteApi, stmt: &JsValue) -> Result<JsValue, JsValue>;

    /// `bind_text(stmt, idx, value) -> resultCode`. `idx` is 1-based.
    #[wasm_bindgen(method, catch)]
    pub fn bind_text(this: &SqliteApi, stmt: &JsValue, idx: i32, value: &str) -> Result<JsValue, JsValue>;

    /// `bind_int64(stmt, idx, value) -> resultCode`. wa-sqlite accepts
    /// JS Number; we widen i64 → f64 at the boundary, accepting precision
    /// loss for ids beyond 2^53 (forge UUIDs are strings, so this is moot
    /// in practice).
    #[wasm_bindgen(method, catch, js_name = "bind_int64")]
    pub fn bind_int64(this: &SqliteApi, stmt: &JsValue, idx: i32, value: f64) -> Result<JsValue, JsValue>;

    /// `bind_double(stmt, idx, value) -> resultCode`.
    #[wasm_bindgen(method, catch)]
    pub fn bind_double(this: &SqliteApi, stmt: &JsValue, idx: i32, value: f64) -> Result<JsValue, JsValue>;

    /// `bind_blob(stmt, idx, value) -> resultCode`. wa-sqlite expects a
    /// Uint8Array on the JS side; wasm-bindgen turns `&[u8]` into one.
    #[wasm_bindgen(method, catch)]
    pub fn bind_blob(this: &SqliteApi, stmt: &JsValue, idx: i32, value: &[u8]) -> Result<JsValue, JsValue>;

    /// `bind_null(stmt, idx) -> resultCode`.
    #[wasm_bindgen(method, catch)]
    pub fn bind_null(this: &SqliteApi, stmt: &JsValue, idx: i32) -> Result<JsValue, JsValue>;

    /// `column_count(stmt) -> i32`.
    #[wasm_bindgen(method, js_name = "column_count")]
    pub fn column_count(this: &SqliteApi, stmt: &JsValue) -> i32;

    /// `column_type(stmt, idx) -> i32`. Returns SQLite type codes:
    /// 1=INTEGER, 2=FLOAT, 3=TEXT, 4=BLOB, 5=NULL.
    #[wasm_bindgen(method, js_name = "column_type")]
    pub fn column_type(this: &SqliteApi, stmt: &JsValue, idx: i32) -> i32;

    /// `column_text(stmt, idx) -> String`. Returns "" for NULL — caller
    /// must check column_type first to disambiguate.
    #[wasm_bindgen(method, js_name = "column_text")]
    pub fn column_text(this: &SqliteApi, stmt: &JsValue, idx: i32) -> String;

    /// `column_int(stmt, idx) -> i32`. wa-sqlite has separate `column_int`
    /// and `column_int64`; for forge's needs (counts, small ints) `int`
    /// suffices. If you need full i64 range, switch to `column_int64`.
    #[wasm_bindgen(method, js_name = "column_int")]
    pub fn column_int(this: &SqliteApi, stmt: &JsValue, idx: i32) -> i32;

    /// `column_double(stmt, idx) -> f64`.
    #[wasm_bindgen(method, js_name = "column_double")]
    pub fn column_double(this: &SqliteApi, stmt: &JsValue, idx: i32) -> f64;

    /// `column_blob(stmt, idx) -> Uint8Array`. wasm-bindgen converts
    /// the JS Uint8Array into `Vec<u8>` on the Rust side.
    #[wasm_bindgen(method, js_name = "column_blob")]
    pub fn column_blob(this: &SqliteApi, stmt: &JsValue, idx: i32) -> Vec<u8>;
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

/// SQLite column type — INTEGER.
pub const SQLITE_INTEGER: i32 = 1;
/// SQLite column type — FLOAT.
pub const SQLITE_FLOAT: i32 = 2;
/// SQLite column type — TEXT.
pub const SQLITE_TEXT: i32 = 3;
/// SQLite column type — BLOB.
pub const SQLITE_BLOB: i32 = 4;
/// SQLite column type — NULL.
pub const SQLITE_NULL: i32 = 5;
