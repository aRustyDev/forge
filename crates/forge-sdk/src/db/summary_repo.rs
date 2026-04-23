//! Repository for summary persistence.
//!
//! Provides CRUD operations, skill junction management, linked resume queries,
//! and template toggling for the `summaries` and `summary_skills` tables.
//! All method bodies are `todo!()` stubs.

use forge_core::{
    CreateSummary, ForgeError, Pagination, Resume, Skill, Summary,
    SummaryFilter, SummarySort, UpdateSummary,
};

/// Data-access repository for summaries and the `summary_skills` junction.
pub struct SummaryRepo;

impl SummaryRepo {
    /// Create a new `SummaryRepo` instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Core CRUD ───────────────────────────────────────────────────

    /// Insert a new summary row.
    pub fn create(&self, input: &CreateSummary) -> Result<Summary, ForgeError> {
        todo!()
    }

    /// Fetch a single summary by primary key.
    pub fn get(&self, id: &str) -> Result<Option<Summary>, ForgeError> {
        todo!()
    }

    /// List summaries with optional filtering, sorting, and pagination.
    pub fn list(
        &self,
        filter: Option<&SummaryFilter>,
        sort: Option<&SummarySort>,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<Summary>, Pagination), ForgeError> {
        todo!()
    }

    /// Apply a partial update to an existing summary.
    pub fn update(&self, id: &str, input: &UpdateSummary) -> Result<(), ForgeError> {
        todo!()
    }

    /// Delete a summary by primary key.
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Template helpers ────────────────────────────────────────────

    /// Toggle the `is_template` flag on a summary (0 -> 1 or 1 -> 0).
    pub fn toggle_template(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Skill junction ──────────────────────────────────────────────

    /// Link a skill keyword to a summary (idempotent).
    pub fn add_skill(&self, summary_id: &str, skill_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a skill keyword from a summary.
    pub fn remove_skill(&self, summary_id: &str, skill_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// Get all skills linked to a summary.
    pub fn get_skills(&self, summary_id: &str) -> Result<Vec<Skill>, ForgeError> {
        todo!()
    }

    // ── Linked resumes ──────────────────────────────────────────────

    /// List resumes that reference this summary via `summary_id`, with pagination.
    pub fn list_linked_resumes(
        &self,
        summary_id: &str,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<Resume>, Pagination), ForgeError> {
        todo!()
    }

    /// Count resumes linked to a summary (used for `linked_resume_count`).
    pub fn count_linked_resumes(&self, summary_id: &str) -> Result<i64, ForgeError> {
        todo!()
    }

    // ── Clone ───────────────────────────────────────────────────────

    /// Duplicate a summary row and its `summary_skills` links, returning the new row.
    pub fn clone_summary(&self, id: &str) -> Result<Summary, ForgeError> {
        todo!()
    }
}
