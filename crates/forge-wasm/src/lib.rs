//! Forge browser-side data layer.
//!
//! This crate is the bottom box of the browser-first architecture: a Rust
//! library compiled to WebAssembly that consumes [`forge_core`] types and
//! exposes a coarse-grained API to JavaScript via [`wasm_bindgen`]. It is
//! built once and consumed by every UI generation — Svelte today, Tauri at
//! R2, Dioxus at R4.
//!
//! ## Architectural rules
//!
//! - `forge-server` MUST NOT depend on this crate. The workspace omits
//!   `forge-wasm` from `[workspace.dependencies]` as a passive guard.
//! - This crate consumes `forge-core` with `default-features = false`. That
//!   drops the rusqlite-bound `Database` variant of `ForgeError`, letting
//!   the whole tree compile to `wasm32-unknown-unknown` without bundling a
//!   C SQLite library.
//! - The wasm-bindgen API surface is **coarse-grained**: each export does
//!   substantial work and returns a complete result. No chatty per-field
//!   calls across the JS↔WASM boundary.
//!
//! ## Current scope (forge-f0gc → forge-nst6)
//!
//! - Crate scaffold + buildable WASM artifact (forge-f0gc).
//! - wa-sqlite OPFS binding + [`Database`] round-trip API (forge-nst6).
//!
//! [`ForgeRuntime::open_database`] returns a JS Promise that resolves to a
//! `Database` handle backed by `OPFSAnyContextVFS` (the main-thread
//! compatible async OPFS VFS — see forge-73hi for the AccessHandlePool /
//! Worker upgrade trigger). Substantial higher-level APIs (extraction,
//! alignment, sync) land in their sibling sub-tasks (forge-jsxn,
//! forge-62kb, forge-8rzs).
//!
//! ## Deferred
//!
//! - Headless-Chrome wasm-pack test harness — forge-901c.
//! - BrowserStore adapter that consumes [`Database`] — forge-lu5s.
//! - Svelte integration (lives in `forge-5x2h`).

use wasm_bindgen::prelude::*;

pub mod database;
pub mod error;
pub mod wa_sqlite;

pub use database::Database;

/// Format version of the WASM bundle. Bumped on any breaking change to the
/// JS-facing API. Read from JS via `ForgeRuntime.version` / `BUNDLE_VERSION`.
pub const BUNDLE_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Install a panic hook that forwards Rust panics to the browser console.
/// Idempotent — safe to call multiple times.
#[wasm_bindgen(start)]
pub fn _wasm_init() {
    console_error_panic_hook::set_once();
}

/// Sanity-check export. Used by the FFI smoke test to confirm the JS↔WASM
/// boundary is working before the substantial APIs land.
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// Bundle version exposed to JS as a free function (in addition to
/// `ForgeRuntime.version`).
#[wasm_bindgen(js_name = bundleVersion)]
pub fn bundle_version() -> String {
    BUNDLE_VERSION.to_string()
}

/// Forge browser-side runtime — the JS-facing handle to the data layer.
///
/// Construction is a two-step process so the JS side can choose async-init
/// patterns once wa-sqlite is wired up:
///
/// 1. `new ForgeRuntime()` — synchronous, cheap.
/// 2. `runtime.init(config)` — async (when DB binding lands), idempotent.
///
/// Substantial methods (`extract_skills`, `align_resume`, `query`, etc.) are
/// added by sibling forge-6z5l sub-tasks.
#[wasm_bindgen]
pub struct ForgeRuntime {
    initialized: bool,
}

#[wasm_bindgen]
impl ForgeRuntime {
    /// Construct a new uninitialized runtime. Cheap, no I/O.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { initialized: false }
    }

    /// Initialize the runtime. Currently a no-op placeholder; the wa-sqlite
    /// connection + snapshot loading happen here once their sub-tasks land.
    /// Idempotent — re-calling `init` after success is a no-op.
    pub fn init(&mut self, _config: JsValue) -> Result<(), JsValue> {
        if self.initialized {
            return Ok(());
        }
        // Real init body lives in the wa-sqlite binding successor task.
        self.initialized = true;
        Ok(())
    }

    /// Whether `init` has been called successfully.
    #[wasm_bindgen(getter)]
    pub fn ready(&self) -> bool {
        self.initialized
    }

    /// Bundle version. Read after construction.
    #[wasm_bindgen(getter)]
    pub fn version(&self) -> String {
        BUNDLE_VERSION.to_string()
    }

    /// Open (or create) an OPFS-backed SQLite database at the given path.
    ///
    /// Returns a JS Promise that resolves to an opaque `Database` handle.
    /// The path is the wa-sqlite filename — typically a bare name like
    /// `"forge.db"`; OPFS treats it as a key in the origin's private
    /// directory. Subsequent calls with the same path return a fresh
    /// handle to the same persisted bytes.
    ///
    /// On the JS side this is the entry point for the forge-nst6
    /// proof-of-concept harness:
    ///
    /// ```js
    /// const rt = new ForgeRuntime();
    /// const db = await rt.openDatabase('forge.db');
    /// await db.exec('CREATE TABLE IF NOT EXISTS t (k TEXT, v INTEGER)');
    /// await db.exec("INSERT INTO t VALUES ('answer', 42)");
    /// const rows = await db.query('SELECT * FROM t');
    /// ```
    #[wasm_bindgen(js_name = openDatabase)]
    pub async fn open_database(&self, path: String) -> Result<Database, JsValue> {
        Database::open(&path)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

impl Default for ForgeRuntime {
    fn default() -> Self {
        Self::new()
    }
}

// ────────────────────────────────────────────────────────────────────────
// Native (cargo test) sanity tests. WASM-target tests live in tests/ and
// are gated behind the wasm-bindgen-test runner once the headless-Chrome
// harness lands (successor task).
// ────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_sanity() {
        assert_eq!(add(2, 3), 5);
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn bundle_version_matches_cargo_pkg() {
        assert_eq!(bundle_version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn runtime_starts_uninitialized_then_initializes() {
        let mut rt = ForgeRuntime::new();
        assert!(!rt.ready(), "freshly constructed runtime must not be ready");
        rt.init(JsValue::NULL).unwrap();
        assert!(rt.ready(), "after init, runtime must be ready");

        // Idempotent.
        rt.init(JsValue::NULL).unwrap();
        assert!(rt.ready());
    }

    #[test]
    fn runtime_reports_bundle_version() {
        let rt = ForgeRuntime::new();
        assert_eq!(rt.version(), env!("CARGO_PKG_VERSION"));
    }
}
