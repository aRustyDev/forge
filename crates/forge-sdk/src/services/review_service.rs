//! Review service — review queue for pending bullets and perspectives.
//!
//! Returns counts and items in `in_review` status with relevant context
//! (source title, bullet content, linked skills/technologies).
//!
//! TS source: `packages/core/src/services/review-service.ts`

use forge_core::{ForgeError, ReviewQueue};

/// Review queue operations: list bullets and perspectives awaiting
/// human review, with hydrated context for the review UI.
pub struct ReviewService {
    // ELM / repository handle will be injected here
}

impl ReviewService {
    /// Create a new ReviewService instance.
    pub fn new() -> Self {
        todo!()
    }

    /// Get all pending review items (bullets and perspectives with
    /// `status = 'in_review'`).
    ///
    /// For each bullet, hydrates:
    /// - Primary source title (via `bullet_sources` junction)
    /// - Linked technologies/skills (via `bullet_skills` junction)
    ///
    /// For each perspective, hydrates:
    /// - Bullet content (via `bullet_id`)
    /// - Primary source title (via bullet -> `bullet_sources` junction)
    ///
    /// Results are ordered by `created_at DESC` within each category.
    pub fn get_pending_review(&self) -> Result<ReviewQueue, ForgeError> {
        todo!()
    }
}
