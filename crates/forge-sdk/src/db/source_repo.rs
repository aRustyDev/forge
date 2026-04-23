//! Repository layer for source experience entries.
//!
//! Handles CRUD and query operations against the `sources` table and its
//! polymorphic extension tables (`source_roles`, `source_projects`,
//! `source_education`, `source_presentations`).

use forge_core::{
    CreateSource, ForgeError, PaginationParams, Source, SourceEducation, SourceExtension,
    SourceFilter, SourcePresentation, SourceProject, SourceRole, SourceType,
    SourceWithExtension, UpdateSource,
};

/// Data-access repository for the `sources` table and extension tables.
pub struct SourceRepository;

impl SourceRepository {
    /// Create a new `SourceRepository`.
    pub fn new() -> Self {
        todo!()
    }

    // ── CRUD ────────────────────────────────────────────────────────

    /// Insert a new source row and its type-specific extension row.
    ///
    /// The `source_type` field on `input` determines which extension table
    /// receives a companion row. A `source_type` of `general` produces no
    /// extension row.
    pub fn create(&self, input: &CreateSource) -> Result<SourceWithExtension, ForgeError> {
        todo!()
    }

    /// Fetch a source by primary key, hydrated with its extension data.
    ///
    /// Returns `Ok(None)` when no row matches the given id.
    pub fn get(&self, id: &str) -> Result<Option<SourceWithExtension>, ForgeError> {
        todo!()
    }

    /// Partially update a source's base row and/or its extension row.
    ///
    /// `source_type` is immutable after creation; the repository uses the
    /// existing row's type to route the extension update.
    pub fn update(
        &self,
        id: &str,
        input: &UpdateSource,
    ) -> Result<SourceWithExtension, ForgeError> {
        todo!()
    }

    /// Delete a source and its extension row.
    ///
    /// Extension rows and `bullet_sources` junction rows CASCADE on delete.
    /// Returns an error with code `CONFLICT` if deletion is blocked by a
    /// foreign-key constraint (e.g., referenced bullets under RESTRICT).
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Queries ─────────────────────────────────────────────────────

    /// List sources with optional filtering and pagination.
    ///
    /// Filters:
    /// - `source_type`: exact match on the type discriminator.
    /// - `organization_id`: matches sources linked via `source_roles` OR
    ///   `source_projects` extension tables (union of both).
    /// - `status`: exact match on source status.
    /// - `education_type`: matches sources linked via `source_education`.
    /// - `search`: case-insensitive substring match on title or description
    ///   (applied in-memory after the database query).
    ///
    /// Results are ordered by `created_at DESC`.
    pub fn list(
        &self,
        filter: &SourceFilter,
        pagination: &PaginationParams,
    ) -> Result<(Vec<SourceWithExtension>, i64), ForgeError> {
        todo!()
    }

    // ── Extension helpers ───────────────────────────────────────────

    /// Fetch the extension row for a source, given its type.
    ///
    /// Returns `None` for `SourceType::General` (no extension table).
    pub fn get_extension(
        &self,
        source_id: &str,
        source_type: SourceType,
    ) -> Result<Option<SourceExtension>, ForgeError> {
        todo!()
    }

    /// Fetch the role extension for a source.
    pub fn get_role_extension(
        &self,
        source_id: &str,
    ) -> Result<Option<SourceRole>, ForgeError> {
        todo!()
    }

    /// Fetch the project extension for a source.
    pub fn get_project_extension(
        &self,
        source_id: &str,
    ) -> Result<Option<SourceProject>, ForgeError> {
        todo!()
    }

    /// Fetch the education extension for a source.
    pub fn get_education_extension(
        &self,
        source_id: &str,
    ) -> Result<Option<SourceEducation>, ForgeError> {
        todo!()
    }

    /// Fetch the presentation extension for a source.
    pub fn get_presentation_extension(
        &self,
        source_id: &str,
    ) -> Result<Option<SourcePresentation>, ForgeError> {
        todo!()
    }

    /// List all source IDs linked to a given organization through either
    /// `source_roles` or `source_projects`.
    pub fn find_ids_by_organization(
        &self,
        organization_id: &str,
    ) -> Result<Vec<String>, ForgeError> {
        todo!()
    }

    /// List all source IDs with a given education type.
    pub fn find_ids_by_education_type(
        &self,
        education_type: &str,
    ) -> Result<Vec<String>, ForgeError> {
        todo!()
    }

    /// Count total sources matching the given filter (for pagination).
    pub fn count(&self, filter: &SourceFilter) -> Result<i64, ForgeError> {
        todo!()
    }
}
