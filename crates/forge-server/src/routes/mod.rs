//! Route modules and top-level router construction.

pub mod bullets;
pub mod contacts;
pub mod health;
pub mod job_descriptions;
pub mod notes;
pub mod organizations;
pub mod perspectives;
pub mod profile;
pub mod resumes;
pub mod skills;
pub mod sources;
pub mod summaries;

use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use axum::Router;
use serde_json::json;

use crate::state::SharedState;

/// Build the full API router. All routes are nested under `/api`.
pub fn api_router() -> Router<SharedState> {
    let api = Router::new()
        .route("/health", axum::routing::get(health::health))
        .merge(sources::router())
        .merge(bullets::router())
        .merge(perspectives::router())
        .merge(organizations::router())
        .merge(skills::router())
        .merge(profile::router())
        .merge(notes::router())
        .merge(resumes::router())
        .merge(summaries::router())
        .merge(contacts::router())
        .merge(job_descriptions::router());

    Router::new()
        .nest("/api", api)
        .fallback(fallback)
}

async fn fallback(
    method: axum::http::Method,
    uri: axum::http::Uri,
) -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(json!({
            "error": {
                "code": "NOT_FOUND",
                "message": format!("Route not found: {method} {uri}")
            }
        })),
    )
}
