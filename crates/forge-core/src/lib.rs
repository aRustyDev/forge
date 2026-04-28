//! Core types, enums, and shapes for Forge.
//!
//! This crate defines the shared data model and compile-time data used across
//! all Forge crates: types, enums, serialization derives, and the embedded SQL
//! migration manifest. It contains no runtime I/O and no business logic —
//! making it the natural shared dependency for both native consumers
//! (forge-sdk → rusqlite) and WASM consumers (forge-wasm → wa-sqlite).
//!
//! TS source: `packages/core/src/types/index.ts`

pub mod migrations;
pub mod types;
pub mod util;

pub use migrations::MIGRATIONS;
pub use types::*;
pub use util::{new_id, now_iso};
