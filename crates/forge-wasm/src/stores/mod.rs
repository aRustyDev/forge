//! Browser-side data-access stores. Mirror the interfaces of
//! `forge-sdk::db::stores::*` but implemented over `&Database` (wa-sqlite)
//! instead of `&Connection` (rusqlite). Purely additive — see the spec
//! at `.claude/plans/forge-resume-builder/refs/specs/2026-04-28-browserstore-adapter-vertical-slice.md`.

pub mod skill;

pub use skill::SkillStore;
