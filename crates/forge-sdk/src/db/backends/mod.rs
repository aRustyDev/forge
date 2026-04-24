//! Database backend implementations.
//!
//! Currently only SQLite (via rusqlite). Future backends: Turso/libSQL, HelixDB.
//! The trait abstraction will be added after the DB strategy decision (forge-58ht).

pub mod sqlite;
