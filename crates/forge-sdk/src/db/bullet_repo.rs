//! Repository layer for bullet points.
//!
//! Handles CRUD and query operations against the `bullets` table and its
//! junction tables (`bullet_sources`, `bullet_skills`).

use forge_core::{
    Bullet, BulletFilter, BulletSource, BulletStatus, ForgeError, PaginationParams,
    UpdateBulletInput,
};

/// Input for creating a new bullet at the repository level.
pub struct CreateBulletRow {
    pub content: String,
    pub source_content_snapshot: String,
    pub metrics: Option<String>,
    pub domain: Option<String>,
    pub status: BulletStatus,
}

/// Data-access repository for the `bullets` table and junction tables.
pub struct BulletRepository;

impl BulletRepository {
    /// Create a new `BulletRepository`.
    pub fn new() -> Self {
        todo!()
    }

    // ── CRUD ────────────────────────────────────────────────────────

    /// Insert a new bullet row and return the hydrated `Bullet` (with
    /// an empty `technologies` vec until junctions are inserted).
    pub fn create(&self, input: &CreateBulletRow) -> Result<Bullet, ForgeError> {
        todo!()
    }

    /// Fetch a bullet by primary key, hydrated with its `technologies`.
    ///
    /// Technologies are derived from the `bullet_skills` junction:
    /// skill names are lowercased, trimmed, and sorted alphabetically.
    ///
    /// Returns `Ok(None)` when no row matches the given id.
    pub fn get(&self, id: &str) -> Result<Option<Bullet>, ForgeError> {
        todo!()
    }

    /// Partially update a bullet's column values (content, metrics, domain).
    ///
    /// Does NOT touch junction tables — use `replace_technologies` for that.
    pub fn update(&self, id: &str, input: &UpdateBulletInput) -> Result<Bullet, ForgeError> {
        todo!()
    }

    /// Delete a bullet by id.
    ///
    /// Junction rows in `bullet_sources` and `bullet_skills` CASCADE.
    /// Returns an error with code `CONFLICT` if the bullet is referenced
    /// by perspectives (RESTRICT on `perspectives.bullet_id`).
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Status transitions ──────────────────────────────────────────

    /// Update a bullet's status column and related fields.
    ///
    /// For `approved`: sets `approved_at` and `approved_by`.
    /// For `rejected`: sets `rejection_reason`.
    /// For other statuses: clears `rejection_reason`.
    pub fn update_status(
        &self,
        id: &str,
        status: BulletStatus,
        rejection_reason: Option<&str>,
    ) -> Result<Bullet, ForgeError> {
        todo!()
    }

    // ── Queries ─────────────────────────────────────────────────────

    /// List bullets with optional filtering and pagination.
    ///
    /// Filters:
    /// - `source_id`: matches bullets linked via `bullet_sources` junction.
    /// - `status`: exact match on bullet status string.
    /// - `technology`: case-insensitive match on linked skill name via
    ///   `bullet_skills` + `skills` tables.
    /// - `domain`: exact match on the `domain` column.
    ///
    /// Results are ordered by `created_at DESC`.
    pub fn list(
        &self,
        filter: &BulletFilter,
        pagination: &PaginationParams,
    ) -> Result<(Vec<Bullet>, i64), ForgeError> {
        todo!()
    }

    /// Count total bullets matching the given filter.
    pub fn count(&self, filter: &BulletFilter) -> Result<i64, ForgeError> {
        todo!()
    }

    // ── Junction: bullet_sources ────────────────────────────────────

    /// Link a bullet to a source.
    ///
    /// `is_primary` defaults to `true` matching historical semantics.
    pub fn link_source(
        &self,
        bullet_id: &str,
        source_id: &str,
        is_primary: bool,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Unlink a bullet from a source.
    pub fn unlink_source(&self, bullet_id: &str, source_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// List all source links for a bullet.
    pub fn list_source_links(&self, bullet_id: &str) -> Result<Vec<BulletSource>, ForgeError> {
        todo!()
    }

    /// Find bullet IDs linked to a given source.
    pub fn find_ids_by_source(&self, source_id: &str) -> Result<Vec<String>, ForgeError> {
        todo!()
    }

    // ── Junction: bullet_skills (technologies) ──────────────────────

    /// Fetch the technology names linked to a bullet.
    ///
    /// Returns lowercased, trimmed skill names sorted alphabetically.
    pub fn get_technologies(&self, bullet_id: &str) -> Result<Vec<String>, ForgeError> {
        todo!()
    }

    /// Replace all technology links for a bullet (delete-then-insert).
    ///
    /// Each technology string is normalized (lowercase + trim) and matched
    /// case-insensitively against existing skills. Missing skills are
    /// created with `category = 'other'`. Empty strings are skipped.
    /// Duplicate names within the list are skipped via composite-PK
    /// uniqueness.
    pub fn replace_technologies(
        &self,
        bullet_id: &str,
        technologies: &[String],
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Add technology links to a bullet without removing existing ones.
    ///
    /// Uses find-or-create on the `skills` table, then idempotently
    /// inserts into `bullet_skills`.
    pub fn add_technologies(
        &self,
        bullet_id: &str,
        technologies: &[String],
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove all technology links for a bullet.
    pub fn clear_technologies(&self, bullet_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// Find bullet IDs linked to a skill by case-insensitive name match.
    pub fn find_ids_by_technology(&self, technology: &str) -> Result<Vec<String>, ForgeError> {
        todo!()
    }
}
