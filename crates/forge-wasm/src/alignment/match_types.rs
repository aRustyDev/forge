//! Stub — full impl lands in Tasks 7-11.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum MatchType {
    Direct,
    Alias,
    Cert,
    Child,
    Parent,
    Sibling,
    Embedding,
    CoOccurrence,
}
