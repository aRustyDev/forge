//! Business logic service for user notes.
//!
//! Validates input, delegates to `NoteStore`, and manages the polymorphic
//! `note_references` junction table for linking notes to arbitrary entities.
//!
//! All method bodies are `todo!()` stubs.

use forge_core::{
    ForgeError, NoteReference, NoteReferenceEntityType, Pagination, UserNote,
    UserNoteWithReferences,
};

/// Service layer for note business logic.
pub struct NoteService;

impl NoteService {
    /// Create a new `NoteService` instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Core CRUD ───────────────────────────────────────────────────

    /// Create a new note.
    ///
    /// Validates that content is non-empty.
    pub fn create(&self, title: Option<&str>, content: &str) -> Result<UserNote, ForgeError> {
        todo!()
    }

    /// Fetch a single note by ID, including its references.
    pub fn get(&self, id: &str) -> Result<UserNoteWithReferences, ForgeError> {
        todo!()
    }

    /// List notes with optional text search and pagination.
    ///
    /// Searches across title and content (case-insensitive).
    /// Results are ordered by `updated_at DESC`.
    pub fn list(
        &self,
        search: Option<&str>,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<UserNote>, Pagination), ForgeError> {
        todo!()
    }

    /// Partially update a note (title and/or content).
    ///
    /// Validates that content is non-empty when provided.
    pub fn update(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
    ) -> Result<UserNote, ForgeError> {
        todo!()
    }

    /// Delete a note by ID.
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Reference management ────────────────────────────────────────

    /// Add a polymorphic reference linking a note to an entity.
    ///
    /// Validates the entity type against the allowed set. Verifies the
    /// note exists before inserting. Returns `CONFLICT` on duplicate.
    pub fn add_reference(
        &self,
        note_id: &str,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a polymorphic reference by composite key.
    ///
    /// Returns `NOT_FOUND` if the reference does not exist.
    pub fn remove_reference(
        &self,
        note_id: &str,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Get all notes referencing a specific entity (reverse lookup).
    ///
    /// Validates the entity type. Returns notes ordered by `updated_at DESC`.
    pub fn get_notes_for_entity(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<Vec<UserNote>, ForgeError> {
        todo!()
    }
}
