//! WaSqliteAdapter — a.k.a. BrowserStore. Owns a wa-sqlite-backed
//! Database, runs migrations on open, exposes `&Database` to stores.
//!
//! No trait abstraction. The rusqlite stores in forge-sdk stay
//! unchanged; this is purely additive for the wasm32 target.

use forge_core::ForgeError;

use crate::database::Database;
use crate::migrate::run_migrations;

/// The browser-side data layer entry point. Construct via `open()`.
pub struct WaSqliteAdapter {
    db: Database,
}

impl WaSqliteAdapter {
    /// Open (or create) the IDB-backed database, run all pending
    /// migrations, return the adapter ready for store use.
    pub async fn open(filename: &str) -> Result<Self, ForgeError> {
        let db = Database::open(filename).await?;
        let _applied = run_migrations(&db).await?;
        Ok(Self { db })
    }

    /// Borrow the underlying Database. Stores call this to issue queries.
    pub fn db(&self) -> &Database {
        &self.db
    }
}
