//! Repository for user note persistence.
//!
//! Provides CRUD operations and polymorphic reference linking for the
//! `user_notes` and `note_references` tables.
//! All method bodies are `todo!()` stubs.

use forge_core::{
    ForgeError, NoteReference, NoteReferenceEntityType, Pagination, UserNote,
};

/// Data-access repository for user notes and note references.
pub struct NoteRepo;

impl NoteRepo {
    /// Create a new `NoteRepo` instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Core CRUD ───────────────────────────────────────────────────

    /// Insert a new user note row.
    pub fn create(
        &self,
        title: Option<&str>,
        content: &str,
    ) -> Result<UserNote, ForgeError> {
        todo!()
    }

    /// Fetch a single note by primary key.
    pub fn get(&self, id: &str) -> Result<Option<UserNote>, ForgeError> {
        todo!()
    }

    /// List notes with optional text search and pagination.
    /// Searches across `title` and `content` fields (case-insensitive LIKE).
    pub fn list(
        &self,
        search: Option<&str>,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<UserNote>, Pagination), ForgeError> {
        todo!()
    }

    /// Apply a partial update to an existing note (title and/or content).
    pub fn update(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Delete a note by primary key (cascades to `note_references`).
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Reference junction ──────────────────────────────────────────

    /// Add a polymorphic reference linking a note to an entity.
    pub fn add_reference(
        &self,
        note_id: &str,
        entity_type: NoteReferenceEntityType,
        entity_id: &str,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a polymorphic reference by composite key.
    /// Returns an error with `NOT_FOUND` if the reference does not exist.
    pub fn remove_reference(
        &self,
        note_id: &str,
        entity_type: NoteReferenceEntityType,
        entity_id: &str,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// List all references for a given note.
    pub fn list_references(&self, note_id: &str) -> Result<Vec<NoteReference>, ForgeError> {
        todo!()
    }

    /// Find all notes referencing a specific entity (reverse lookup).
    /// Returns notes ordered by `updated_at DESC`.
    pub fn find_by_entity(
        &self,
        entity_type: NoteReferenceEntityType,
        entity_id: &str,
    ) -> Result<Vec<UserNote>, ForgeError> {
        todo!()
    }
}
