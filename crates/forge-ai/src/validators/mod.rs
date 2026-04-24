//! Response validation for AI-generated outputs.

pub mod bullet;
pub mod perspective;
pub mod skill_extraction;

use serde::Serialize;

/// Non-fatal issue found during validation.
#[derive(Debug, Clone, Serialize)]
pub struct Warning {
    pub field: String,
    pub message: String,
}

/// Successful validation — data plus any warnings.
#[derive(Debug)]
pub struct ValidatedResponse<T> {
    pub data: T,
    pub warnings: Vec<Warning>,
}

/// Validation outcome.
pub type ValidationResult<T> = Result<ValidatedResponse<T>, ValidationError>;

/// Validation failure.
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("invalid JSON: {0}")]
    InvalidJson(String),
    #[error("{field}: {message}")]
    Schema { field: String, message: String },
}

/// Helper: collect extra keys from a JSON object not in `known`.
pub(crate) fn extra_fields(
    obj: &serde_json::Map<String, serde_json::Value>,
    known: &[&str],
) -> Vec<String> {
    obj.keys()
        .filter(|k| !known.contains(&k.as_str()))
        .cloned()
        .collect()
}
