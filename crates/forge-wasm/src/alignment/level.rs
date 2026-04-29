//! Stub — full impl lands in Task 3.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum SkillLevel {
    Junior,
    Mid,
    Senior,
    Staff,
    Principal,
}
