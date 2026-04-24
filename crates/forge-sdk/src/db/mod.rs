//! Data access layer — stores and database backends.

pub mod backends;
pub mod migrate;
pub mod stores;

// Re-export store types for convenience (preserves existing import paths)
pub use stores::*;
