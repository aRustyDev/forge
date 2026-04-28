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
pub async fn run_migrations(db: &Database) -> Result<usize, ForgeError> {
    ensure_migrations_table(db).await?;
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

/// Ensure the `_migrations` table exists. Idempotent.
async fn ensure_migrations_table(db: &Database) -> Result<(), ForgeError> {
    db.exec_batch_internal(
        "CREATE TABLE IF NOT EXISTS _migrations (\
            name TEXT PRIMARY KEY, \
            applied_at TEXT DEFAULT (datetime('now'))\
         )",
    ).await
}

/// Read applied migration names from `_migrations`.
async fn get_applied(db: &Database) -> Result<Vec<String>, ForgeError> {
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
