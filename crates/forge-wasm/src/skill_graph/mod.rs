//! Skill graph runtime — petgraph + nearest-neighbor index loaded from a
//! [`SkillGraphSnapshot`] (forge-afyg).
//!
//! This module is the WASM-side parallel implementation of
//! [`forge_core::types::skill_graph::SkillGraphTraversal`]; the SQL-backed
//! impl lives in `forge-sdk`. Both impls live side by side — this crate does
//! not refactor the SQL one.
//!
//! ## Construction
//!
//! Callers hand a `&[u8]` snapshot to [`SkillGraphRuntime::from_snapshot`].
//! No I/O, no network — the runtime owns all parsed structures in memory.
//!
//! ## Nearest-neighbor seam
//!
//! Vector search is hidden behind the private [`hnsw::HnswIndex`] seam so the
//! backing implementation can be swapped once the long-term library choice is
//! settled (hnsw_rs vs instant-distance vs usearch). The current backing is a
//! brute-force linear-scan stub — see [`hnsw`] for rationale and limitations.
//!
//! [`SkillGraphSnapshot`]: forge_core::types::skill_graph::SkillGraphSnapshot

mod hnsw;
mod runtime;

pub use runtime::SkillGraphRuntime;
