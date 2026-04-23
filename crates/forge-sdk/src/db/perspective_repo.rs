//! Repository layer for perspective reframings.
//!
//! Handles CRUD and query operations against the `perspectives` table.
//! Perspectives are derived from bullets and carry their own approval
//! lifecycle (draft -> in_review -> approved/rejected).

use forge_core::{
    CreatePerspectiveInput, ForgeError, Framing, Pagination, PaginationParams, Perspective,
    PerspectiveFilter, PerspectiveStatus, PerspectiveWithChain, UpdatePerspectiveInput,
};

/// Data-access repository for the `perspectives` table.
pub struct PerspectiveRepository;

impl PerspectiveRepository {
    /// Create a new `PerspectiveRepository`.
    pub fn new() -> Self {
        todo!()
    }

    // ── CRUD ────────────────────────────────────────────────────────

    /// Insert a new perspective row.
    ///
    /// The `bullet_content_snapshot` is typically auto-populated by the
    /// entity lifecycle manager's hook, but the repository accepts it
    /// from the input if provided.
    pub fn create(&self, input: &CreatePerspectiveInput) -> Result<Perspective, ForgeError> {
        todo!()
    }

    /// Fetch a perspective by primary key.
    ///
    /// Returns `Ok(None)` when no row matches the given id.
    pub fn get(&self, id: &str) -> Result<Option<Perspective>, ForgeError> {
        todo!()
    }

    /// Fetch a perspective with its full derivation chain:
    /// perspective -> bullet -> primary source.
    ///
    /// The primary source is resolved by walking `bullet_sources` for the
    /// row where `is_primary = true`. Returns an error with code
    /// `NOT_FOUND` if the chain is broken (missing bullet or no primary
    /// source link).
    pub fn get_with_chain(&self, id: &str) -> Result<Option<PerspectiveWithChain>, ForgeError> {
        todo!()
    }

    /// Partially update a perspective's column values.
    ///
    /// Only `content`, `target_archetype`, `domain`, and `framing` are
    /// updatable. Status transitions use `update_status` instead.
    pub fn update(
        &self,
        id: &str,
        input: &UpdatePerspectiveInput,
    ) -> Result<Perspective, ForgeError> {
        todo!()
    }

    /// Delete a perspective by id.
    ///
    /// Returns an error with code `CONFLICT` if the perspective is
    /// referenced by a resume entry (`resume_entries.perspective_id`
    /// uses RESTRICT).
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Status transitions ──────────────────────────────────────────

    /// Update a perspective's status and related audit fields.
    ///
    /// For `approved`: sets `approved_at`, `approved_by`, clears
    ///   `rejection_reason`.
    /// For `rejected`: sets `rejection_reason`, leaves approval fields
    ///   untouched.
    /// For other statuses: clears `rejection_reason`, leaves approval
    ///   fields untouched.
    pub fn update_status(
        &self,
        id: &str,
        status: PerspectiveStatus,
        rejection_reason: Option<&str>,
    ) -> Result<Perspective, ForgeError> {
        todo!()
    }

    // ── Queries ─────────────────────────────────────────────────────

    /// List perspectives with optional filtering and pagination.
    ///
    /// Filters:
    /// - `bullet_id`: exact match on the parent bullet.
    /// - `target_archetype`: exact match.
    /// - `domain`: exact match.
    /// - `framing`: exact match on framing enum value.
    /// - `status`: exact match on perspective status.
    /// - `source_id`: matches perspectives whose bullet is linked to the
    ///   given source via `bullet_sources`.
    /// - `search`: case-insensitive substring match on `content`
    ///   (applied in-memory after the database query).
    ///
    /// Results are ordered by `created_at DESC`.
    pub fn list(
        &self,
        filter: &PerspectiveFilter,
        pagination: &PaginationParams,
    ) -> Result<(Vec<Perspective>, i64), ForgeError> {
        todo!()
    }

    /// Count total perspectives matching the given filter.
    pub fn count(&self, filter: &PerspectiveFilter) -> Result<i64, ForgeError> {
        todo!()
    }

    /// Find all bullet IDs linked to a given source via `bullet_sources`.
    ///
    /// Used internally by `list` when filtering by `source_id`.
    pub fn find_bullet_ids_by_source(
        &self,
        source_id: &str,
    ) -> Result<Vec<String>, ForgeError> {
        todo!()
    }
}
