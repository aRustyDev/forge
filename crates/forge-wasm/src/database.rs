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
//! - [`Database::exec_batch`] — JS-facing fire-and-forget DDL/DML/SELECT-
//!   without-capture. Multi-statement batch path. (`exec` is kept as a
//!   deprecated alias for the forge-nst6 harness.)
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
//! (`column_int`, parameterized binding, etc.) is available via the
//! `Statement` API added in forge-lu5s.

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
    api: std::rc::Rc<SqliteApi>,
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
            api: std::rc::Rc::new(api),
            db_handle,
            closed: false,
        })
    }
}

// ── JS-facing API ────────────────────────────────────────────────────────

#[wasm_bindgen]
impl Database {
    /// Execute SQL that doesn't capture rows (DDL, DML, DDL+DML scripts).
    /// Multi-statement: semicolons split; all run in order. No parameters.
    /// For parameterized queries, use `prepare` + `Statement::bind_*` + `step`.
    #[wasm_bindgen(js_name = "execBatch")]
    pub async fn exec_batch(&self, sql: String) -> Result<(), JsValue> {
        self.api
            .exec(&self.db_handle, &sql, &JsValue::UNDEFINED)
            .await
            .map_err(forge_error_jsvalue)?;
        Ok(())
    }

    /// Deprecated alias for `exec_batch`. Kept temporarily so the
    /// browser-smoke harness from forge-nst6 doesn't break.
    /// Remove after the harness is updated (Task 8).
    pub async fn exec(&self, sql: String) -> Result<(), JsValue> {
        self.exec_batch(sql).await
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

// ── Rust-only: Statement wrapper ─────────────────────────────────────────

/// Result of a `Statement::step()` call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepResult {
    /// A row is available; call `column_*` to read it.
    Row,
    /// Iteration complete; subsequent `step` calls return Done.
    Done,
}

/// Prepared-statement handle. Created via `Database::prepare`. Caller MUST
/// call `finalize().await` explicitly — Drop cannot await the async cleanup
/// and only logs a warning if skipped. Holds an `Rc<SqliteApi>` so the
/// statement can outlive the Database that created it (rarely useful, but
/// avoids fighting the borrow checker for short-lived async sequences).
pub struct Statement {
    api: std::rc::Rc<SqliteApi>,
    stmt: JsValue,
    finalized: bool,
}

impl Database {
    /// Prepare a SQL statement. Returns a single-statement handle — if
    /// `sql` contains multiple semicolon-separated statements, only the
    /// first is prepared and the remainder is silently discarded. Use
    /// `exec_batch` for migrations / DDL scripts.
    pub async fn prepare(&self, sql: &str) -> Result<Statement, ForgeError> {
        let result = self.api.prepare_v2(&self.db_handle, sql).await.map_jsvalue_err()?;
        // wa-sqlite returns `{stmt: handle, sql: remainder}`. Pluck `stmt`.
        let stmt = js_sys::Reflect::get(&result, &JsValue::from_str("stmt"))
            .map_jsvalue_err()?;
        if stmt.is_null() || stmt.is_undefined() {
            return Err(ForgeError::WasmDatabase(
                format!("prepare_v2 returned no statement for SQL: {sql}"),
            ));
        }
        Ok(Statement { api: std::rc::Rc::clone(&self.api), stmt, finalized: false })
    }
}

impl Statement {
    /// Bind a TEXT parameter. `idx` is 1-based per SQLite convention.
    pub fn bind_text(&self, idx: i32, value: &str) -> Result<(), ForgeError> {
        self.api.bind_text(&self.stmt, idx, value).map_jsvalue_err()?;
        Ok(())
    }

    /// Bind an INTEGER parameter. Note: f64 widening — see wa_sqlite.rs notes.
    pub fn bind_int64(&self, idx: i32, value: i64) -> Result<(), ForgeError> {
        self.api.bind_int64(&self.stmt, idx, value as f64).map_jsvalue_err()?;
        Ok(())
    }

    /// Bind a FLOAT parameter.
    pub fn bind_double(&self, idx: i32, value: f64) -> Result<(), ForgeError> {
        self.api.bind_double(&self.stmt, idx, value).map_jsvalue_err()?;
        Ok(())
    }

    /// Bind a BLOB parameter.
    pub fn bind_blob(&self, idx: i32, value: &[u8]) -> Result<(), ForgeError> {
        self.api.bind_blob(&self.stmt, idx, value).map_jsvalue_err()?;
        Ok(())
    }

    /// Bind a NULL parameter.
    pub fn bind_null(&self, idx: i32) -> Result<(), ForgeError> {
        self.api.bind_null(&self.stmt, idx).map_jsvalue_err()?;
        Ok(())
    }

    /// Convenience: bind `Option<&str>` — None becomes NULL.
    pub fn bind_text_opt(&self, idx: i32, value: Option<&str>) -> Result<(), ForgeError> {
        match value {
            Some(s) => self.bind_text(idx, s),
            None => self.bind_null(idx),
        }
    }

    /// Advance the statement. Returns Row when a row is available, Done at end.
    pub async fn step(&self) -> Result<StepResult, ForgeError> {
        let code = self.api.step(&self.stmt).await.map_jsvalue_err()?;
        let code_i32 = code.as_f64().unwrap_or(-1.0) as i32;
        match code_i32 {
            crate::wa_sqlite::SQLITE_ROW => Ok(StepResult::Row),
            crate::wa_sqlite::SQLITE_DONE => Ok(StepResult::Done),
            other => Err(ForgeError::WasmDatabase(
                format!("step returned unexpected code: {other}"),
            )),
        }
    }

    /// Number of columns in the current row.
    pub fn column_count(&self) -> i32 {
        self.api.column_count(&self.stmt)
    }

    /// SQLite type code for a column in the current row.
    pub fn column_type(&self, idx: i32) -> i32 {
        self.api.column_type(&self.stmt, idx)
    }

    /// Read a TEXT column. Returns None for NULL.
    pub fn column_text(&self, idx: i32) -> Option<String> {
        if self.column_type(idx) == crate::wa_sqlite::SQLITE_NULL {
            return None;
        }
        Some(self.api.column_text(&self.stmt, idx))
    }

    /// Read an INTEGER column. Returns None for NULL.
    pub fn column_int(&self, idx: i32) -> Option<i32> {
        if self.column_type(idx) == crate::wa_sqlite::SQLITE_NULL {
            return None;
        }
        Some(self.api.column_int(&self.stmt, idx))
    }

    /// Read a FLOAT column. Returns None for NULL.
    pub fn column_double(&self, idx: i32) -> Option<f64> {
        if self.column_type(idx) == crate::wa_sqlite::SQLITE_NULL {
            return None;
        }
        Some(self.api.column_double(&self.stmt, idx))
    }

    /// Read a BLOB column. Returns an empty `Vec` for both NULL **and** a
    /// genuinely empty blob — these are indistinguishable here. The
    /// asymmetry vs. `column_text/int/double` (which return `Option<T>`) is
    /// deliberate: every BLOB column in the in-scope migrations (`vector`
    /// in 025_embeddings, etc.) is `NOT NULL`, so the distinction is moot.
    /// Use `column_blob_opt` when you need to disambiguate NULL from empty.
    pub fn column_blob(&self, idx: i32) -> Vec<u8> {
        self.api.column_blob(&self.stmt, idx)
    }

    /// Read a BLOB column with explicit NULL handling. Returns `None` for
    /// SQL NULL, `Some(Vec)` for any other value (including an empty BLOB).
    pub fn column_blob_opt(&self, idx: i32) -> Option<Vec<u8>> {
        if self.column_type(idx) == crate::wa_sqlite::SQLITE_NULL {
            return None;
        }
        Some(self.api.column_blob(&self.stmt, idx))
    }

    /// Reset the statement so it can be re-bound and re-stepped.
    pub async fn reset(&self) -> Result<(), ForgeError> {
        self.api.reset(&self.stmt).await.map_jsvalue_err()?;
        Ok(())
    }

    /// Finalize the underlying statement. Idempotent. Called by Drop.
    pub async fn finalize(mut self) -> Result<(), ForgeError> {
        if !self.finalized {
            self.api.finalize(&self.stmt).await.map_jsvalue_err()?;
            self.finalized = true;
        }
        Ok(())
    }
}

impl Drop for Statement {
    fn drop(&mut self) {
        if !self.finalized {
            web_sys::console::warn_1(&JsValue::from_str(
                "forge-wasm: Statement dropped without explicit finalize() — \
                 prefer s.finalize().await for deterministic cleanup",
            ));
        }
    }
}

// ── Rust-only: Transaction guard ─────────────────────────────────────────

/// Async transaction guard. Begin via `Database::transaction()`. Caller
/// MUST explicitly call `commit()` or `rollback()` — failure to do so
/// before drop logs (rollback is best-effort impossible since Drop is
/// sync; wa-sqlite needs async). Use the `with_transaction` helper to
/// avoid the discipline burden.
pub struct Transaction<'a> {
    db: &'a Database,
    finished: bool,
}

impl<'a> Transaction<'a> {
    pub async fn commit(mut self) -> Result<(), ForgeError> {
        self.db.exec_batch_internal("COMMIT").await?;
        self.finished = true;
        Ok(())
    }

    pub async fn rollback(mut self) -> Result<(), ForgeError> {
        self.db.exec_batch_internal("ROLLBACK").await?;
        self.finished = true;
        Ok(())
    }
}

impl<'a> Drop for Transaction<'a> {
    fn drop(&mut self) {
        if !self.finished {
            web_sys::console::error_1(&JsValue::from_str(
                "forge-wasm: Transaction dropped without commit() or rollback() — \
                 the underlying wa-sqlite session is still in BEGIN. Use \
                 Database::with_transaction to avoid this.",
            ));
        }
    }
}

impl Database {
    /// Begin a transaction. Caller MUST call `commit()` or `rollback()`.
    /// Prefer `with_transaction` which handles both paths.
    pub async fn transaction(&self) -> Result<Transaction<'_>, ForgeError> {
        self.exec_batch_internal("BEGIN").await?;
        Ok(Transaction { db: self, finished: false })
    }

    /// Run an async closure inside a transaction. Commits on Ok, rolls
    /// back on Err. The closure receives `&Database` (NOT the Transaction
    /// guard) — all SQL goes through Database methods directly, the
    /// guard is implicit.
    ///
    /// The explicit `'a` lifetime is required: the closure's returned
    /// future will, in practice, borrow the `&Database` it received to
    /// call methods on it. Without `Fut: ... + 'a` the borrow checker
    /// rejects realistic call sites.
    pub async fn with_transaction<'a, F, Fut, T>(&'a self, f: F) -> Result<T, ForgeError>
    where
        F: FnOnce(&'a Database) -> Fut,
        Fut: std::future::Future<Output = Result<T, ForgeError>> + 'a,
    {
        self.exec_batch_internal("BEGIN").await?;
        match f(self).await {
            Ok(value) => {
                self.exec_batch_internal("COMMIT").await?;
                Ok(value)
            }
            Err(e) => {
                // Best-effort rollback; surface the original error even if rollback fails.
                let _ = self.exec_batch_internal("ROLLBACK").await;
                Err(e)
            }
        }
    }

    /// Internal exec that returns ForgeError instead of JsValue.
    /// Used by transaction primitives and the migration runner.
    pub(crate) async fn exec_batch_internal(&self, sql: &str) -> Result<(), ForgeError> {
        self.api
            .exec(&self.db_handle, sql, &JsValue::UNDEFINED)
            .await
            .map_jsvalue_err()?;
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
