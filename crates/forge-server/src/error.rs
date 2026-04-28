//! Error handling — convert `ForgeError` into Axum HTTP responses.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use forge_core::ForgeError;
use serde::Serialize;

/// Wrapper that implements `IntoResponse` for `ForgeError`.
pub struct ApiError(pub ForgeError);

impl From<ForgeError> for ApiError {
    fn from(err: ForgeError) -> Self {
        Self(err)
    }
}

#[derive(Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: &'static str,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self.0 {
            ForgeError::NotFound { .. } => StatusCode::NOT_FOUND,
            ForgeError::Validation { .. } => StatusCode::BAD_REQUEST,
            ForgeError::Conflict { .. } => StatusCode::CONFLICT,
            ForgeError::ForeignKey { .. } => StatusCode::BAD_REQUEST,
            ForgeError::Database { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            // Mirrors the rusqlite-gated `Database` arm. Activated only
            // when `cargo build --workspace` unifies forge-wasm's `wasm`
            // feature into forge-core's compilation here. Same status as
            // Database since both surface a SQLite-level fault.
            #[cfg(feature = "wasm")]
            ForgeError::WasmDatabase(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ForgeError::Gone { .. } => StatusCode::GONE,
            ForgeError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = ErrorBody {
            error: ErrorDetail {
                code: self.0.code(),
                message: self.0.to_string(),
            },
        };

        (status, Json(body)).into_response()
    }
}
