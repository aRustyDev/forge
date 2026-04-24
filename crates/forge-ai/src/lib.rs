//! LLM prompts, response validation, and text analysis for Forge.
//!
//! This crate handles prompt construction, AI response validation, and
//! JD parsing. It does NOT call LLM APIs — Forge uses a split-handshake
//! model where the MCP client invokes the LLM.

pub mod jd_parser;
pub mod prompts;
pub mod validators;
