//! High-level async wrapper around a wa-sqlite database connection.
//!
//! Layered on top of the bare extern bindings in [`crate::wa_sqlite`]. The
//! surface here is the smallest one needed for the forge-nst6 PoC
//! round-trip:
//!
//! - [`Database::open`] — async constructor (Rust-only, called from
//!   [`crate::ForgeRuntime::open_database`]). Opens (or creates) the
//!   named IDB-backed database, registering `IDBBatchAtomicVFS` as the
//!   default VFS on first call.
//! - [`Database::exec`] — JS-facing fire-and-forget DDL/DML/SELECT-without-
//!   capture.
//! - [`Database::query`] — JS-facing exec with row capture; returns a JS
//!   `Array<Array<string|null>>` so the harness can `JSON.stringify` it
//!   for assertions without further glue.
//! - [`Database::close`] — explicit close. Idempotent.
//!
//! ## Why IDB and not OPFS for this PoC
//!
//! See `wa_sqlite.rs` module docs and bead **forge-n89p** for the
//! migration trigger. Short version: wa-sqlite@1.0.0 npm doesn't ship a
//! main-thread async OPFS VFS, so we use IDB-backed wa-sqlite to satisfy
//! both decision A (npm distribution) and decision B (main-thread,
//! defer Worker). Browser persistence is functionally equivalent.
//!
//! ## Why string-only row cells in this PoC
//!
//! The forge-nst6 deliverable is *the binding works end-to-end*, not a
//! typed-row API. Numbers and booleans are rendered as their string
//! representations; SQL NULL becomes JS `null`. Typed extraction
//! (`column_int`, parameterized binding, etc.) lands when forge-lu5s
//! (BrowserStore adapter) needs it.

use forge_core::ForgeError;
use js_sys::{Array, Function};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::error::MapJsValueErr;
#[allow(non_camel_case_types)]
use crate::wa_sqlite::{sqlite_api_factory, sqlite_esm_factory, IDBBatchAtomicVFS, SqliteApi};

/// Name we register the wa-sqlite VFS under. Doubles as the IndexedDB
/// database name (the VFS uses its constructor argument for both).
/// Subsequent `open_v2` calls pass this string as the `vfs` argument to
/// route I/O through the IDB-backed VFS.
pub const VFS_NAME: &str = "forge-idb";

/// JS-facing handle to a wa-sqlite database opened against the IDB VFS.
#[wasm_bindgen]
pub struct Database {
    api: SqliteApi,
    db_handle: JsValue,
    closed: bool,
}

// ── Rust-only API ────────────────────────────────────────────────────────

impl Database {
    /// Open or create the named database. Called from
    /// [`crate::ForgeRuntime::open_database`].
    ///
    /// On every call this re-runs the wa-sqlite ESM factory, constructs
    /// the `IDBBatchAtomicVFS`, and registers it as the default.
    /// Adequate for the PoC; forge-lu5s will hoist the API + VFS onto a
    /// long-lived `ForgeRuntime` field so it's done once per page load.
    pub async fn open(filename: &str) -> Result<Self, ForgeError> {
        let module = sqlite_esm_factory().await.map_jsvalue_err()?;
        let api = sqlite_api_factory(module);

        let vfs = IDBBatchAtomicVFS::new(VFS_NAME);
        api.vfs_register(vfs.as_ref(), true).map_jsvalue_err()?;

        let db_handle = api
            .open_v2(filename, None, Some(VFS_NAME.to_string()))
            .await
            .map_jsvalue_err()?;

        Ok(Self {
            api,
            db_handle,
            closed: false,
        })
    }
}

// ── JS-facing API ────────────────────────────────────────────────────────

#[wasm_bindgen]
impl Database {
    /// Execute SQL that doesn't need to capture rows (DDL, INSERT,
    /// UPDATE, DELETE, plus any SELECT whose result you intend to discard).
    pub async fn exec(&self, sql: String) -> Result<(), JsValue> {
        self.api
            .exec(&self.db_handle, &sql, &JsValue::UNDEFINED)
            .await
            .map_err(forge_error_jsvalue)?;
        Ok(())
    }

    /// Execute SQL and collect every row. Returns a JS
    /// `Array<Array<string|null>>` — outer array is rows, inner array is
    /// cells in declaration order. SQL NULL becomes JS `null`; numbers
    /// and booleans are stringified.
    pub async fn query(&self, sql: String) -> Result<JsValue, JsValue> {
        let rows: Rc<RefCell<Vec<JsValue>>> = Rc::new(RefCell::new(Vec::new()));
        let rows_clone = Rc::clone(&rows);

        // wa-sqlite's exec callback signature: (rowValues: any[], colNames: string[]) => void
        let callback = Closure::<dyn FnMut(JsValue, JsValue)>::new(
            move |row_values: JsValue, _col_names: JsValue| {
                let row_array: &Array = row_values.unchecked_ref();
                let normalized = Array::new();
                for i in 0..row_array.length() {
                    let cell = row_array.get(i);
                    normalized.push(&normalize_cell(&cell));
                }
                rows_clone.borrow_mut().push(normalized.into());
            },
        );

        let cb_fn: &Function = callback.as_ref().unchecked_ref();
        let exec_result = self.api.exec(&self.db_handle, &sql, cb_fn.as_ref()).await;

        // Drop the closure now — wa-sqlite never calls it again. Keeping
        // it via .forget() would leak the JS-side ref permanently.
        drop(callback);

        exec_result.map_err(forge_error_jsvalue)?;

        // Move collected rows into a JS Array.
        let collected = rows
            .borrow()
            .iter()
            .fold(Array::new(), |acc, row| {
                acc.push(row);
                acc
            });
        Ok(collected.into())
    }

    /// Close the database explicitly. Idempotent — calling twice is a
    /// no-op.
    pub async fn close(&mut self) -> Result<(), JsValue> {
        if !self.closed {
            self.api
                .close(&self.db_handle)
                .await
                .map_err(forge_error_jsvalue)?;
            self.closed = true;
        }
        Ok(())
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/// Convert a SQL row cell (already a JsValue from wa-sqlite) into the
/// PoC-normalized form: `null` for SQL NULL, otherwise a string.
fn normalize_cell(cell: &JsValue) -> JsValue {
    if cell.is_null() || cell.is_undefined() {
        JsValue::NULL
    } else if cell.as_string().is_some() {
        cell.clone()
    } else if let Some(n) = cell.as_f64() {
        JsValue::from_str(&n.to_string())
    } else if let Some(b) = cell.as_bool() {
        JsValue::from_str(if b { "true" } else { "false" })
    } else {
        JsValue::from_str(&format!("{cell:?}"))
    }
}

/// Convert a `ForgeError` produced by Rust-side mapping back into a
/// `JsValue` for the JS-facing `Result` arm. Carries the
/// `ForgeError::WasmDatabase` message string through unchanged.
fn forge_error_jsvalue(value: JsValue) -> JsValue {
    let err = crate::error::js_value_into_forge_error(value);
    JsValue::from_str(&err.to_string())
}
