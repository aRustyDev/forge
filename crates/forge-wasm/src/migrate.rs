//! WASM migration runner — applies the shared `forge_core::migrations::MIGRATIONS`
//! slice through wa-sqlite. Mirrors `forge_sdk::db::migrate::run_migrations`
//! semantics:
//!
//! - Each migration runs in its own transaction.
//! - Migrations containing `PRAGMA foreign_keys = OFF` get the pragma
//!   set outside the transaction (SQLite ignores it inside BEGIN/COMMIT).
//! - Applied state persists in a `_migrations(name TEXT PRIMARY KEY)` table.

use forge_core::ForgeError;
use forge_core::migrations::MIGRATIONS;

use crate::database::{Database, StepResult};

/// Apply all pending migrations. Returns the count of newly-applied entries.
///
/// We do NOT pre-create the `_migrations` table — migration `001_initial.sql`
/// creates it itself (without `IF NOT EXISTS`). Pre-creating would conflict.
/// `get_applied` probes `sqlite_master` and returns an empty Vec when the
/// table doesn't exist yet, exactly mirroring forge-sdk's rusqlite runner.
pub async fn run_migrations(db: &Database) -> Result<usize, ForgeError> {
    let applied = get_applied(db).await?;
    let mut count = 0;

    for &(name, sql) in MIGRATIONS {
        if applied.iter().any(|n| n == name) {
            continue;
        }

        let needs_fk_off = sql.contains("PRAGMA foreign_keys = OFF");
        if needs_fk_off {
            db.exec_batch_internal("PRAGMA foreign_keys = OFF").await?;
        }

        db.exec_batch_internal("BEGIN").await?;
        let apply = async {
            db.exec_batch_internal(sql).await?;
            // Insert via prepared statement to bind the migration name safely.
            let stmt = db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?1)").await?;
            stmt.bind_text(1, name)?;
            match stmt.step().await? {
                StepResult::Done | StepResult::Row => {}
            }
            stmt.finalize().await?;
            Ok::<(), ForgeError>(())
        };

        match apply.await {
            Ok(()) => {
                db.exec_batch_internal("COMMIT").await?;
            }
            Err(e) => {
                let _ = db.exec_batch_internal("ROLLBACK").await;
                if needs_fk_off {
                    let _ = db.exec_batch_internal("PRAGMA foreign_keys = ON").await;
                }
                return Err(e);
            }
        }

        if needs_fk_off {
            db.exec_batch_internal("PRAGMA foreign_keys = ON").await?;
        }
        count += 1;
    }

    Ok(count)
}

/// Read applied migration names from `_migrations`. Returns an empty Vec
/// when the table doesn't exist yet (i.e. nothing has run — `001_initial`
/// will create the table on first run).
async fn get_applied(db: &Database) -> Result<Vec<String>, ForgeError> {
    // Probe sqlite_master rather than relying on a CREATE-if-not-exists,
    // because `001_initial.sql` itself creates `_migrations` without
    // `IF NOT EXISTS` and would conflict with any pre-creation.
    let probe = db.prepare(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations')",
    ).await?;
    let exists = match probe.step().await? {
        StepResult::Row => probe.column_int(0).map(|n| n != 0).unwrap_or(false),
        StepResult::Done => false,
    };
    probe.finalize().await?;

    if !exists {
        return Ok(Vec::new());
    }

    let stmt = db.prepare("SELECT name FROM _migrations").await?;
    let mut names = Vec::new();
    loop {
        match stmt.step().await? {
            StepResult::Row => {
                if let Some(name) = stmt.column_text(0) {
                    names.push(name);
                }
            }
            StepResult::Done => break,
        }
    }
    stmt.finalize().await?;
    Ok(names)
}
