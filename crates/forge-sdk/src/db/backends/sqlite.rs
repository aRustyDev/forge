//! SQLite backend via rusqlite.
//!
//! Re-exports the connection type used by all stores. When the backend
//! trait is introduced, this module will implement it.

pub use rusqlite::Connection;
